use serde::Deserialize;
use std::collections::HashMap;

#[derive(Debug, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum MultipartPart {
    #[serde(rename = "text", rename_all = "camelCase")]
    Text { name: String, value: String },
    #[serde(rename = "file", rename_all = "camelCase")]
    File {
        name: String,
        file_path: String,
        file_name: Option<String>,
        content_type: Option<String>,
    },
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub enum HttpVersionPref {
    #[serde(rename = "auto")]
    Auto,
    #[serde(rename = "http1")]
    Http1,
    #[serde(rename = "http2")]
    Http2,
}

/// Options for an HTTP request sent via CurlClient
/// over the Tauri backend.
#[derive(Debug, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    // Unique ID of the request
    pub request_id: String,
    // Full request URL
    pub url: String,
    // HTTP method, e.g. "GET" or "POST"
    pub method: String,
    /// Optional map of header key/value pairs
    pub headers: Option<HashMap<String, String>>,
    /// Optional request body as raw bytes
    pub body: Option<Vec<u8>>,
    /// If true, disable SSL certificate verification
    pub disable_ssl: Option<bool>,
    /// Path to a custom root CA bundle (PEM format)
    pub ca_path: Option<String>,
    /// Hostname part for custom DNS override (e.g., "api.example.com")
    pub host_override: Option<String>,
    /// IP to resolve host_override to (e.g., "127.0.0.1")
    pub ip_override: Option<String>,
    /// Timeout in seconds for the request
    pub timeout_secs: Option<u64>,
    /// User agent string
    pub user_agent: Option<String>,

    /// Max bytes to log for request/response DATA events. None = no cap.
    pub max_log_bytes: Option<usize>,
    /// If true, redact sensitive header values (Authorization, Cookie, Set-Cookie).
    /// Default false (you asked to keep sensitive visible).
    pub redact_sensitive: Option<bool>,
    /// If false, suppress DATA (body) logs, keep headers/ssl/debug only. Default true.
    pub log_bodies: Option<bool>,

    /// Optional multipart parts for backend-side assembly.
    pub multipart_parts: Option<Vec<MultipartPart>>,

    /// Optional path to a file to use as the raw request body.
    pub body_file_path: Option<String>,

    /// Preferred HTTP version negotiation. Defaults to auto (h2 preferred via ALPN).
    pub http_version: Option<HttpVersionPref>,

    /// Maximum number of redirects to follow automatically. 0 disables.
    pub max_redirects: Option<u32>,

    /// Threshold in bytes before streaming response body to a temp file on disk.
    /// If not provided, defaults to 20MB.
    pub preview_max_bytes: Option<u64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn request_default_creates_empty_request() {
        let req = Request::default();
        assert_eq!(req.request_id, "");
        assert_eq!(req.url, "");
        assert_eq!(req.method, "");
        assert_eq!(req.headers, None);
        assert_eq!(req.body, None);
    }

    #[test]
    fn request_with_all_fields() {
        let mut headers = HashMap::new();
        headers.insert("Content-Type".to_string(), "application/json".to_string());

        let req = Request {
            request_id: "req-123".to_string(),
            url: "https://api.example.com/endpoint".to_string(),
            method: "POST".to_string(),
            headers: Some(headers),
            body: Some(vec![1, 2, 3, 4]),
            disable_ssl: Some(false),
            ca_path: Some("/path/to/ca.pem".to_string()),
            host_override: Some("api.override.com".to_string()),
            ip_override: Some("192.168.1.1".to_string()),
            timeout_secs: Some(30),
            user_agent: Some("MyClient/1.0".to_string()),
            max_log_bytes: Some(1024),
            redact_sensitive: Some(true),
            log_bodies: Some(true),
            multipart_parts: None,
            body_file_path: None,
            http_version: Some(HttpVersionPref::Http2),
            max_redirects: Some(5),
            preview_max_bytes: Some(20 * 1024 * 1024),
        };

        assert_eq!(req.request_id, "req-123");
        assert_eq!(req.url, "https://api.example.com/endpoint");
        assert_eq!(req.method, "POST");
        assert!(req.headers.is_some());
        assert!(req.body.is_some());
        assert_eq!(req.timeout_secs, Some(30));
        assert_eq!(req.max_redirects, Some(5));
    }

    #[test]
    fn http_version_pref_deserialization() {
        let auto: HttpVersionPref = serde_json::from_str("\"auto\"").unwrap();
        assert!(matches!(auto, HttpVersionPref::Auto));

        let http1: HttpVersionPref = serde_json::from_str("\"http1\"").unwrap();
        assert!(matches!(http1, HttpVersionPref::Http1));

        let http2: HttpVersionPref = serde_json::from_str("\"http2\"").unwrap();
        assert!(matches!(http2, HttpVersionPref::Http2));
    }

    #[test]
    fn multipart_text_deserialization() {
        let json = r#"{"type": "text", "name": "field1", "value": "value1"}"#;
        let part: MultipartPart = serde_json::from_str(json).unwrap();
        match part {
            MultipartPart::Text { name, value } => {
                assert_eq!(name, "field1");
                assert_eq!(value, "value1");
            }
            _ => panic!("Expected Text variant"),
        }
    }

    #[test]
    fn multipart_file_deserialization() {
        let json = r#"{"type": "file", "name": "upload", "filePath": "/tmp/file.txt", "fileName": "file.txt", "contentType": "text/plain"}"#;
        let part: MultipartPart = serde_json::from_str(json).unwrap();
        match part {
            MultipartPart::File {
                name,
                file_path,
                file_name,
                content_type,
            } => {
                assert_eq!(name, "upload");
                assert_eq!(file_path, "/tmp/file.txt");
                assert_eq!(file_name, Some("file.txt".to_string()));
                assert_eq!(content_type, Some("text/plain".to_string()));
            }
            _ => panic!("Expected File variant"),
        }
    }

    #[test]
    fn multipart_file_without_optional_fields() {
        let json = r#"{"type": "file", "name": "upload", "filePath": "/tmp/file.txt"}"#;
        let part: MultipartPart = serde_json::from_str(json).unwrap();
        match part {
            MultipartPart::File {
                name,
                file_path,
                file_name,
                content_type,
            } => {
                assert_eq!(name, "upload");
                assert_eq!(file_path, "/tmp/file.txt");
                assert_eq!(file_name, None);
                assert_eq!(content_type, None);
            }
            _ => panic!("Expected File variant"),
        }
    }

    #[test]
    fn request_clone_independence() {
        let req1 = Request {
            request_id: "req-1".to_string(),
            url: "https://example.com".to_string(),
            method: "GET".to_string(),
            ..Default::default()
        };

        let mut req2 = req1.clone();
        req2.request_id = "req-2".to_string();

        assert_eq!(req1.request_id, "req-1");
        assert_eq!(req2.request_id, "req-2");
    }
}
