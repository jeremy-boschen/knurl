use std::convert::TryFrom;
use std::sync::Arc;
use std::time::{Duration, Instant};

use bytes::Bytes;
use chrono::{SecondsFormat, Utc};
use futures_util::StreamExt;
use http_body_util::{BodyExt, Full};
use hyper::body::Incoming;
use hyper::http::{HeaderMap, HeaderName, HeaderValue, Uri};
use hyper::{Method, Request as HyperRequest, Response as HyperResponse, Version as HttpVersion};
use hyper_util::client::legacy::Client;
use hyper_util::client::legacy::connect::HttpInfo;
use hyper_util::rt::TokioExecutor;
use serde_json::{Value, json};
use std::panic::Location;
use tempfile::Builder as TempFileBuilder;
use tokio::time::timeout;

mod connector;

use crate::errors::{AppError, ErrorKind};
use crate::http_client::cookies::parse_set_cookie_header;
use crate::http_client::engine::{EngineFuture, HttpEngine, LogEmitter};
use crate::http_client::request::{HttpVersionPref, MultipartPart, Request};
use crate::http_client::response::{Cookie, LogEntry, LogLevel, ResponseData};

const DEFAULT_MAX_LOG_BYTES: usize = 128 * 1024;
const DEFAULT_HTTP_TIMEOUT: Duration = Duration::from_secs(30);

pub struct HyperEngine;

#[derive(Clone)]
pub(super) struct RequestLogger {
    emitter: Arc<dyn LogEmitter>,
    request_id: Arc<String>,
    start: Instant,
}

impl RequestLogger {
    fn new(emitter: Arc<dyn LogEmitter>, request_id: String, start: Instant) -> Self {
        Self {
            emitter,
            request_id: Arc::new(request_id),
            start,
        }
    }

    fn request_id(&self) -> &str {
        self.request_id.as_ref()
    }

    #[allow(clippy::too_many_arguments)]
    fn event(
        &self,
        level: LogLevel,
        category: &str,
        phase: Option<&str>,
        message: impl Into<String>,
        details: Option<Value>,
        bytes_logged: Option<u64>,
        truncated: Option<bool>,
    ) {
        let elapsed_ms = self.start.elapsed().as_millis() as u64;
        let info_type = phase
            .map(|p| p.to_string())
            .or_else(|| Some(category.to_string()));

        self.emitter.emit(LogEntry {
            request_id: self.request_id().to_string(),
            timestamp: Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
            level,
            info_type,
            message: message.into(),
            category: Some(category.to_string()),
            phase: phase.map(|p| p.to_string()),
            elapsed_ms: Some(elapsed_ms),
            details,
            bytes_logged,
            truncated,
        });
    }

    fn info(
        &self,
        category: &str,
        phase: Option<&str>,
        message: impl Into<String>,
        details: Option<Value>,
    ) {
        self.event(
            LogLevel::Info,
            category,
            phase,
            message,
            details,
            None,
            None,
        );
    }

    fn debug(
        &self,
        category: &str,
        phase: Option<&str>,
        message: impl Into<String>,
        details: Option<Value>,
    ) {
        self.event(
            LogLevel::Debug,
            category,
            phase,
            message,
            details,
            None,
            None,
        );
    }

    fn warn(
        &self,
        category: &str,
        phase: Option<&str>,
        message: impl Into<String>,
        details: Option<Value>,
    ) {
        self.event(
            LogLevel::Warning,
            category,
            phase,
            message,
            details,
            None,
            None,
        );
    }

    fn error(
        &self,
        category: &str,
        phase: Option<&str>,
        message: impl Into<String>,
        details: Option<Value>,
    ) {
        self.event(
            LogLevel::Error,
            category,
            phase,
            message,
            details,
            None,
            None,
        );
    }

    fn body(
        &self,
        category: &str,
        phase: &str,
        message: impl Into<String>,
        details: Option<Value>,
        bytes_logged: u64,
        truncated: bool,
    ) {
        self.event(
            LogLevel::Debug,
            category,
            Some(phase),
            message,
            details,
            Some(bytes_logged),
            Some(truncated),
        );
    }
}

impl HyperEngine {
    pub fn new() -> Self {
        Self
    }

    fn build_uri(req: &Request) -> Result<Uri, AppError> {
        req.url
            .parse::<Uri>()
            .map_err(|e| AppError::new(ErrorKind::BadRequest, format!("Invalid URL: {e}")))
    }

    fn parse_method(req: &Request) -> Result<Method, AppError> {
        req.method
            .parse::<Method>()
            .map_err(|e| AppError::new(ErrorKind::BadRequest, format!("Invalid HTTP method: {e}")))
    }

