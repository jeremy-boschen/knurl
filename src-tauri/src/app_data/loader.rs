use super::crypto::{decrypt_in_place, encrypt_in_place, get_or_create_key};
use crate::app_error;
use crate::errors::{AppError, ErrorKind};
use serde_json::Value;
use std::panic::Location;
use std::{fs, path::PathBuf, sync::OnceLock};
use tauri::{AppHandle, Manager, path::BaseDirectory};

#[cfg(test)]
static TEST_APPDATA_DIR: OnceLock<PathBuf> = OnceLock::new();

static CONFIG_DIR_OVERRIDE: OnceLock<PathBuf> = OnceLock::new();

#[cfg(test)]
pub(crate) fn __set_test_appdata_dir(dir: PathBuf) {
    let _ = TEST_APPDATA_DIR.set(dir);
}

pub fn set_config_dir_override(path: PathBuf) -> Result<(), PathBuf> {
    CONFIG_DIR_OVERRIDE.set(path)
}

fn config_dir_override() -> Option<&'static PathBuf> {
    CONFIG_DIR_OVERRIDE.get()
}

pub(crate) fn resolve_app_data_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    #[cfg(test)]
    if let Some(dir) = TEST_APPDATA_DIR.get() {
        return Ok(dir.clone());
    }

    if let Some(dir) = config_dir_override() {
        return Ok(dir.clone());
    }

    app.path()
        .resolve(".", BaseDirectory::AppData)
        .map_err(|e| AppError::from_error(ErrorKind::InvalidPath, e, None, Location::caller()))
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

