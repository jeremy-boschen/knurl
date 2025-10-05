use crate::app_error;
use crate::errors::{AppError, ErrorKind};
// AES-GCM with 256-bit key
use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use base64::{DecodeError, Engine, engine::general_purpose as b64};
use keyring::Entry;
use rand::RngCore;
use serde_json::Value;
use tauri::AppHandle;

#[cfg(not(test))]
pub fn get_or_create_key(app: &AppHandle, key_name: &str) -> Result<[u8; 32], AppError> {
    let target = format!("{}:{}", app.config().identifier, app.package_info().name);
    let service = app.package_info().name.clone();
    let entry =
        Entry::new_with_target(&target, &service, key_name).map_err(|e: keyring::Error| {
            app_error!(ErrorKind::KeyringAttributeInvalid, e.to_string())
        })?;

    if let Ok(encoded) = entry.get_password() {
        let decoded = b64::URL_SAFE_NO_PAD
            .decode(&encoded)
            .map_err(|e: DecodeError| app_error!(ErrorKind::KeyringBadEncoding, e.to_string()))?;

        let key: [u8; 32] = decoded.try_into().map_err(|v: Vec<u8>| {
            app_error!(
                ErrorKind::InvalidKeyLength,
                format!("Expected 32-byte key, got {} bytes", v.len())
            )
        })?;

        return Ok(key);
    }

    // Generate and store a new key
    let mut key = [0u8; 32];
    rand::rng().fill_bytes(&mut key);

    let encoded = b64::URL_SAFE_NO_PAD.encode(key);
    entry.set_password(&encoded).map_err(|e: keyring::Error| {
        app_error!(ErrorKind::KeyringPlatformFailure, e.to_string())
    })?;

    Ok(key)
}

#[cfg(test)]
pub fn get_or_create_key(_app: &AppHandle, _key_name: &str) -> Result<[u8; 32], AppError> {
    // Deterministic 32-byte test key to avoid platform keyring in unit tests
    Ok([42u8; 32])
}

/// Encrypts plaintext using AES-256-GCM, returning a base64-encoded blob (nonce + ciphertext).
pub fn encrypt(plain_text: &str, key_bytes: &[u8]) -> Result<String, AppError> {
    let key = Key::<Aes256Gcm>::from_slice(key_bytes);
    let cipher = Aes256Gcm::new(key);

    let mut nonce_bytes = [0u8; 12]; // 96-bit nonce
    rand::rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plain_text.as_bytes())
        .map_err(|e: aes_gcm::Error| app_error!(ErrorKind::EncryptionFailed, e.to_string()))?;

    let mut combined = nonce_bytes.to_vec();
    combined.extend(ciphertext);

    Ok(b64::URL_SAFE_NO_PAD.encode(combined))
}

/// Decrypts a base64-encoded AES-GCM blob into plaintext.
pub fn decrypt(encoded: &str, key_bytes: &[u8]) -> Result<String, AppError> {
    let combined = b64::URL_SAFE_NO_PAD.decode(encoded)?;
    if combined.len() < 12 {
        return Err(app_error!(
            ErrorKind::DecryptionFailed,
            "Invalid encrypted data".to_string()
        ));
    }

    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let key = Key::<Aes256Gcm>::from_slice(key_bytes);
    let cipher = Aes256Gcm::new(key);

    let decrypted = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e: aes_gcm::Error| app_error!(ErrorKind::DecryptionFailed, e.to_string()))?;

    let utf8 = String::from_utf8(decrypted).map_err(|e: std::string::FromUtf8Error| {
        app_error!(ErrorKind::DecryptionFailed, e.to_string())
    })?;

    Ok(utf8)
}

pub fn decrypt_in_place(value: &mut Value, key_bytes: &[u8]) {
    decrypt_recursive(value, key_bytes, &mut Vec::new());
}

