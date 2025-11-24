use serde::Serialize;
use serde_json::Value;

/// Structured response returned to the frontend
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResponseData {
    pub request_id: String,
    /// HTTP status code (e.g., 200)
    pub status: u16,
    /// HTTP status message (e.g., "OK")
    pub status_text: String,
    /// List of (header, value)
    pub headers: Vec<(String, String)>,
    /// List of cookies parsed from the response. Each cookie contains
    /// structured fields like name, value, domain, path, expiration, max age,
    /// secure, http_only and same_site in accordance with the latest HTTP
    /// cookie specifications.
    pub cookies: Vec<Cookie>,
    /// Raw response body bytes
    pub body: Vec<u8>,
    /// Optional file path if the body was streamed to a temporary file instead of memory
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
    /// Response size in bytes
    pub size: u64,
    /// Response duration in milliseconds
    pub duration: u64,
    /// Response timestamp, ISO 8601
    pub timestamp: String,
}

/// Representation of an HTTP cookie.  This structure contains the
/// standard fields defined by modern cookie specifications.  Optional
/// fields are represented using `Option<T>` so that missing attributes
/// are serialized as `null` rather than empty strings.
#[derive(Debug, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Cookie {
    /// The cookie name
    pub name: String,
    /// The cookie value
    pub value: String,
    /// Domain that the cookie is scoped to (e.g. "example.com")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub domain: Option<String>,
    /// Path that the cookie is scoped to (e.g. "/")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    /// Expiration timestamp for the cookie in RFC 3339 format (e.g.
    /// "2025-08-13T12:34:56Z").  `None` indicates a session cookie or
    /// unknown expiration.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires: Option<String>,
    /// Max‑Age attribute as seconds until expiry.  `None` indicates
    /// unspecified.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_age: Option<i64>,
    /// Whether the cookie has the Secure attribute set.  `None` when
    /// unspecified, otherwise `Some(true)` or `Some(false)`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub secure: Option<bool>,
    /// Whether the cookie has the HttpOnly attribute set.  `None` when
    /// unspecified, otherwise `Some(true)` or `Some(false)`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub http_only: Option<bool>,
    /// SameSite attribute of the cookie.  Valid values are "Strict",
    /// "Lax", or "None" when specified.  `None` when unspecified.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub same_site: Option<String>,
}

/// Log entry for streaming to frontend during request execution
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    /// Unique ID for this request
    pub request_id: String,
    /// Timestamp of the log entry
    pub timestamp: String,
    /// Log level/category
    pub level: LogLevel,
    /// Type of debug info
    #[serde(skip_serializing_if = "Option::is_none")]
    pub info_type: Option<String>,
    /// The actual log message
    pub message: String,
    /// High-level category for the event (dns/connect/tls/http/...)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    /// Optional phase within the category (start/resolved/etc)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phase: Option<String>,
    /// Milliseconds elapsed since request start when the event was emitted
    #[serde(skip_serializing_if = "Option::is_none")]
    pub elapsed_ms: Option<u64>,
    /// Structured key/value payload for the log entry
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
    /// Number of payload bytes included with this event
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bytes_logged: Option<u64>,
    /// Indicates the payload was truncated due to max log rules
    #[serde(skip_serializing_if = "Option::is_none")]
    pub truncated: Option<bool>,
}

/// Log levels for categorizing different types of logs
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Info,
    Debug,
    Error,
    Warning,
}

impl LogEntry {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn response_data_creation() {
        let response = ResponseData {
            request_id: "req-123".to_string(),
            status: 200,
            status_text: "OK".to_string(),
            headers: vec![
                ("content-type".to_string(), "application/json".to_string()),
                ("server".to_string(), "nginx".to_string()),
            ],
            cookies: vec![],
            body: vec![1, 2, 3, 4],
            file_path: None,
            size: 4,
            duration: 100,
            timestamp: "2025-01-01T00:00:00Z".to_string(),
        };

        assert_eq!(response.status, 200);
        assert_eq!(response.status_text, "OK");
        assert_eq!(response.headers.len(), 2);
        assert_eq!(response.size, 4);
        assert_eq!(response.duration, 100);
    }

    #[test]
    fn response_data_with_file_path() {
        let response = ResponseData {
            request_id: "req-456".to_string(),
            status: 206,
            status_text: "Partial Content".to_string(),
            headers: vec![],
            cookies: vec![],
            body: vec![],
            file_path: Some("/tmp/response_body.bin".to_string()),
            size: 1024 * 1024,
            duration: 5000,
            timestamp: "2025-01-01T00:00:01Z".to_string(),
        };

        assert!(response.file_path.is_some());
        assert_eq!(response.file_path.unwrap(), "/tmp/response_body.bin");
        assert_eq!(response.body.len(), 0);
    }