    fn build_headers(req: &Request) -> Result<HeaderMap, AppError> {
        let mut headers = HeaderMap::new();
        if let Some(map) = &req.headers {
            for (name, value) in map {
                let header_name = HeaderName::try_from(name.as_str()).map_err(|e| {
                    AppError::new(
                        ErrorKind::BadRequest,
                        format!("Invalid header name '{name}': {e}"),
                    )
                })?;
                let header_value = HeaderValue::try_from(value.as_str()).map_err(|e| {
                    AppError::new(
                        ErrorKind::BadRequest,
                        format!("Invalid header value for '{name}': {e}"),
                    )
                })?;
                headers.append(header_name, header_value);
            }
        }
        if let Some(ua) = &req.user_agent {
            headers.insert(
                hyper::header::USER_AGENT,
                HeaderValue::try_from(ua.as_str()).map_err(|e| {
                    AppError::new(
                        ErrorKind::BadRequest,
                        format!("Invalid User-Agent header: {e}"),
                    )
                })?,
            );
        } else {
            // Default User-Agent when not provided by the request
            let default_ua = format!("Knurl/{}", env!("CARGO_PKG_VERSION"));
            headers.insert(
                hyper::header::USER_AGENT,
                HeaderValue::try_from(default_ua.as_str()).map_err(|e| {
                    AppError::new(
                        ErrorKind::BadRequest,
                        format!("Invalid User-Agent header: {e}"),
                    )
                })?,
            );
        }
        Ok(headers)
    }

    fn sanitize_headers_for_h2(headers: &mut HeaderMap, prefer_h2: bool, allow_host: bool) {
        if !prefer_h2 {
            return;
        }
        for name in [
            HeaderName::from_static("connection"),
            HeaderName::from_static("proxy-connection"),
            HeaderName::from_static("keep-alive"),
            HeaderName::from_static("upgrade"),
            HeaderName::from_static("transfer-encoding"),
        ] {
            headers.remove(name);
        }
        if !allow_host {
            headers.remove(hyper::header::HOST);
        }
    }

    fn log_headers(
        logger: &RequestLogger,
        headers: &HeaderMap,
        redact: bool,
        phase: &str,
        prefix: &str,
    ) {
        for (name, value) in headers.iter() {
            let line = if redact {
                match name.as_str().to_ascii_lowercase().as_str() {
                    "authorization" | "cookie" | "set-cookie" => {
                        format!("{}: [REDACTED:{}]", name, value.as_bytes().len())
                    }
                    _ => Self::header_to_string(name, value),
                }
            } else {
                Self::header_to_string(name, value)
            };
            let is_redacted = redact
                && matches!(
                    name.as_str().to_ascii_lowercase().as_str(),
                    "authorization" | "cookie" | "set-cookie"
                );
            let detail = json!({
                "name": name.as_str(),
                "display": line,
                "length": value.as_bytes().len(),
                "redacted": is_redacted,
            });
            logger.debug(
                "http",
                Some(phase),
                format!("{prefix} {line}"),
                Some(detail),
            );
        }
    }

    fn header_to_string(name: &HeaderName, value: &HeaderValue) -> String {
        match value.to_str() {
            Ok(v) => format!("{name}: {v}"),
            Err(_) => format!("{}: <binary:{} bytes>", name, value.as_bytes().len()),
        }
    }

    fn log_body(
        logger: &RequestLogger,
        category: &str,
        phase: &str,
        body: &[u8],
        max: usize,
        prefix: &str,
    ) {
        if body.is_empty() {
            return;
        }
        let truncated = body.len() > max;
        let logged_len = body.len().min(max);
        let preview = match std::str::from_utf8(&body[..logged_len]) {
            Ok(text) if !truncated => text.to_string(),
            Ok(text) => format!("{text}…"),
            Err(_) => format!(
                "<binary:{} bytes{}>",
                body.len(),
                if truncated { ", truncated" } else { "" }
            ),
        };
        let message = format!("{prefix} {preview}");
        let detail = json!({
            "size": body.len(),
            "loggedBytes": logged_len,
            "truncated": truncated,
            "preview": preview,
        });

        logger.body(
            category,
            phase,
            message,
            Some(detail),
            logged_len as u64,
            truncated,
        );
    }

