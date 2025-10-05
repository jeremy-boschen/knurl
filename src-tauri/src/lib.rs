mod app_data;
mod errors;
mod http_client;

use crate::app_data::crypto;
use crate::errors::error::UserCancelled;
use crate::errors::{AppError, ErrorKind};
use crate::http_client::auth::{self, AuthConfig, AuthResult, OidcDiscovery};
use base64::{Engine as _, engine::general_purpose};
use chrono::Local;
use http_client::{
    engine::{HttpEngine, TauriLogEmitter},
    hyper_engine::HyperEngine,
    manager,
    request::Request,
    response::ResponseData,
};
use log::LevelFilter;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::panic::Location;
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::Manager;
use tauri::path::BaseDirectory;
use tauri_plugin_dialog::DialogExt;

#[derive(Clone)]
struct StartupProbe {
    inner: Arc<StartupProbeInner>,
}

struct StartupProbeInner {
    enabled: bool,
    start: Instant,
    last_mark: Mutex<Instant>,
    file_log: Option<Mutex<std::fs::File>>,
}

impl StartupProbe {
    fn new() -> Self {
        let enabled = std::env::var("KNURL_START_PROBE")
            .map(|value| matches!(value.trim().to_ascii_lowercase().as_str(), "1" | "true"))
            .unwrap_or(false);

        let now = Instant::now();
        let file_log = if enabled {
            Self::open_log_file().ok()
        } else {
            None
        };

        Self {
            inner: Arc::new(StartupProbeInner {
                enabled,
                start: now,
                last_mark: Mutex::new(now),
                file_log,
            }),
        }
    }

    fn is_enabled(&self) -> bool {
        self.inner.enabled
    }

    fn open_log_file() -> std::io::Result<Mutex<std::fs::File>> {
        use std::fs::{OpenOptions, create_dir_all};
        use std::io::Write;

        let base_dir = std::env::temp_dir().join("knurl-startup");
        create_dir_all(&base_dir)?;
        let log_path = base_dir.join("startup.log");
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)?;
        writeln!(file, "\n--- Startup log {} ---", Local::now().to_rfc3339())?;
        Ok(Mutex::new(file))
    }

    fn mark(&self, stage: &str) {
        if !self.is_enabled() {
            return;
        }

        let now = Instant::now();
        let total_ms = now.duration_since(self.inner.start).as_secs_f64() * 1000.0;
        let delta_ms = {
            let mut last = self.inner.last_mark.lock().unwrap();
            let delta = now.duration_since(*last).as_secs_f64() * 1000.0;
            *last = now;
            delta
        };

        log::info!(
            target: "knurl/startup",
            "stage={stage} total_ms={total_ms:.2} delta_ms={delta_ms:.2}"
        );

        if let Some(file_mutex) = &self.inner.file_log {
            let mut file = match file_mutex.lock() {
                Ok(handle) => handle,
                Err(_) => return,
            };
            use std::io::Write;
            let _ = writeln!(
                file,
                "stage={stage} total_ms={total_ms:.2} delta_ms={delta_ms:.2}"
            );
        }
    }
}

/// Sends an HTTP request and returns its response with live logging
#[tauri::command(async)]
async fn send_http_request(app: tauri::AppHandle, opts: Request) -> Result<ResponseData, AppError> {
    use std::sync::Arc;

    let emitter = Arc::new(TauriLogEmitter::new(app.clone()));

    // Backend uses Hyper exclusively now; ignore any engine preference.
    let engine: Box<dyn HttpEngine> = Box::new(HyperEngine::new());

    let request_id = opts.request_id.clone();
    // Register cancellation token for this request
    let token = manager::register(&request_id);
    // Run the request and allow cancellation via token
    let result = tokio::select! {
        _ = token.cancelled() => {
            Err(AppError::new(ErrorKind::UserCancelled, "Request was cancelled"))
        }
        res = engine.execute(opts, emitter) => res
    };
    // Clean up token after completion
    manager::remove(&request_id);
    result
}

/// Loads the application data file
#[tauri::command(async)]
async fn load_app_data(app: tauri::AppHandle, file_name: String) -> Result<Value, AppError> {
    app_data::load_app_data(&app, &file_name)
}

/// Saves the application data file
#[tauri::command(async)]
async fn save_app_data(
    app: tauri::AppHandle,
    file_name: String,
    data: Value,
) -> Result<(), AppError> {
    app_data::save_app_data(&app, &file_name, data)
}

#[tauri::command(async)]
async fn delete_app_data(app: tauri::AppHandle, file_name: String) -> Result<(), AppError> {
    app_data::delete_app_data(&app, &file_name)
}

#[tauri::command(async)]
async fn get_data_encryption_key(app: tauri::AppHandle) -> Result<String, AppError> {
    crypto::get_data_encryption_key(&app)
}

#[tauri::command(async)]
async fn set_data_encryption_key(app: tauri::AppHandle, key_b64: String) -> Result<(), AppError> {
    crypto::set_data_encryption_key(&app, &key_b64)
}

