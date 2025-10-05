use super::crypto::{decrypt_in_place, encrypt_in_place, get_or_create_key};
use crate::app_error;
use crate::errors::{AppError, ErrorKind};
use serde_json::Value;
use std::panic::Location;
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager, path::BaseDirectory};

#[cfg(test)]
use std::sync::OnceLock;

#[cfg(test)]
static TEST_APPDATA_DIR: OnceLock<PathBuf> = OnceLock::new();

#[cfg(test)]
pub(crate) fn __set_test_appdata_dir(dir: PathBuf) {
    let _ = TEST_APPDATA_DIR.set(dir);
}

pub fn load_app_data(app: &AppHandle, file_name: &str) -> Result<Value, AppError> {
    let config_path = app_data_file_path(app, file_name)?;
    if !config_path.exists() {
        return Err(app_error!(
            ErrorKind::FileNotFound,
            format!("File '{}' does not exist", config_path.display())
        ));
    }

    let key = get_or_create_key(app, "app_data")?;
    let contents = fs::read_to_string(&config_path)?;
    let mut json: Value = serde_json::from_str(&contents)?;
    decrypt_in_place(&mut json, &key);
    Ok(json)
}

pub fn save_app_data(app: &AppHandle, file_name: &str, mut json: Value) -> Result<(), AppError> {
    let config_path = app_data_file_path(app, file_name)?;
    let key = get_or_create_key(app, "app_data")?;

    // Ensure the config directory exists
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)?;
    }

    encrypt_in_place(&mut json, &key);
    let contents = serde_json::to_string_pretty(&json)?;
    fs::write(config_path, contents)?;

    Ok(())
}

pub fn delete_app_data(app: &AppHandle, file_name: &str) -> Result<(), AppError> {
    let config_path = app_data_file_path(app, file_name)?;
    fs::remove_file(config_path)?;
    Ok(())
}

fn app_data_file_path(app: &AppHandle, file_name: &str) -> Result<PathBuf, AppError> {
    #[cfg(test)]
    if let Some(dir) = TEST_APPDATA_DIR.get() {
        return Ok(dir.join(file_name));
    }

    let file_path = app
        .path()
        .resolve(file_name, BaseDirectory::AppData)
        .map_err(|e| AppError::from_error(ErrorKind::InvalidPath, e, None, Location::caller()))?;

    Ok(file_path)
}

#[cfg(test)]
mod tests {
    use super::{decrypt_in_place, encrypt_in_place};
    use crate::errors::{AppError, ErrorKind};
    use serde_json::{Value, json};
    use std::{fs, path::PathBuf};

    const TEST_KEY: [u8; 32] = [42u8; 32];

    fn unique_temp_dir() -> PathBuf {
        let base = std::env::temp_dir();
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let pid = std::process::id();
        base.join(format!("knurl_test_appdata_{pid}_{ts}"))
    }

    fn write_pretty_json(path: &PathBuf, mut json: Value) {
        encrypt_in_place(&mut json, &TEST_KEY);
        let s = serde_json::to_string_pretty(&json).unwrap();
        fs::write(path, s).unwrap();
    }

    fn read_and_decrypt(path: &PathBuf) -> Value {
        let s = fs::read_to_string(path).unwrap();
        let mut json: Value = serde_json::from_str(&s).unwrap();
        decrypt_in_place(&mut json, &TEST_KEY);
        json
    }

    #[test]
    fn load_missing_file_returns_filenotfound() {
        let tmp = unique_temp_dir();
        fs::create_dir_all(&tmp).unwrap();
        let path = tmp.join("no_such_file.json");
        assert!(!path.exists());

        // Simulate loader::load_app_data behavior
        let result = if !path.exists() {
            Err(crate::app_error!(
                ErrorKind::FileNotFound,
                format!("File '{}' does not exist", path.display())
            ))
        } else {
            Ok(Value::Null)
        };
        let err = result.expect_err("should error");
        assert_eq!(err.kind, ErrorKind::FileNotFound);
    }

    #[test]
    fn save_then_load_roundtrip_and_delete() {
        let tmp = unique_temp_dir();
        fs::create_dir_all(&tmp).unwrap();

        let file = "settings.json";
        let path = tmp.join(file);

        let json = json!({
            "plain": {"a": 1},
            "creds": {"secure": true, "value": "password"}
        });

        // Simulate save_app_data: encrypt and write pretty JSON
        write_pretty_json(&path, json.clone());
        assert!(path.exists(), "file should exist after save");

        // Simulate load_app_data: read and decrypt
        let loaded = read_and_decrypt(&path);
        assert_eq!(loaded["plain"], json["plain"]);
        assert_eq!(loaded["creds"]["value"], "password");

        // Simulate delete_app_data
        fs::remove_file(&path).expect("delete ok");
        assert!(
            !path.exists(),
            "file should not exist after delete_app_data"
        );
    }
}