    fn build_body(req: &Request, headers: &mut HeaderMap) -> Result<Bytes, AppError> {
        if let Some(parts) = &req.multipart_parts {
            // Build multipart/form-data body with boundary
            let crlf = "\r\n";

            // 1) Determine boundary and ensure Content-Type header correctness
            let ct_name = hyper::header::CONTENT_TYPE;
            let mut boundary: Option<String> = None;
            if let Some(val) = headers.get(&ct_name)
                && let Ok(s) = val.to_str()
            {
                let lower = s.to_ascii_lowercase();
                if lower.contains("multipart/form-data") {
                    // Try to parse boundary parameter
                    if let Some(idx) = lower.find("boundary=") {
                        let raw = &s[idx + "boundary=".len()..];
                        let candidate =
                            raw.split(';').next().unwrap_or("").trim().trim_matches('"');
                        if !candidate.is_empty() {
                            boundary = Some(candidate.to_string());
                        }
                    }
                }
            }
            // Generate boundary if none was provided
            let boundary = boundary.unwrap_or_else(|| {
                format!("----KnurlFormBoundary{}", uuid::Uuid::new_v4().simple())
            });

            // If header missing or non-multipart, set to multipart with boundary. If multipart but missing boundary, append it.
            let mut set_header = true;
            if let Some(val) = headers.get(&ct_name)
                && let Ok(s) = val.to_str()
            {
                let lower = s.to_ascii_lowercase();
                if lower.contains("multipart/form-data") {
                    if lower.contains("boundary=") {
                        set_header = false; // Already has matching boundary; keep as-is
                    } else {
                        let new_val = format!("{s}; boundary={boundary}");
                        headers.insert(
                            &ct_name,
                            HeaderValue::try_from(new_val.as_str()).map_err(|e| {
                                AppError::new(
                                    ErrorKind::BadRequest,
                                    format!("Invalid header value: {e}"),
                                )
                            })?,
                        );
                        set_header = false;
                    }
                }
            }
            if set_header {
                let v = format!("multipart/form-data; boundary={}", &boundary);
                headers.insert(
                    &ct_name,
                    HeaderValue::try_from(v.as_str()).map_err(|e| {
                        AppError::new(ErrorKind::BadRequest, format!("Invalid header value: {e}"))
                    })?,
                );
            }

            // 2) Assemble body using the final boundary
            let mut buf: Vec<u8> = Vec::new();
            for part in parts {
                buf.extend_from_slice(format!("--{}{}", &boundary, crlf).as_bytes());
                match part {
                    MultipartPart::Text { name, value } => {
                        let header = format!(
                            "Content-Disposition: form-data; name=\"{}\"{}{}",
                            name.replace('"', "\\\""),
                            crlf,
                            crlf,
                        );
                        buf.extend_from_slice(header.as_bytes());
                        buf.extend_from_slice(value.as_bytes());
                        buf.extend_from_slice(crlf.as_bytes());
                    }
                    MultipartPart::File {
                        name,
                        file_path,
                        file_name,
                        content_type,
                    } => {
                        let file_name = file_name.clone().unwrap_or_else(|| {
                            std::path::Path::new(file_path)
                                .file_name()
                                .map(|s| s.to_string_lossy().to_string())
                                .unwrap_or_else(|| "file".to_string())
                        });
                        // RFC 5987 filename* support for non-ASCII
                        let needs_rfc5987 = !file_name.is_ascii();
                        let ascii_filename = file_name.replace('"', "\\\"");
                        let filename_star = if needs_rfc5987 {
                            use percent_encoding::{NON_ALPHANUMERIC, utf8_percent_encode};
                            let enc = utf8_percent_encode(&file_name, NON_ALPHANUMERIC).to_string();
                            Some(format!("; filename*={}''{}", "UTF-8", enc))
                        } else {
                            None
                        };

                        // Guess content type if not provided
                        let ct = match content_type.clone() {
                            Some(s) if !s.trim().is_empty() => s,
                            _ => mime_guess::from_path(&file_name)
                                .first_or_octet_stream()
                                .essence_str()
                                .to_string(),
                        };

                        let disposition = format!(
                            "Content-Disposition: form-data; name=\"{}\"; filename=\"{}\"{}{}",
                            name.replace('"', "\\\""),
                            ascii_filename,
                            filename_star.as_deref().unwrap_or(""),
                            crlf,
                        );
                        let header = format!("{disposition}Content-Type: {ct}{crlf}{crlf}",);
                        buf.extend_from_slice(header.as_bytes());
                        let file_bytes = std::fs::read(file_path).map_err(|e| {
                            AppError::new(
                                ErrorKind::IoError,
                                format!("Failed to read file '{file_path}': {e}"),
                            )
                        })?;
                        buf.extend_from_slice(&file_bytes);
                        buf.extend_from_slice(crlf.as_bytes());
                    }
                }
            }
            buf.extend_from_slice(format!("--{}--{}", &boundary, crlf).as_bytes());

            return Ok(Bytes::from(buf));
        }
        if let Some(path) = &req.body_file_path {
            // If no Content-Type header is set, try to guess based on filename
            let ct_header = hyper::header::CONTENT_TYPE;
            if !headers.contains_key(&ct_header)
                && let Some(ext_ct) = mime_guess::from_path(path).first()
            {
                let ct_val = HeaderValue::try_from(ext_ct.essence_str()).map_err(|e| {
                    AppError::new(ErrorKind::BadRequest, format!("Invalid header value: {e}"))
                })?;
                headers.insert(ct_header, ct_val);
            }
            let data = std::fs::read(path).map_err(|e| {
                AppError::new(
                    ErrorKind::IoError,
                    format!("Failed to read body file '{path}': {e}"),
                )
            })?;
            return Ok(Bytes::from(data));
        }
        Ok(req.body.clone().map(Bytes::from).unwrap_or_default())
    }

