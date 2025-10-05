use serde::Serialize;
use std::collections::HashMap;
use std::fmt;
use std::panic::Location;

/// Well-defined error kinds for your application
#[derive(Debug, Clone, Serialize, PartialEq)]
// This is a noop, but here to clarify that we need to retain the case. This is also mirrored in
// the file /src/bindings/knurl.ts
#[serde(rename_all = "PascalCase")]
pub enum ErrorKind {
    // File system errors
    FileNotFound,
    InvalidPath,
    PermissionDenied,
    FileAlreadyExists,
    IoError,

    // Crypto errors
    InvalidKeyLength,
    DecryptionFailed,
    EncryptionFailed,

    // Keyring errors
    KeyringPlatformFailure,
    KeyringBadEncoding,
    KeyringAttributeInvalid,

    // Data format errors
    Base64Error,
    JsonError,

    // Generic Tauri error
    TauriError,

    // Network errors
    Timeout,
    ConnectionRefused,
    HttpError,

    // User-driven errors
    UserCancelled,
    BadRequest,
    NotImplemented,
}

/// Minimal backtrace information
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorTrace {
    pub source: Option<String>,
    pub cause: Option<String>,
    pub location: Option<String>,
}

/// Main error structure for your application
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub kind: ErrorKind,
    pub message: String,
    pub context: Option<HashMap<String, String>>,
    pub trace: Option<Box<ErrorTrace>>,
    pub timestamp: String,
}

impl AppError {
    /// Create a new error with just kind and message
    pub fn new(kind: ErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
            context: None,
            trace: None,
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }

    /// Create a new error with contextual metadata
    #[allow(dead_code)]
    pub fn with_context(
        kind: ErrorKind,
        message: impl Into<String>,
        context: HashMap<String, String>,
    ) -> Self {
        Self {
            kind,
            message: message.into(),
            context: Some(context),
            trace: None,
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }

    /// Add trace information
    pub fn with_trace(
        mut self,
        source: Option<String>,
        cause: Option<String>,
        location: Option<String>,
    ) -> Self {
        self.trace = Some(Box::new(ErrorTrace {
            source,
            cause,
            location,
        }));
        self
    }

    /// Create error from another error with automatic trace
    #[track_caller]
    pub fn from_error<E: std::error::Error>(
        kind: ErrorKind,
        err: E,
        context: Option<HashMap<String, String>>,
        location: &Location,
    ) -> Self {
        let message = err.to_string();
        let source = err.source().map(|s| s.to_string());
        let cause = Some(format!("{err:?}"));

        Self {
            kind,
            message,
            context,
            trace: Some(Box::new(ErrorTrace {
                source,
                cause,
                location: Some(location.to_string()),
            })),
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{:?}] {}", self.kind, self.message)
    }
}

impl std::error::Error for AppError {}

/// Macro for creating errors with location information
#[macro_export]
macro_rules! app_error {
    ($kind:expr, $msg:expr) => {
        AppError::new($kind, $msg).with_trace(
            None,
            None,
            Some(format!("{}:{}:{}", file!(), line!(), column!()))
        )
    };
    ($kind:expr, $msg:expr, $($key:expr => $value:expr),*) => {
        {
            let mut context = std::collections::HashMap::new();
            $(context.insert($key.to_string(), $value.to_string());)*
            AppError::with_context($kind, $msg, context).with_trace(
                None,
                None,
                Some(format!("{}:{}:{}", file!(), line!(), column!()))
            )
        }
    };
}

/// Conversion implementations for common error types
impl From<std::io::Error> for AppError {
    #[track_caller]
    fn from(err: std::io::Error) -> Self {
        let kind = match err.kind() {
            std::io::ErrorKind::NotFound => ErrorKind::FileNotFound,
            std::io::ErrorKind::PermissionDenied => ErrorKind::PermissionDenied,
            std::io::ErrorKind::AlreadyExists => ErrorKind::FileAlreadyExists,
            std::io::ErrorKind::TimedOut => ErrorKind::Timeout,
            std::io::ErrorKind::ConnectionRefused => ErrorKind::ConnectionRefused,
            _ => ErrorKind::IoError,
        };
        AppError::from_error(kind, err, None, Location::caller())
    }
}

impl From<serde_json::Error> for AppError {
    #[track_caller]
    fn from(err: serde_json::Error) -> Self {
        AppError::from_error(ErrorKind::JsonError, err, None, Location::caller())
    }
}

impl From<base64::DecodeError> for AppError {
    #[track_caller]
    fn from(err: base64::DecodeError) -> Self {
        AppError::from_error(ErrorKind::Base64Error, err, None, Location::caller())
    }
}

impl From<tauri::Error> for AppError {
    #[track_caller]
    fn from(err: tauri::Error) -> Self {
        AppError::from_error(ErrorKind::TauriError, err, None, Location::caller())
    }
}

// Specific error struct for user cancellation
pub struct UserCancelled;

impl From<UserCancelled> for AppError {
    fn from(_: UserCancelled) -> Self {
        AppError::new(
            ErrorKind::UserCancelled,
            "User cancelled the operation".to_string(),
        )
    }
}

// Removed curl-specific error conversion as Curl engine support is dropped.

#[cfg(test)]
mod tests {
    use super::{AppError, ErrorKind};
    use base64::Engine;
    use std::collections::HashMap;

    #[test]
    fn app_error_new_sets_kind_and_message() {
        let e = AppError::new(ErrorKind::BadRequest, "bad arg");
        assert_eq!(e.kind, ErrorKind::BadRequest);
        assert_eq!(e.message, "bad arg");
        assert!(e.context.is_none());
        assert!(e.trace.is_none());
        assert!(!e.timestamp.is_empty());
        assert!(format!("{e}").contains("BadRequest"));
    }

    #[test]
    fn app_error_with_context_and_trace() {
        let mut ctx = HashMap::new();
        ctx.insert("key".to_string(), "val".to_string());
        let e = AppError::with_context(ErrorKind::HttpError, "oops", ctx).with_trace(
            Some("src".into()),
            Some("cause".into()),
            Some("here".into()),
        );
        assert_eq!(e.kind, ErrorKind::HttpError);
        assert_eq!(e.message, "oops");
        assert!(e.context.as_ref().unwrap().contains_key("key"));
        let tr = e.trace.as_ref().unwrap();
        assert_eq!(tr.source.as_deref(), Some("src"));
        assert_eq!(tr.cause.as_deref(), Some("cause"));
        assert_eq!(tr.location.as_deref(), Some("here"));
    }

    #[test]
    fn app_error_from_error_populates_trace_and_kinds() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "nope");
        let app_err_from_io: AppError = io_err.into();
        assert_eq!(app_err_from_io.kind, ErrorKind::FileNotFound);
        assert!(app_err_from_io.trace.is_some());
        assert!(app_err_from_io.message.contains("nope"));

        let json_err: AppError = serde_json::from_str::<serde_json::Value>("not-json")
            .unwrap_err()
            .into();
        assert_eq!(json_err.kind, ErrorKind::JsonError);

        let b64_err: AppError = base64::engine::general_purpose::STANDARD
            .decode("@@@")
            .unwrap_err()
            .into();
        assert_eq!(b64_err.kind, ErrorKind::Base64Error);
    }
}