#[tauri::command(async)]
async fn get_app_data_dir(app: tauri::AppHandle) -> Result<String, AppError> {
    let path = app
        .path()
        .resolve("", BaseDirectory::AppData)
        .map_err(|e| AppError::from_error(ErrorKind::InvalidPath, e, None, Location::caller()))?;
    Ok(path.to_string_lossy().to_string())
}

/// Cancels an in-flight HTTP request by its requestId/correlation id
fn cancel_http_request_inner(request_id: &str) -> Result<(), AppError> {
    if http_client::manager::cancel(request_id) {
        Ok(())
    } else {
        Err(AppError::new(
            ErrorKind::BadRequest,
            format!("No in-flight request found for id: {request_id}"),
        ))
    }
}

#[tauri::command(async)]
async fn cancel_http_request(_app: tauri::AppHandle, request_id: String) -> Result<(), AppError> {
    cancel_http_request_inner(&request_id)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FileDialogFilter {
    name: String,
    extensions: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveFileDialogOptions {
    title: String,
    default_path: String,
    filters: Option<Vec<FileDialogFilter>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OpenFileDialogOptions {
    title: String,
    filters: Option<Vec<FileDialogFilter>>,
    default_path: Option<String>,
    read_content: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenedFile {
    file_path: String,
    content: String,
    mime_type: String,
}

#[tauri::command(async)]
async fn save_file(
    app: tauri::AppHandle,
    content: String,
    options: SaveFileDialogOptions,
) -> Result<String, AppError> {
    let result = tauri::async_runtime::spawn_blocking(move || -> Result<String, AppError> {
        let mut dialog = app.dialog().file().set_title(&options.title);

        if let Some(filters) = options.filters {
            for filter in filters {
                let extensions: Vec<&str> = filter.extensions.iter().map(|s| s.as_str()).collect();
                dialog = dialog.add_filter(&filter.name, &extensions);
            }
        }

        let file_path = dialog
            .set_file_name(&options.default_path)
            .blocking_save_file();

        if let Some(fp) = file_path {
            if let Some(path) = fp.as_path() {
                if let Err(e) = std::fs::write(path, content) {
                    log::error!("Failed to write file: {e}");
                    return Err(AppError::from_error(
                        ErrorKind::IoError,
                        e,
                        None,
                        Location::caller(),
                    ));
                }
                log::info!("File saved to: {}", path.display());
                Ok(path.to_string_lossy().to_string())
            } else {
                Err(AppError::new(
                    ErrorKind::InvalidPath,
                    "File path is not representable as a native path".to_string(),
                ))
            }
        } else {
            Err(UserCancelled.into())
        }
    })
    .await;

    result.unwrap_or_else(|join_error| {
        Err(AppError::new(
            ErrorKind::IoError,
            format!("Failed to execute save operation: {join_error}"),
        ))
    })
}

#[tauri::command(async)]
async fn save_binary(
    app: tauri::AppHandle,
    content_base64: String,
    options: SaveFileDialogOptions,
) -> Result<String, AppError> {
    let result = tauri::async_runtime::spawn_blocking(move || -> Result<String, AppError> {
        let mut dialog = app.dialog().file().set_title(&options.title);

        if let Some(filters) = options.filters {
            for filter in filters {
                let extensions: Vec<&str> = filter.extensions.iter().map(|s| s.as_str()).collect();
                dialog = dialog.add_filter(&filter.name, &extensions);
            }
        }

        let file_path = dialog
            .set_file_name(&options.default_path)
            .blocking_save_file();

        if let Some(fp) = file_path {
            if let Some(path) = fp.as_path() {
                match general_purpose::STANDARD.decode(content_base64.as_bytes()) {
                    Ok(bytes) => {
                        if let Err(e) = std::fs::write(path, bytes) {
                            log::error!("Failed to write binary file: {e}");
                            return Err(AppError::from_error(
                                ErrorKind::IoError,
                                e,
                                None,
                                Location::caller(),
                            ));
                        }
                        log::info!("Binary file saved to: {}", path.display());
                        Ok(path.to_string_lossy().to_string())
                    }
                    Err(e) => Err(AppError::new(
                        ErrorKind::BadRequest,
                        format!("Invalid base64 content: {e}"),
                    )),
                }
            } else {
                Err(AppError::new(
                    ErrorKind::InvalidPath,
                    "File path is not representable as a native path".to_string(),
                ))
            }
        } else {
            Err(UserCancelled.into())
        }
    })
    .await;

    result.unwrap_or_else(|join_error| {
        Err(AppError::new(
            ErrorKind::IoError,
            format!("Failed to execute save binary operation: {join_error}"),
        ))
    })
}

#[tauri::command(async)]
async fn open_file(
    app: tauri::AppHandle,
    options: OpenFileDialogOptions,
) -> Result<OpenedFile, AppError> {
    let result = tauri::async_runtime::spawn_blocking(move || -> Result<OpenedFile, AppError> {
        let mut dialog = app.dialog().file().set_title(&options.title);

        if let Some(filters) = options.filters {
            for filter in filters {
                let extensions: Vec<&str> = filter.extensions.iter().map(|s| s.as_str()).collect();
                dialog = dialog.add_filter(&filter.name, &extensions);
            }
        }
        if let Some(path) = options.default_path {
            dialog = dialog.set_directory(path);
        }

        let file_path = dialog.blocking_pick_file();

        if let Some(fp) = file_path {
            if let Some(path) = fp.as_path() {
                let read_content = options.read_content.unwrap_or(true);
                let mime_type = mime_guess::from_path(path)
                    .first_or_octet_stream()
                    .essence_str()
                    .to_string();

                if read_content {
                    match std::fs::read_to_string(path) {
                        Ok(content) => {
                            let path_str = path.to_string_lossy().to_string();
                            log::info!("File opened from: {}", path.display());
                            Ok(OpenedFile {
                                file_path: path_str,
                                content,
                                mime_type,
                            })
                        }
                        Err(e) => {
                            log::error!("Failed to read file: {e}");
                            Err(AppError::from_error(
                                ErrorKind::IoError,
                                e,
                                None,
                                Location::caller(),
                            ))
                        }
                    }
                } else {
                    let path_str = path.to_string_lossy().to_string();
                    log::info!("File chosen: {}", path.display());
                    Ok(OpenedFile {
                        file_path: path_str,
                        content: String::new(),
                        mime_type,
                    })
                }
            } else {
                Err(AppError::new(
                    ErrorKind::IoError,
                    "File path is not representable as a native path".to_string(),
                ))
            }
        } else {
            Err(UserCancelled.into())
        }
    })
    .await;

    result.unwrap_or_else(|join_error| {
        Err(AppError::new(
            ErrorKind::IoError,
            format!("Failed to execute open operation: {join_error}"),
        ))
    })
}

#[tauri::command(async)]
async fn delete_file(_app: tauri::AppHandle, path: String) -> Result<(), AppError> {
    match std::fs::remove_file(&path) {
        Ok(_) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(AppError::from_error(
            ErrorKind::IoError,
            e,
            None,
            Location::caller(),
        )),
    }
}

#[tauri::command(async)]
async fn discover_oidc(app: tauri::AppHandle, url: String) -> Result<OidcDiscovery, AppError> {
    auth::discover_oidc(app, url).await
}

#[tauri::command(async)]
async fn get_authentication_result(
    app: tauri::AppHandle,
    config: AuthConfig,
    parent_request_id: Option<String>,
) -> Result<AuthResult, AppError> {
    auth::get_authentication_result(app, config, parent_request_id).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Install ring crypto provider for rustls
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("Failed to install default crypto provider");

    let probe = StartupProbe::new();
    probe.mark("rust_start");

    let builder = tauri::Builder::default();
    probe.mark("builder_created");

    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        #[cfg(desktop)]
        {
            let _ = app
                .get_webview_window("main")
                .expect("no main window")
                .set_focus();
        }
    }));

    let builder = builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level({
                    #[cfg(debug_assertions)]
                    {
                        LevelFilter::Debug
                    }
                    #[cfg(not(debug_assertions))]
                    {
                        LevelFilter::Info
                    }
                })
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::Webview,
                ))
                .filter(|meta| meta.target() != "keyring")
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            send_http_request,
            load_app_data,
            save_app_data,
            delete_app_data,
            get_data_encryption_key,
            set_data_encryption_key,
            get_app_data_dir,
            save_file,
            save_binary,
            open_file,
            delete_file,
            discover_oidc,
            get_authentication_result,
            cancel_http_request,
        ]);

    probe.mark("plugins_configured");

    let setup_probe = probe.clone();
    let builder = builder.setup(move |app| {
        setup_probe.mark("setup_begin");

        #[cfg(debug_assertions)]
        {
            if let Some(window) = app.get_webview_window("main") {
                window.open_devtools();
            }
        }

        #[allow(clippy::collapsible_if)]
        if setup_probe.is_enabled() {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.eval("window.__KNURL_START_PROBE__ = true;");
            }
        }

        setup_probe.mark("setup_complete");
        Ok(())
    });

    let page_probe = probe.clone();
    let builder = builder.on_page_load(move |_window, _payload| {
        page_probe.mark("page_load");
    });

    probe.mark("before_run");

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::cancel_http_request_inner;
    use crate::http_client::manager;

    #[test]
    fn cancel_http_request_inner_returns_ok_when_id_exists() {
        let id = "test-req-ok";
        let token = manager::register(id);
        assert!(!token.is_cancelled());
        let res = cancel_http_request_inner(id);
        assert!(res.is_ok(), "expected Ok for existing id");
        assert!(token.is_cancelled(), "token should be cancelled");
        manager::remove(id);
    }

    #[test]
    fn cancel_http_request_inner_returns_bad_request_when_missing() {
        let id = "missing-id-123";
        // Ensure it's not registered
        manager::remove(id);
        let err = cancel_http_request_inner(id).expect_err("should return error");
        assert_eq!(err.kind, crate::errors::ErrorKind::BadRequest);
        assert!(err.message.contains(id));
    }
}
