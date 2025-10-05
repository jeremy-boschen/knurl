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