/// Recursively traverses a JSON tree and decrypts any objects with the `{"secure": true, "value": "<blob>"}` structure.
fn decrypt_recursive(value: &mut Value, key_bytes: &[u8], path: &mut Vec<String>) {
    match value {
        Value::Object(map) => {
            let is_secure = map.get("secure").and_then(Value::as_bool) == Some(true);

            if is_secure {
                if let Some(Value::String(current)) = map.get_mut("value") {
                    let encoded = current.clone();
                    match decrypt(&encoded, key_bytes) {
                        Ok(decrypted) => {
                            *current = decrypted;
                        }
                        Err(e) => {
                            let mut value_path = path.clone();
                            value_path.push("value".to_string());
                            log::error!(
                                "Decryption failed at path {}: {}",
                                format_json_path(&value_path),
                                e
                            );
                        }
                    }
                }
            } else {
                for (k, v) in map.iter_mut() {
                    path.push(k.clone());
                    decrypt_recursive(v, key_bytes, path);
                    path.pop();
                }
            }
        }
        Value::Array(arr) => {
            for (i, v) in arr.iter_mut().enumerate() {
                path.push(format!("[{i}]"));
                decrypt_recursive(v, key_bytes, path);
                path.pop();
            }
        }
        _ => {}
    }
}

fn format_json_path(path: &[String]) -> String {
    let mut result = String::new();
    for segment in path {
        if segment.starts_with('[') {
            result.push_str(segment); // already bracketed
        } else {
            if !result.is_empty() {
                result.push('.');
            }
            result.push_str(segment);
        }
    }
    result
}

/// Recursively traverses a JSON tree and encrypts any string value whose key passes `should_encrypt`.
pub fn encrypt_in_place(value: &mut Value, key_bytes: &[u8]) {
    encrypt_recursive(value, key_bytes, &mut Vec::new());
}

fn encrypt_recursive(value: &mut Value, key_bytes: &[u8], path: &mut Vec<String>) {
    match value {
        Value::Object(map) => {
            let is_secure = map.get("secure").and_then(Value::as_bool) == Some(true);

            if is_secure {
                if let Some(Value::String(current)) = map.get_mut("value") {
                    let plain = current.clone();
                    match encrypt(&plain, key_bytes) {
                        Ok(encrypted) => {
                            *current = encrypted;
                        }
                        Err(e) => {
                            let mut value_path = path.clone();
                            value_path.push("value".to_string());
                            log::error!(
                                "Encryption failed at path {}: {}",
                                format_json_path(&value_path),
                                e
                            );
                        }
                    }
                }
            } else {
                for (k, v) in map.iter_mut() {
                    path.push(k.clone());
                    encrypt_recursive(v, key_bytes, path);
                    path.pop();
                }
            }
        }
        Value::Array(arr) => {
            for (i, v) in arr.iter_mut().enumerate() {
                path.push(format!("[{i}]"));
                encrypt_recursive(v, key_bytes, path);
                path.pop();
            }
        }
        _ => {}
    }
}

pub fn get_data_encryption_key(app: &AppHandle) -> Result<String, AppError> {
    let key = get_or_create_key(app, "default")?;
    Ok(b64::URL_SAFE_NO_PAD.encode(key))
}