    #[test]
    fn cookie_creation_full_attributes() {
        let cookie = Cookie {
            name: "session_id".to_string(),
            value: "abc123xyz".to_string(),
            domain: Some("example.com".to_string()),
            path: Some("/".to_string()),
            expires: Some("2025-12-31T23:59:59Z".to_string()),
            max_age: Some(3600),
            secure: Some(true),
            http_only: Some(true),
            same_site: Some("Strict".to_string()),
        };

        assert_eq!(cookie.name, "session_id");
        assert_eq!(cookie.value, "abc123xyz");
        assert_eq!(cookie.domain, Some("example.com".to_string()));
        assert_eq!(cookie.max_age, Some(3600));
        assert_eq!(cookie.secure, Some(true));
        assert_eq!(cookie.http_only, Some(true));
        assert_eq!(cookie.same_site, Some("Strict".to_string()));
    }

    #[test]
    fn cookie_creation_minimal() {
        let cookie = Cookie {
            name: "temp_token".to_string(),
            value: "token_value".to_string(),
            domain: None,
            path: None,
            expires: None,
            max_age: None,
            secure: None,
            http_only: None,
            same_site: None,
        };

        assert_eq!(cookie.name, "temp_token");
        assert_eq!(cookie.value, "token_value");
        assert!(cookie.domain.is_none());
        assert!(cookie.secure.is_none());
    }

    #[test]
    fn cookie_samesite_values() {
        let cookies: Vec<Cookie> = vec![
            Cookie {
                name: "c1".to_string(),
                value: "v1".to_string(),
                same_site: Some("Strict".to_string()),
                ..Default::default()
            },
            Cookie {
                name: "c2".to_string(),
                value: "v2".to_string(),
                same_site: Some("Lax".to_string()),
                ..Default::default()
            },
            Cookie {
                name: "c3".to_string(),
                value: "v3".to_string(),
                same_site: Some("None".to_string()),
                ..Default::default()
            },
        ];

        assert_eq!(cookies[0].same_site, Some("Strict".to_string()));
        assert_eq!(cookies[1].same_site, Some("Lax".to_string()));
        assert_eq!(cookies[2].same_site, Some("None".to_string()));
    }

    #[test]
    fn log_level_serialization() {
        let info = serde_json::to_string(&LogLevel::Info).unwrap();
        assert_eq!(info, "\"info\"");

        let debug = serde_json::to_string(&LogLevel::Debug).unwrap();
        assert_eq!(debug, "\"debug\"");

        let error = serde_json::to_string(&LogLevel::Error).unwrap();
        assert_eq!(error, "\"error\"");

        let warning = serde_json::to_string(&LogLevel::Warning).unwrap();
        assert_eq!(warning, "\"warning\"");
    }

    #[test]
    fn log_entry_creation() {
        let entry = LogEntry {
            request_id: "req-789".to_string(),
            timestamp: "2025-01-01T00:00:00.000Z".to_string(),
            level: LogLevel::Debug,
            info_type: Some("dns".to_string()),
            message: "DNS lookup completed".to_string(),
            category: Some("dns".to_string()),
            phase: Some("resolved".to_string()),
            elapsed_ms: Some(250),
            details: Some(serde_json::json!({"host": "example.com", "ip": "93.184.216.34"})),
            bytes_logged: None,
            truncated: None,
        };

        assert_eq!(entry.request_id, "req-789");
        assert_eq!(entry.message, "DNS lookup completed");
        assert_eq!(entry.elapsed_ms, Some(250));
        assert!(entry.details.is_some());
    }

    #[test]
    fn log_entry_minimal() {
        let entry = LogEntry {
            request_id: "req-101".to_string(),
            timestamp: "2025-01-01T00:00:00Z".to_string(),
            level: LogLevel::Info,
            info_type: None,
            message: "Request started".to_string(),
            category: None,
            phase: None,
            elapsed_ms: None,
            details: None,
            bytes_logged: None,
            truncated: None,
        };

        assert_eq!(entry.request_id, "req-101");
        assert!(entry.info_type.is_none());
        assert!(entry.details.is_none());
    }

    #[test]
    fn response_data_serialization() {
        let response = ResponseData {
            request_id: "req-serialize".to_string(),
            status: 201,
            status_text: "Created".to_string(),
            headers: vec![],
            cookies: vec![],
            body: vec![],
            file_path: None,
            size: 0,
            duration: 50,
            timestamp: "2025-01-01T00:00:00Z".to_string(),
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"status\":201"));
        assert!(json.contains("\"statusText\":\"Created\""));
        assert!(json.contains("\"requestId\":\"req-serialize\""));
    }

    #[test]
    fn cookie_clone_independence() {
        let cookie1 = Cookie {
            name: "cookie1".to_string(),
            value: "value1".to_string(),
            domain: Some("example.com".to_string()),
            ..Default::default()
        };

        let mut cookie2 = cookie1.clone();
        cookie2.name = "cookie2".to_string();

        assert_eq!(cookie1.name, "cookie1");
        assert_eq!(cookie2.name, "cookie2");
        assert_eq!(cookie1.domain, cookie2.domain);
    }
}
