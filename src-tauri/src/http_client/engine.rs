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

pub struct TauriLogEmitter {
    app_handle: tauri::AppHandle,
}

impl TauriLogEmitter {
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        Self { app_handle }
    }
}

impl LogEmitter for TauriLogEmitter {
    fn emit(&self, entry: LogEntry) {
        let _ = self.app_handle.emit("http-request-log", entry);
    }
}