pub fn set_data_encryption_key(app: &AppHandle, key_b64: &str) -> Result<(), AppError> {
    // Validate the key is valid base64 and 32 bytes long after decoding.
    let decoded = b64::URL_SAFE_NO_PAD
        .decode(key_b64)
        .map_err(|e: DecodeError| app_error!(ErrorKind::KeyringBadEncoding, e.to_string()))?;

    if decoded.len() != 32 {
        return Err(app_error!(
            ErrorKind::InvalidKeyLength,
            format!("Expected 32-byte key, got {} bytes", decoded.len())
        ));
    }

    let target = format!("{}:{}", app.config().identifier, app.package_info().name);
    let service = app.package_info().name.clone();
    let entry =
        Entry::new_with_target(&target, &service, "default").map_err(|e: keyring::Error| {
            app_error!(ErrorKind::KeyringAttributeInvalid, e.to_string())
        })?;

    entry.set_password(key_b64).map_err(|e: keyring::Error| {
        app_error!(ErrorKind::KeyringPlatformFailure, e.to_string())
    })?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{decrypt, decrypt_in_place, encrypt, encrypt_in_place, format_json_path};
    use base64::Engine;
    use serde_json::json;

    const KEY: [u8; 32] = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
        25, 26, 27, 28, 29, 30, 31,
    ];

    #[test]
    fn formats_nested_paths() {
        let path = vec![
            "root".to_string(),
            "items".to_string(),
            "[0]".to_string(),
            "name".to_string(),
        ];
        let s = format_json_path(&path);
        assert_eq!(s, "root.items[0].name");
    }

    #[test]
    fn formats_top_level_and_arrays() {
        let path = vec!["[3]".to_string(), "value".to_string()];
        let s = format_json_path(&path);
        assert_eq!(s, "[3].value");
    }

    #[test]
    fn encrypt_decrypt_roundtrip() {
        let plaintext = "secret-value";
        let encoded = encrypt(plaintext, &KEY).expect("encrypt");
        assert!(!encoded.is_empty());
        let decrypted = decrypt(&encoded, &KEY).expect("decrypt");
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn encrypt_decrypt_in_place_nested() {
        let mut data = json!({
            "plain": "visible",
            "nested": {
                "secure": true,
                "value": "tok123"
            },
            "arr": [
                { "k": 1 },
                {
                    "secure": true,
                    "value": "tok456"
                }
            ]
        });

        // Encrypt
        encrypt_in_place(&mut data, &KEY);
        // Ensure secure nodes are no longer the same plaintext
        let enc_nested = data["nested"]["value"].as_str().unwrap().to_string();
        assert_ne!(enc_nested, "tok123");
        let enc_arr1 = data["arr"][1]["value"].as_str().unwrap().to_string();
        assert_ne!(enc_arr1, "tok456");
        // Plain nodes unchanged
        assert_eq!(data["plain"].as_str().unwrap(), "visible");

        // Decrypt
        decrypt_in_place(&mut data, &KEY);
        assert_eq!(data["nested"]["value"].as_str().unwrap(), "tok123");
        assert_eq!(data["arr"][1]["value"].as_str().unwrap(), "tok456");
        assert_eq!(data["plain"].as_str().unwrap(), "visible");
    }

    #[test]
    fn decrypt_handles_malformed_and_non_string_values_without_panic() {
        // secure object with non-string value
        let mut data = json!({
            "secure": true,
            "value": 12345
        });
        // Should not panic
        decrypt_in_place(&mut data, &KEY);
        // Value remains unchanged
        assert_eq!(data["value"], 12345);

        // secure object with invalid base64 content string
        let mut data2 = json!({
            "secure": true,
            "value": "@@not-base64@@"
        });
        // Should not panic; value remains the same string since decryption fails and is logged
        decrypt_in_place(&mut data2, &KEY);
        assert_eq!(data2["value"], "@@not-base64@@");
    }

    #[test]
    fn encrypt_handles_non_string_values_without_panic() {
        // secure object with non-string value should be left as-is
        let mut data = json!({
            "secure": true,
            "value": {"nested": true}
        });
        encrypt_in_place(&mut data, &KEY);
        assert_eq!(data["value"]["nested"], true);

        // array containing mixed values including a secure object with wrong shape
        let mut arr = json!([
            1,
            {"secure": true, "value": true},
            {"k": "v"}
        ]);
        encrypt_in_place(&mut arr, &KEY);
        // The boolean remains boolean as it cannot be encrypted
        assert_eq!(arr[1]["value"], true);
        // Plain entries unchanged
        assert_eq!(arr[2]["k"], "v");
    }

    #[test]
    fn decrypt_fails_for_too_short_input() {
        // base64 of 1 byte => less than required 12-byte nonce
        let too_short = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode([1u8]);
        let err = decrypt(&too_short, &KEY).expect_err("should fail");
        assert_eq!(err.kind, crate::errors::ErrorKind::DecryptionFailed);
    }

    #[test]
    fn encrypt_produces_urlsafe_base64_without_padding() {
        let encoded = encrypt("abc", &KEY).expect("encrypt ok");
        assert!(!encoded.contains('='), "should not contain padding");
        assert!(
            !encoded.contains('+') && !encoded.contains('/'),
            "should be URL-safe"
        );
    }
}