    fn cookies_from_headers(headers: &HeaderMap) -> Vec<Cookie> {
        headers
            .get_all(hyper::header::SET_COOKIE)
            .iter()
            .filter_map(|value| value.to_str().ok())
            .filter_map(parse_set_cookie_header)
            .collect()
    }

    fn max_log_bytes(req: &Request) -> usize {
        req.max_log_bytes.unwrap_or(DEFAULT_MAX_LOG_BYTES)
    }
}

fn format_http_version(version: HttpVersion) -> &'static str {
    match version {
        hyper::Version::HTTP_09 => "HTTP/0.9",
        hyper::Version::HTTP_10 => "HTTP/1.0",
        hyper::Version::HTTP_11 => "HTTP/1.1",
        hyper::Version::HTTP_2 => "HTTP/2",
        hyper::Version::HTTP_3 => "HTTP/3",
        _ => "HTTP",
    }
}

impl HttpEngine for HyperEngine {
    fn execute(&self, request: Request, emitter: Arc<dyn LogEmitter>) -> EngineFuture {
        Box::pin(async move {
            let request_id = request.request_id.clone();
            let uri = Self::build_uri(&request)?;
            let method = Self::parse_method(&request)?;
            let mut headers = Self::build_headers(&request)?;
            let body = Self::build_body(&request, &mut headers)?;
            let timeout_secs = request
                .timeout_secs
                .unwrap_or(DEFAULT_HTTP_TIMEOUT.as_secs());
            let max_log_bytes = Self::max_log_bytes(&request);

            let logger = RequestLogger::new(emitter.clone(), request_id.clone(), Instant::now());

            logger.info(
                "engine",
                Some("init"),
                "Using hyper engine",
                Some(json!({"engine": "hyper"})),
            );
            logger.info(
                "connect",
                Some("policy"),
                "Connection reuse disabled (no pooling)",
                Some(json!({"poolMaxIdlePerHost": 0})),
            );
            logger.info(
                "flow",
                Some("request_start"),
                format!("Starting request {method} {uri}"),
                None,
            );
            logger.info(
                "http",
                Some("request"),
                format!("{method} {uri}"),
                Some(json!({
                    "method": method.as_str(),
                    "uri": uri.to_string(),
                })),
            );
            logger.debug(
                "http",
                Some("request_line"),
                format!("> {method} {uri} HTTP/1.1"),
                None,
            );
            Self::log_headers(
                &logger,
                &headers,
                request.redact_sensitive.unwrap_or(false),
                "request_header",
                ">",
            );
            if request.log_bodies.unwrap_or(true) {
                Self::log_body(
                    &logger,
                    "request_body",
                    "body",
                    &body,
                    max_log_bytes,
                    "> body:",
                );
            }

            // Sanitize headers for HTTP/2 if preference allows it (auto/http2)
            let prefer_h2 = !matches!(request.http_version, Some(HttpVersionPref::Http1));
            let allow_host = matches!(request.http_version, Some(HttpVersionPref::Http1))
                || request.host_override.is_some();
            Self::sanitize_headers_for_h2(&mut headers, prefer_h2, allow_host);

            let host_header_value =
                connector::compute_host_header(request.host_override.as_deref(), uri.host());

            let mut builder = HyperRequest::builder()
                .method(method.clone())
                .uri(uri.clone());
            {
                let headers_mut = builder.headers_mut().ok_or_else(|| {
                    AppError::new(ErrorKind::BadRequest, "Failed to build request headers")
                })?;
                for (name, value) in headers.iter() {
                    headers_mut.append(name.clone(), value.clone());
                }
                // Only inject Host header when explicitly needed:
                // - If httpVersion is forced to http1 (absolute-form requires Host)
                // - Or when a host override is provided.
                let force_http1 = matches!(request.http_version, Some(HttpVersionPref::Http1));
                let mut injected_host = false;
                if (force_http1 || request.host_override.is_some())
                    && !headers_mut.contains_key(hyper::header::HOST)
                    && let Some(host) = host_header_value.as_deref()
                {
                    let host_value = HeaderValue::try_from(host).map_err(|e| {
                        AppError::new(ErrorKind::BadRequest, format!("Invalid host header: {e}"))
                    })?;
                    headers_mut.insert(hyper::header::HOST, host_value);
                    injected_host = true;
                }
                // Emit resolved host header log including whether we injected Host
                if let Some(host_val) = host_header_value.as_deref() {
                    logger.info(
                        "dns",
                        Some("host_header"),
                        format!("Resolved host header: {host_val}"),
                        Some(json!({"host": host_val, "injected": injected_host})),
                    );
                }
            }
            // Log a concise pre-send summary (helps correlate h2 failures)
            logger.info(
                "http",
                Some("about_to_send"),
                format!("Sending request {method} {uri}"),
                Some(json!({
                    "method": method.as_str(),
                    "uri": uri.to_string(),
                    "httpVersionPref": request.http_version.as_ref().map(|v| match v { HttpVersionPref::Auto => "auto", HttpVersionPref::Http1 => "http1", HttpVersionPref::Http2 => "http2" }),
                })),
            );

            if request.disable_ssl.unwrap_or(false) {
                logger.warn("tls", Some("config"), "TLS verification disabled", None);
            }
            if let Some(ca) = &request.ca_path {
                logger.info(
                    "tls",
                    Some("config"),
                    format!("Using custom CA bundle: {ca}"),
                    Some(json!({"caPath": ca})),
                );
            }
            // (host_header log moved above to include injected flag)

            let connector = connector::build_connector(&request, &uri, logger.clone())?;

            let mut client_builder = Client::builder(TokioExecutor::new());
            // Ensure no idle connection reuse between requests
            client_builder.pool_max_idle_per_host(0);
            client_builder.http2_adaptive_window(true);
            let client: Client<_, Full<Bytes>> = client_builder.build(connector);

            let mut current_uri = uri.clone();
            let mut current_method = method.clone();
            let mut current_body = body.clone();
            let mut redirects_left = request.max_redirects.unwrap_or(0);
            let start = Instant::now();

            // Redirect-following loop
            let response = loop {
                let mut req_builder = HyperRequest::builder()
                    .method(current_method.clone())
                    .uri(current_uri.clone());
                {
                    let headers_mut = req_builder.headers_mut().ok_or_else(|| {
                        AppError::new(ErrorKind::BadRequest, "Failed to build request headers")
                    })?;
                    for (name, value) in headers.iter() {
                        headers_mut.append(name.clone(), value.clone());
                    }
                }
                let req_body = Full::from(current_body.clone());
                let hyper_req = req_builder.body(req_body).map_err(|e| {
                    AppError::new(
                        ErrorKind::BadRequest,
                        format!("Failed to build request: {e}"),
                    )
                })?;

                let call = client.request(hyper_req);

                let response = match timeout(Duration::from_secs(timeout_secs), call).await {
                    Ok(Ok(res)) => {
                        logger.debug("http", Some("sent"), "Request completely sent off", None);
                        res
                    }
                    Ok(Err(err)) => {
                        let disp = err.to_string();
                        let dbg = format!("{err:?}");
                        let combined = format!("{disp} | {dbg}").to_lowercase();
                        // Optional HTTP/2 -> HTTP/1.1 fallback on PROTOCOL_ERROR/RESET if preference allows
                        let version_pref = request
                            .http_version
                            .clone()
                            .unwrap_or(HttpVersionPref::Auto);
                        let can_fallback =
                            matches!(version_pref, HttpVersionPref::Auto | HttpVersionPref::Http2)
                                && (combined.contains("http2") || combined.contains("h2"))
                                && (combined.contains("protocol_error")
                                    || combined.contains("protocol error")
                                    || combined.contains("reset"));
                        if can_fallback {
                            logger.warn(
                                "http2",
                                Some("fallback"),
                                "HTTP/2 PROTOCOL_ERROR detected; retrying with HTTP/1.1",
                                Some(json!({
                                    "error": disp,
                                    "debug": dbg,
                                    "method": method.as_str(),
                                    "uri": uri.to_string(),
                                })),
                            );

                            // Build a new connector that offers only HTTP/1.1
                            let mut fb_request = request.clone();
                            fb_request.http_version = Some(HttpVersionPref::Http1);
                            let fb_connector =
                                connector::build_connector(&fb_request, &uri, logger.clone())?;

                            let mut fb_client_builder = Client::builder(TokioExecutor::new());
                            fb_client_builder.pool_max_idle_per_host(0);
                            fb_client_builder.http2_adaptive_window(true);
                            let fb_client: Client<_, Full<Bytes>> =
                                fb_client_builder.build(fb_connector);

                            // Rebuild request
                            let mut fb_builder = HyperRequest::builder()
                                .method(method.clone())
                                .uri(uri.clone());
                            {
                                let headers_mut = fb_builder.headers_mut().ok_or_else(|| {
                                    AppError::new(
                                        ErrorKind::BadRequest,
                                        "Failed to build request headers",
                                    )
                                })?;
                                for (name, value) in headers.iter() {
                                    headers_mut.append(name.clone(), value.clone());
                                }
                                if !headers_mut.contains_key(hyper::header::HOST)
                                    && let Some(host) = connector::compute_host_header(
                                        fb_request.host_override.as_deref(),
                                        uri.host(),
                                    )
                                {
                                    let host_value = HeaderValue::try_from(host).map_err(|e| {
                                        AppError::new(
                                            ErrorKind::BadRequest,
                                            format!("Invalid host header: {e}"),
                                        )
                                    })?;
                                    headers_mut.insert(hyper::header::HOST, host_value);
                                }
                            }
                            let fb_request =
                                fb_builder.body(Full::from(body.clone())).map_err(|e| {
                                    AppError::new(
                                        ErrorKind::BadRequest,
                                        format!("Failed to build request: {e}"),
                                    )
                                })?;

                            // The result of this match is the value of this arm (Response)
                            match timeout(
                                Duration::from_secs(timeout_secs),
                                fb_client.request(fb_request),
                            )
                            .await
                            {
                                Ok(Ok(res)) => {
                                    logger.info(
                                        "http2",
                                        Some("fallback_ok"),
                                        "Fallback to HTTP/1.1 succeeded",
                                        None,
                                    );
                                    res
                                }
                                Ok(Err(err2)) => {
                                    logger.error(
                                        "http",
                                        Some("error"),
                                        format!("Request failed after fallback: {err2}"),
                                        Some(json!({"error": err2.to_string(), "fallback": true})),
                                    );
                                    let mut ctx = std::collections::HashMap::new();
                                    ctx.insert("method".to_string(), method.as_str().to_string());
                                    ctx.insert("uri".to_string(), uri.to_string());
                                    ctx.insert("engine".to_string(), "hyper".to_string());
                                    ctx.insert("httpVersion".to_string(), "http1".to_string());
                                    return Err(AppError::from_error(
                                        ErrorKind::HttpError,
                                        err2,
                                        Some(ctx),
                                        std::panic::Location::caller(),
                                    ));
                                }
                                Err(_) => {
                                    logger.error(
                                    "http",
                                    Some("timeout"),
                                    format!("Request timed out after {timeout_secs}s (fallback)"),
                                    Some(json!({"timeoutSeconds": timeout_secs, "fallback": true})),
                                );
                                    let mut ctx = std::collections::HashMap::new();
                                    ctx.insert("method".to_string(), method.as_str().to_string());
                                    ctx.insert("uri".to_string(), uri.to_string());
                                    ctx.insert("engine".to_string(), "hyper".to_string());
                                    ctx.insert("httpVersion".to_string(), "http1".to_string());
                                    return Err(AppError::with_context(
                                        ErrorKind::Timeout,
                                        "Request timed out",
                                        ctx,
                                    )
                                    .with_trace(
                                        None,
                                        None,
                                        Some(format!("{}:{}:{}", file!(), line!(), column!())),
                                    ));
                                }
                            }
                        } else {
                            logger.error(
                                "http",
                                Some("error"),
                                format!("Request failed: {err}"),
                                Some(json!({
                                    "error": err.to_string(),
                                    "method": method.as_str(),
                                    "uri": uri.to_string(),
                                    "hostOverride": request.host_override,
                                    "ipOverride": request.ip_override,
                                    "disableSsl": request.disable_ssl,
                                    "caPath": request.ca_path,
                                    "timeoutSecs": timeout_secs,
                                    "userAgent": request.user_agent,
                                })),
                            );

                            let mut ctx = std::collections::HashMap::new();
                            ctx.insert("method".to_string(), method.as_str().to_string());
                            ctx.insert("uri".to_string(), uri.to_string());
                            if let Some(h) = request.host_override.clone() {
                                ctx.insert("hostOverride".to_string(), h);
                            }
                            if let Some(ip) = request.ip_override.clone() {
                                ctx.insert("ipOverride".to_string(), ip);
                            }
                            if let Some(disable) = request.disable_ssl {
                                ctx.insert("disableSsl".to_string(), disable.to_string());
                            }
                            if let Some(ca) = request.ca_path.clone() {
                                ctx.insert("caPath".to_string(), ca);
                            }
                            ctx.insert("timeoutSecs".to_string(), timeout_secs.to_string());
                            if let Some(ua) = request.user_agent.clone() {
                                ctx.insert("userAgent".to_string(), ua);
                            }
                            ctx.insert("engine".to_string(), "hyper".to_string());

                            return Err(AppError::from_error(
                                ErrorKind::HttpError,
                                err,
                                Some(ctx),
                                std::panic::Location::caller(),
                            ));
                        }
                    }
                    Err(_) => {
                        logger.error(
                            "http",
                            Some("timeout"),
                            format!("Request timed out after {timeout_secs}s"),
                            Some(json!({
                                "timeoutSeconds": timeout_secs,
                                "method": method.as_str(),
                                "uri": uri.to_string(),
                                "hostOverride": request.host_override,
                                "ipOverride": request.ip_override,
                                "disableSsl": request.disable_ssl,
                                "caPath": request.ca_path,
                                "userAgent": request.user_agent,
                            })),
                        );

                        let mut ctx = std::collections::HashMap::new();
                        ctx.insert("method".to_string(), method.as_str().to_string());
                        ctx.insert("uri".to_string(), uri.to_string());
                        if let Some(h) = request.host_override.clone() {
                            ctx.insert("hostOverride".to_string(), h);
                        }
                        if let Some(ip) = request.ip_override.clone() {
                            ctx.insert("ipOverride".to_string(), ip);
                        }
                        if let Some(disable) = request.disable_ssl {
                            ctx.insert("disableSsl".to_string(), disable.to_string());
                        }
                        if let Some(ca) = request.ca_path.clone() {
                            ctx.insert("caPath".to_string(), ca);
                        }
                        ctx.insert("timeoutSecs".to_string(), timeout_secs.to_string());
                        if let Some(ua) = request.user_agent.clone() {
                            ctx.insert("userAgent".to_string(), ua);
                        }
                        ctx.insert("engine".to_string(), "hyper".to_string());

                        return Err(AppError::with_context(
                            ErrorKind::Timeout,
                            "Request timed out",
                            ctx,
                        )
                        .with_trace(
                            None,
                            None,
                            Some(format!("{}:{}:{}", file!(), line!(), column!())),
                        ));
                    }
                };

                // Check for redirect
                let status = response.status();
                if redirects_left == 0 || !(300..400).contains(&status.as_u16()) {
                    break response;
                }
                let location = response
                    .headers()
                    .get(hyper::header::LOCATION)
                    .and_then(|v| v.to_str().ok());
                if let Some(loc) = location {
                    // Resolve relative to current_uri
                    let next_uri = if let Ok(abs) = loc.parse::<Uri>() {
                        abs
                    } else {
                        // Build relative against current
                        let base = current_uri.to_string();
                        let join = if let Some(pos) = base.rfind('/') {
                            format!("{}{}", &base[..=pos], loc)
                        } else {
                            loc.to_string()
                        };
                        match join.parse::<Uri>() {
                            Ok(u) => u,
                            Err(_) => break response,
                        }
                    };
                    // Adjust method per RFC: 303 -> GET, 301/302 for non-GET/HEAD may switch to GET (common browser behavior)
                    let next_method = match status.as_u16() {
                        303 => Method::GET,
                        301 | 302 => {
                            if current_method == Method::GET || current_method == Method::HEAD {
                                current_method.clone()
                            } else {
                                Method::GET
                            }
                        }
                        307 | 308 => current_method.clone(),
                        _ => current_method.clone(),
                    };
                    // Clear body on GET/HEAD
                    if next_method == Method::GET || next_method == Method::HEAD {
                        current_body = Bytes::new();
                    }
                    // Conservative header policy on cross-origin redirects: strip sensitive headers
                    let origin_changed = current_uri.scheme_str() != next_uri.scheme_str()
                        || current_uri.host() != next_uri.host()
                        || current_uri.port_u16() != next_uri.port_u16();
                    if origin_changed {
                        for name in [
                            HeaderName::from_static("authorization"),
                            HeaderName::from_static("proxy-authorization"),
                            HeaderName::from_static("cookie"),
                        ] {
                            let _ = headers.remove(name);
                        }
                        logger.info(
                            "http",
                            Some("redirect_headers"),
                            "Stripped Authorization/Cookie headers due to cross-origin redirect",
                            Some(json!({
                                "from": current_uri.to_string(),
                                "to": next_uri.to_string(),
                            })),
                        );
                    }
                    logger.info(
                        "http",
                        Some("redirect"),
                        format!("{current_uri} -> {next_uri}"),
                        Some(json!({"status": status.as_u16(), "remaining": redirects_left - 1})),
                    );
                    current_uri = next_uri;
                    current_method = next_method;
                    redirects_left -= 1;
                    continue;
                } else {
                    break response;
                }
            };

            Self::handle_response(
                response,
                request.redact_sensitive.unwrap_or(false),
                request.log_bodies.unwrap_or(true),
                max_log_bytes,
                logger,
                uri.host().map(|h| h.to_string()),
                request.preview_max_bytes,
                start,
            )
            .await
        })
    }
}