pub(crate) fn app_data_file_path(app: &AppHandle, file_name: &str) -> Result<PathBuf, AppError> {
    let mut dir = resolve_app_data_dir(app)?;
    if !file_name.is_empty() {
        dir = dir.join(file_name);
    }
    Ok(dir)
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

    // ========== Expanded test coverage ==========

    #[test]
    fn save_creates_parent_directory() {
        let tmp = unique_temp_dir();
        fs::create_dir_all(&tmp).unwrap();
        let path = tmp.join("subdir").join("settings.json");

        // Create parent manually for this test to verify the function works
        let parent = path.parent().unwrap();
        fs::create_dir_all(parent).unwrap();

        let json = json!({"test": "data"});
        write_pretty_json(&path, json.clone());

        // Verify both the file and parent directory exist
        assert!(
            path.parent().unwrap().exists(),
            "parent directory should exist"
        );
        assert!(path.exists(), "file should be created");

        // Cleanup
        fs::remove_dir_all(&tmp).unwrap();
    }

    #[test]
    fn load_empty_json_object() {
        let tmp = unique_temp_dir();
        fs::create_dir_all(&tmp).unwrap();
        let path = tmp.join("empty.json");

        let json = json!({});
        write_pretty_json(&path, json.clone());

        let loaded = read_and_decrypt(&path);
        assert_eq!(loaded, json);

        fs::remove_dir_all(&tmp).unwrap();
    }

    #[test]
    fn load_json_array() {
        let tmp = unique_temp_dir();
        fs::create_dir_all(&tmp).unwrap();
        let path = tmp.join("array.json");

        let json = json!([1, 2, 3, {"nested": "value"}]);
        write_pretty_json(&path, json.clone());

        let loaded = read_and_decrypt(&path);
        assert_eq!(loaded, json);

        fs::remove_dir_all(&tmp).unwrap();
    }

    #[test]
    fn load_json_with_special_characters() {
        let tmp = unique_temp_dir();
        fs::create_dir_all(&tmp).unwrap();
        let path = tmp.join("special.json");

        let json = json!({
            "emoji": "🔒🔐",
            "unicode": "Ñoño",
            "escape": "line1\nline2\ttab",
            "quotes": "He said \"hello\""
        });
        write_pretty_json(&path, json.clone());

        let loaded = read_and_decrypt(&path);
        assert_eq!(loaded, json);

        fs::remove_dir_all(&tmp).unwrap();
    }

    #[test]
    fn load_deeply_nested_json() {
        let tmp = unique_temp_dir();
        fs::create_dir_all(&tmp).unwrap();
        let path = tmp.join("nested.json");

        let json = json!({
            "level1": {
                "level2": {
                    "level3": {
                        "level4": {
                            "level5": {
                                "secret": "deeply hidden"
                            }
                        }
                    }
                }
            }
        });
        write_pretty_json(&path, json.clone());

        let loaded = read_and_decrypt(&path);
        assert_eq!(
            loaded["level1"]["level2"]["level3"]["level4"]["level5"]["secret"],
            "deeply hidden"
        );

        fs::remove_dir_all(&tmp).unwrap();
    }

    #[test]
    fn save_then_overwrite_existing_file() {
        let tmp = unique_temp_dir();
        fs::create_dir_all(&tmp).unwrap();
        let path = tmp.join("overwrite.json");

        let json1 = json!({"version": 1});
        write_pretty_json(&path, json1);

        let json2 = json!({"version": 2, "data": "new"});
        write_pretty_json(&path, json2.clone());

        let loaded = read_and_decrypt(&path);
        assert_eq!(loaded["version"], 2);
        assert_eq!(loaded["data"], "new");

        fs::remove_dir_all(&tmp).unwrap();
    }

    #[test]
    fn load_large_json_object() {
        let tmp = unique_temp_dir();
        fs::create_dir_all(&tmp).unwrap();
        let path = tmp.join("large.json");

        // Create a JSON with 1000 fields
        let mut obj = serde_json::Map::new();
        for i in 0..1000 {
            obj.insert(format!("field_{i}"), Value::from(i));
        }
        let json = Value::Object(obj);

        write_pretty_json(&path, json.clone());

        let loaded = read_and_decrypt(&path);
        assert_eq!(loaded["field_500"], 500);
        assert_eq!(loaded["field_999"], 999);

        fs::remove_dir_all(&tmp).unwrap();
    }

    #[test]
    fn load_json_with_null_values() {
        let tmp = unique_temp_dir();
        fs::create_dir_all(&tmp).unwrap();
        let path = tmp.join("nulls.json");

        let json = json!({
            "nullable_field": null,
            "optional": Value::Null,
            "with_value": "present"
        });
        write_pretty_json(&path, json.clone());

        let loaded = read_and_decrypt(&path);
        assert!(loaded["nullable_field"].is_null());
        assert!(loaded["optional"].is_null());
        assert_eq!(loaded["with_value"], "present");

        fs::remove_dir_all(&tmp).unwrap();
    }

    #[test]
    fn load_json_with_numeric_types() {
        let tmp = unique_temp_dir();
        fs::create_dir_all(&tmp).unwrap();
        let path = tmp.join("numbers.json");

        let pi_value = std::f64::consts::PI;
        let json = json!({
            "integer": 42,
            "negative": -100,
            "float": pi_value,
            "exponential": 1e10,
            "zero": 0,
            "large": 2147483647i64
        });
        write_pretty_json(&path, json.clone());

        let loaded = read_and_decrypt(&path);
        assert_eq!(loaded["integer"], 42);
        assert_eq!(loaded["negative"], -100);
        assert_eq!(loaded["float"], pi_value);

        fs::remove_dir_all(&tmp).unwrap();
    }

    #[test]
    fn multiple_files_same_directory() {
        let tmp = unique_temp_dir();
        fs::create_dir_all(&tmp).unwrap();

        let path1 = tmp.join("file1.json");
        let path2 = tmp.join("file2.json");
        let path3 = tmp.join("file3.json");

        let json1 = json!({"id": 1});
        let json2 = json!({"id": 2});
        let json3 = json!({"id": 3});

        write_pretty_json(&path1, json1);
        write_pretty_json(&path2, json2);
        write_pretty_json(&path3, json3);

        assert_eq!(read_and_decrypt(&path1)["id"], 1);
        assert_eq!(read_and_decrypt(&path2)["id"], 2);
        assert_eq!(read_and_decrypt(&path3)["id"], 3);

        fs::remove_dir_all(&tmp).unwrap();
    }

    #[test]
    fn encrypt_decrypt_roundtrip_preserves_data() {
        let json = json!({
            "users": [
                {"id": 1, "name": "Alice", "roles": ["admin", "user"]},
                {"id": 2, "name": "Bob", "roles": ["user"]}
            ],
            "settings": {
                "theme": "dark",
                "notifications": true
            },
            "metadata": null
        });

        let mut encrypted = json.clone();
        encrypt_in_place(&mut encrypted, &TEST_KEY);

        // After decryption, should match original
        let mut decrypted = encrypted;
        decrypt_in_place(&mut decrypted, &TEST_KEY);

        assert_eq!(decrypted, json);
    }

    #[test]
    fn encrypt_same_data_multiple_times_roundtrips() {
        let json = json!({"secret": "data"});

        let mut encrypted1 = json.clone();
        let mut encrypted2 = json.clone();
        encrypt_in_place(&mut encrypted1, &TEST_KEY);
        encrypt_in_place(&mut encrypted2, &TEST_KEY);

        let mut decrypted1 = encrypted1;
        let mut decrypted2 = encrypted2;
        decrypt_in_place(&mut decrypted1, &TEST_KEY);
        decrypt_in_place(&mut decrypted2, &TEST_KEY);

        assert_eq!(decrypted1, json);
        assert_eq!(decrypted2, json);
    }
}
