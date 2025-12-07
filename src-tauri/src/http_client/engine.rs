use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use tauri::Emitter;

use crate::errors::AppError;
use crate::http_client::request::Request;
use crate::http_client::response::{LogEntry, ResponseData};

pub type EngineFuture = Pin<Box<dyn Future<Output = Result<ResponseData, AppError>> + Send>>;

pub trait LogEmitter: Send + Sync {
    fn emit(&self, entry: LogEntry);
}

pub trait HttpEngine: Send + Sync {
    fn execute(&self, request: Request, emitter: Arc<dyn LogEmitter>) -> EngineFuture;
}

pub struct TauriLogEmitter<R = tauri::Wry>
where
    R: tauri::Runtime,
{
    app_handle: tauri::AppHandle<R>,
}

impl<R> TauriLogEmitter<R>
where
    R: tauri::Runtime,
{
    pub fn new(app_handle: tauri::AppHandle<R>) -> Self {
        Self { app_handle }
    }
}

impl<R> LogEmitter for TauriLogEmitter<R>
where
    R: tauri::Runtime,
{
    fn emit(&self, entry: LogEntry) {
        let _ = self.app_handle.emit("http-request-log", entry);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::http_client::response::{LogEntry, LogLevel};
    use serde_json::json;

    use std::sync::Mutex;

    #[derive(Default)]
    struct RecordingEmitter {
        entries: Mutex<Vec<LogEntry>>,
    }

    impl LogEmitter for RecordingEmitter {
        fn emit(&self, entry: LogEntry) {
            self.entries.lock().unwrap().push(entry);
        }
    }

    #[test]
    fn recording_emitter_captures_entry() {
        let emitter = RecordingEmitter::default();
        let entry = LogEntry {
            request_id: "req-emit".to_string(),
            timestamp: "now".to_string(),
            level: LogLevel::Info,
            info_type: Some("test".to_string()),
            message: "hello".to_string(),
            category: Some("auth".to_string()),
            phase: Some("emit".to_string()),
            elapsed_ms: Some(1),
            details: Some(json!({"key": "value"})),
            bytes_logged: None,
            truncated: None,
        };

        emitter.emit(entry.clone());

        let entries = emitter.entries.lock().unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].request_id, "req-emit");
        assert_eq!(entries[0].message, "hello");
    }
}