impl HyperEngine {
    #[allow(clippy::too_many_arguments)]
    async fn handle_response(
        response: HyperResponse<Incoming>,
        redact: bool,
        log_bodies: bool,
        max_log_bytes: usize,
        logger: RequestLogger,
        request_host: Option<String>,
        preview_max_bytes: Option<u64>,
        start: Instant,
    ) -> Result<ResponseData, AppError> {
        let (parts, body_stream) = response.into_parts();
        let status = parts.status;

        let version_label = format_http_version(parts.version);
        logger.info(
            "http",
            Some("response"),
            format!(
                "< {} {} {}",
                version_label,
                status.as_u16(),
                status.canonical_reason().unwrap_or("")
            ),
            Some(json!({
                "status": status.as_u16(),
                "reason": status.canonical_reason().unwrap_or(""),
                "version": version_label,
            })),
        );

        Self::log_headers(&logger, &parts.headers, redact, "response_header", "<");

        if let Some(info) = parts.extensions.get::<HttpInfo>() {
            logger.info(
                "connect",
                Some("established"),
                format!("Connected to {}", info.remote_addr()),
                Some(json!({
                    "remoteAddr": info.remote_addr().to_string(),
                    "localAddr": info.local_addr().to_string(),
                })),
            );
        }

        // Unified streaming: accumulate until threshold, then spill to temp file
        let content_length = parts
            .headers
            .get(hyper::header::CONTENT_LENGTH)
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0);
        let stream_to_file_threshold: u64 = preview_max_bytes.unwrap_or(20 * 1024 * 1024);
        let mut size: u64 = 0;
        let mut s = body_stream.into_data_stream();
        let mut temp: Option<tempfile::NamedTempFile> = None;
        let mut body_buf: Vec<u8> = Vec::new();
        let mut write_to_file = content_length > stream_to_file_threshold;
        while let Some(chunk) = s.next().await {
            let bytes = chunk
                .map_err(|e| AppError::new(ErrorKind::HttpError, format!("Body error: {e}")))?;
            if log_bodies {
                Self::log_body(
                    &logger,
                    "response_body",
                    "body",
                    &bytes,
                    max_log_bytes,
                    "< body:",
                );
            }
            size += bytes.len() as u64;
            if write_to_file || size > stream_to_file_threshold {
                if temp.is_none() {
                    // Initialize temp and flush any buffered bytes
                    let mut t =
                        TempFileBuilder::new()
                            .prefix("knurl-")
                            .tempfile()
                            .map_err(|e| {
                                AppError::from_error(
                                    ErrorKind::IoError,
                                    e,
                                    None,
                                    Location::caller(),
                                )
                            })?;
                    if !body_buf.is_empty() {
                        use std::io::Write;
                        t.write_all(&body_buf).map_err(|e| {
                            AppError::from_error(ErrorKind::IoError, e, None, Location::caller())
                        })?;
                        body_buf.clear();
                    }
                    temp = Some(t);
                    write_to_file = true;
                }
                use std::io::Write;
                temp.as_mut().unwrap().write_all(&bytes).map_err(|e| {
                    AppError::from_error(ErrorKind::IoError, e, None, Location::caller())
                })?;
            } else {
                body_buf.extend_from_slice(&bytes);
            }
        }

