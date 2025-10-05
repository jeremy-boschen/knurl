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
#[derive(Debug, Serialize, Clone)]
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