        // body already logged per chunk above when log_bodies is true

        let cookies = Self::cookies_from_headers(&parts.headers);

        for cookie in &cookies {
            let effective_domain = cookie
                .domain
                .clone()
                .filter(|value| !value.is_empty())
                .or_else(|| request_host.clone());
            let domain_display = effective_domain
                .clone()
                .unwrap_or_else(|| "<unspecified>".to_string());
            let path = cookie.path.as_deref().unwrap_or("/").to_string();
            let expiry = cookie
                .expires
                .clone()
                .or_else(|| cookie.max_age.map(|age| age.to_string()))
                .unwrap_or_else(|| "0".to_string());

            logger.debug(
                "cookie",
                Some("set"),
                format!(
                    "Added cookie {}=\"{}\" for domain {}, path {}, expire {}",
                    cookie.name.as_str(),
                    cookie.value.as_str(),
                    domain_display.as_str(),
                    path.as_str(),
                    expiry
                ),
                Some(json!({
                    "name": cookie.name.clone(),
                    "value": cookie.value.clone(),
                    "domain": cookie.domain.clone(),
                    "effectiveDomain": domain_display,
                    "path": path,
                    "expires": cookie.expires.clone(),
                    "maxAge": cookie.max_age,
                    "secure": cookie.secure,
                    "httpOnly": cookie.http_only,
                    "sameSite": cookie.same_site.clone(),
                })),
            );
        }

        let duration_ms = start.elapsed().as_millis() as u64;
        logger.debug(
            "metrics",
            Some("duration"),
            format!("Request completed in {duration_ms} ms"),
            Some(json!({"durationMs": duration_ms})),
        );
        logger.debug(
            "connect",
            Some("shutdown"),
            "Shutting down connection",
            None,
        );
        let headers_vec = parts
            .headers
            .iter()
            .map(|(name, value)| (name.to_string(), value.to_str().unwrap_or("").to_string()))
            .collect::<Vec<_>>();
        let (body_vec, file_path, reported_size) = if let Some(t) = temp {
            let (_file, path) = t.keep().map_err(|e| {
                AppError::from_error(ErrorKind::IoError, e.error, None, Location::caller())
            })?;
            (Vec::new(), Some(path.to_string_lossy().to_string()), size)
        } else {
            (body_buf, None, size)
        };

        Ok(ResponseData {
            request_id: logger.request_id().to_string(),
            status: status.as_u16(),
            status_text: status.canonical_reason().unwrap_or("").to_string(),
            headers: headers_vec,
            cookies,
            body: body_vec,
            file_path,
            size: reported_size,
            duration: duration_ms,
            timestamp: Utc::now().to_rfc3339(),
        })
    }
}
