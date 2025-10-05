use crate::errors::{AppError, ErrorKind};
use crate::http_client::engine::{HttpEngine, LogEmitter, TauriLogEmitter};
use crate::http_client::hyper_engine::HyperEngine;
use crate::http_client::request::Request;
use crate::http_client::response::{LogEntry, LogLevel, ResponseData};
use base64::{Engine as _, engine::general_purpose};
use chrono::{SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::AppHandle;

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AuthConfig {
    None,
    Inherit,
    Basic {
        username: Option<String>,
        password: Option<String>,
    },
    Bearer {
        token: Option<String>,
        // Optional scheme for Authorization header (e.g., "Bearer", "JWT", or custom)
        scheme: Option<String>,
        placement: Option<AuthPlacement>,
    },
    ApiKey {
        key: Option<String>,
        value: Option<String>,
        placement: Option<AuthPlacement>,
    },
    #[serde(rename_all = "camelCase")]
    Oauth2 {
        grant_type: String,
        auth_url: Option<String>,
        token_url: Option<String>,
        client_id: Option<String>,
        client_secret: Option<String>,
        scope: Option<String>,
        refresh_token: Option<String>,
        token_caching: Option<TokenCachingPolicy>,
        client_auth: Option<ClientAuth>,
        token_extra_params: Option<HashMap<String, String>>,
    },
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TokenCachingPolicy {
    Always,
    Never,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ClientAuth {
    Basic,
    Body,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthPlacement {
    pub r#type: String,
    pub name: Option<String>,
    pub field_name: Option<String>,
    pub content_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AuthResult {
    pub headers: Option<HashMap<String, String>>,
    pub query: Option<HashMap<String, String>>,
    pub cookies: Option<HashMap<String, String>>,
    pub body: Option<HashMap<String, serde_json::Value>>,
    pub expires_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OidcDiscovery {
    pub authorization_endpoint: Option<String>,
    pub token_endpoint: Option<String>,
    pub device_authorization_endpoint: Option<String>,
}

// Wire format from remote OIDC server (snake_case per spec). Not sent to frontend.
#[derive(Debug, Deserialize)]
struct OidcDiscoveryWire {
    authorization_endpoint: Option<String>,
    token_endpoint: Option<String>,
    device_authorization_endpoint: Option<String>,
}

// Wire format for OAuth2 token response per RFC (snake_case). Not sent to frontend.
#[derive(Debug, Deserialize)]
struct TokenResponseWire {
    access_token: String,
    expires_in: Option<u64>,
    token_type: String,
}

fn parse_token_response_body(body: &[u8]) -> Result<TokenResponseWire, AppError> {
    // First try JSON (accept both snake_case and camelCase keys)
    let as_str = std::str::from_utf8(body).unwrap_or("");
    if let Ok(value) = serde_json::from_slice::<serde_json::Value>(body) {
        // Error shape from RFC: {"error":"...","error_description":"..."}
        if let Some(err) = value.get("error").and_then(|v| v.as_str()) {
            let desc = value
                .get("error_description")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            return Err(AppError::new(
                ErrorKind::BadRequest,
                format!(
                    "OAuth token error: {}{}",
                    err,
                    if desc.is_empty() {
                        "".to_string()
                    } else {
                        format!(" – {desc}")
                    }
                ),
            ));
        }
        let at = value
            .get("access_token")
            .or_else(|| value.get("accessToken"))
            .and_then(|v| v.as_str());
        let tt = value
            .get("token_type")
            .or_else(|| value.get("tokenType"))
            .and_then(|v| v.as_str());
        let ei = value
            .get("expires_in")
            .or_else(|| value.get("expiresIn"))
            .and_then(|v| {
                v.as_u64()
                    .or_else(|| v.as_str().and_then(|s| s.parse::<u64>().ok()))
            });
        if let (Some(access_token), Some(token_type)) = (at, tt) {
            return Ok(TokenResponseWire {
                access_token: access_token.to_string(),
                token_type: token_type.to_string(),
                expires_in: ei,
            });
        }
        // If JSON parsed but required fields missing, fall through to urlencoded parser
    }

    // Try application/x-www-form-urlencoded
    if let Ok(form_map) =
        serde_urlencoded::from_bytes::<std::collections::HashMap<String, String>>(body)
    {
        let at = form_map
            .get("access_token")
            .or_else(|| form_map.get("accessToken"))
            .cloned();
        let tt = form_map
            .get("token_type")
            .or_else(|| form_map.get("tokenType"))
            .cloned();
        let ei = form_map
            .get("expires_in")
            .or_else(|| form_map.get("expiresIn"))
            .and_then(|s| s.parse::<u64>().ok());
        if let (Some(access_token), Some(token_type)) = (at, tt) {
            return Ok(TokenResponseWire {
                access_token,
                token_type,
                expires_in: ei,
            });
        }
    }

    Err(AppError::new(
        ErrorKind::JsonError,
        format!(
            "Failed to parse token response: missing fields. Body ({} bytes) begins: {}",
            body.len(),
            &as_str.chars().take(120).collect::<String>()
        ),
    ))
}

fn log_token_response_metadata(emitter: &dyn LogEmitter, request_id: &str, resp: &ResponseData) {
    // Avoid logging raw body to reduce token exposure; include meta only
    let ct = resp
        .headers
        .iter()
        .find(|(k, _)| k.eq_ignore_ascii_case("content-type"))
        .map(|(_, v)| v.clone());
    let len = resp.body.len();
    let meta = serde_json::json!({
        "status": resp.status,
        "contentType": ct,
        "size": len,
    });
    emit_auth_log(
        emitter,
        request_id,
        LogLevel::Debug,
        "token_response",
        "Received token response",
        Some(meta),
    );
}

pub async fn discover_oidc(app: AppHandle, url: String) -> Result<OidcDiscovery, AppError> {
    let request_id = uuid::Uuid::new_v4().to_string();
    let emitter = std::sync::Arc::new(TauriLogEmitter::new(app.clone()));

    emit_auth_log(
        &*emitter,
        &request_id,
        LogLevel::Info,
        "discovery",
        format!("Discovering OIDC configuration at {url}"),
        None,
    );

    let request = Request {
        request_id: request_id.clone(),
        url,
        method: "GET".to_string(),
        ..Default::default()
    };

    let engine = preferred_engine();
    let response_data = engine
        .execute(request, emitter.clone())
        .await
        .map_err(|e| AppError::new(ErrorKind::HttpError, e.to_string()))?;

    let wire: OidcDiscoveryWire = serde_json::from_slice(&response_data.body).map_err(|e| {
        AppError::new(
            ErrorKind::JsonError,
            format!("Failed to parse OIDC discovery response: {e}"),
        )
    })?;

    let discovery = OidcDiscovery {
        authorization_endpoint: wire.authorization_endpoint,
        token_endpoint: wire.token_endpoint,
        device_authorization_endpoint: wire.device_authorization_endpoint,
    };

    Ok(discovery)
}

pub async fn get_authentication_result(
    app: AppHandle,
    config: AuthConfig,
    parent_request_id: Option<String>,
) -> Result<AuthResult, AppError> {
    log::debug!("Received auth config: {config:?}");

    let emitter = std::sync::Arc::new(TauriLogEmitter::new(app.clone()));

    match config {
        AuthConfig::Basic { username, password } => {
            let req_id = parent_request_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
            emit_auth_log(
                &*emitter,
                &req_id,
                LogLevel::Info,
                "start",
                "Starting authentication (basic)",
                None,
            );
            let username = username.unwrap_or_default();
            let password = password.unwrap_or_default();
            let encoded = general_purpose::STANDARD.encode(format!("{username}:{password}"));
            let mut headers = HashMap::new();
            headers.insert("Authorization".to_string(), format!("Basic {encoded}"));
            emit_auth_log(
                &*emitter,
                &req_id,
                LogLevel::Info,
                "prepared",
                "Prepared basic Authorization header",
                None,
            );
            emit_auth_log(
                &*emitter,
                &req_id,
                LogLevel::Info,
                "complete",
                "Authentication complete",
                None,
            );
            Ok(AuthResult {
                headers: Some(headers),
                ..Default::default()
            })
        }
        AuthConfig::Bearer {
            token,
            scheme,
            placement,
        } => {
            let req_id = parent_request_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
            emit_auth_log(
                &*emitter,
                &req_id,
                LogLevel::Info,
                "start",
                "Starting authentication (bearer)",
                None,
            );
            let token = token.unwrap_or_default();
            // Default to header placement if not specified
            let placement = placement.unwrap_or(AuthPlacement {
                r#type: "header".to_string(),
                name: Some("Authorization".to_string()),
                field_name: None,
                content_type: None,
            });
            match placement.r#type.as_str() {
                "header" => {
                    let mut headers = HashMap::new();
                    let mut scheme = scheme.unwrap_or_else(|| "Bearer".to_string());
                    if scheme.trim().is_empty() {
                        scheme = "Bearer".to_string();
                    }
                    headers.insert(
                        placement.name.unwrap_or("Authorization".to_string()),
                        format!("{scheme} {token}"),
                    );
                    emit_auth_log(
                        &*emitter,
                        &req_id,
                        LogLevel::Info,
                        "prepared",
                        "Prepared bearer token header",
                        None,
                    );
                    emit_auth_log(
                        &*emitter,
                        &req_id,
                        LogLevel::Info,
                        "complete",
                        "Authentication complete",
                        None,
                    );
                    Ok(AuthResult {
                        headers: Some(headers),
                        ..Default::default()
                    })
                }
                "query" => {
                    let mut query = HashMap::new();
                    query.insert(placement.name.unwrap_or_default(), token);
                    emit_auth_log(
                        &*emitter,
                        &req_id,
                        LogLevel::Info,
                        "prepared",
                        "Prepared bearer token query parameter",
                        None,
                    );
                    emit_auth_log(
                        &*emitter,
                        &req_id,
                        LogLevel::Info,
                        "complete",
                        "Authentication complete",
                        None,
                    );
                    Ok(AuthResult {
                        query: Some(query),
                        ..Default::default()
                    })
                }
                "cookie" => {
                    let mut cookies = HashMap::new();
                    cookies.insert(placement.name.unwrap_or_default(), token);
                    emit_auth_log(
                        &*emitter,
                        &req_id,
                        LogLevel::Info,
                        "prepared",
                        "Prepared bearer token cookie",
                        None,
                    );
                    emit_auth_log(
                        &*emitter,
                        &req_id,
                        LogLevel::Info,
                        "complete",
                        "Authentication complete",
                        None,
                    );
                    Ok(AuthResult {
                        cookies: Some(cookies),
                        ..Default::default()
                    })
                }
                "body" => {
                    let mut body = HashMap::new();
                    body.insert(
                        placement.field_name.unwrap_or_default(),
                        serde_json::Value::String(token),
                    );
                    emit_auth_log(
                        &*emitter,
                        &req_id,
                        LogLevel::Info,
                        "prepared",
                        "Prepared bearer token in request body",
                        None,
                    );
                    emit_auth_log(
                        &*emitter,
                        &req_id,
                        LogLevel::Info,
                        "complete",
                        "Authentication complete",
                        None,
                    );
                    Ok(AuthResult {
                        body: Some(body),
                        ..Default::default()
                    })
                }
                _ => Err(AppError::new(
                    ErrorKind::BadRequest,
                    "Unsupported placement type".to_string(),
                )),
            }
        }
        AuthConfig::ApiKey {
            value, placement, ..
        } => {
            let req_id = parent_request_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
            emit_auth_log(
                &*emitter,
                &req_id,
                LogLevel::Info,
                "start",
                "Starting authentication (apiKey)",
                None,
            );
            let value = value.unwrap_or_default();
            // Default to header placement if not specified
            let placement = placement.unwrap_or(AuthPlacement {
                r#type: "header".to_string(),
                name: Some("X-API-Key".to_string()),
                field_name: None,
                content_type: None,
            });
            match placement.r#type.as_str() {
                "header" => {
                    let mut headers = HashMap::new();
                    headers.insert(placement.name.unwrap_or_default(), value);
                    emit_auth_log(
                        &*emitter,
                        &req_id,
                        LogLevel::Info,
                        "prepared",
                        "Prepared API key header",
                        None,
                    );
                    emit_auth_log(
                        &*emitter,
                        &req_id,
                        LogLevel::Info,
                        "complete",
                        "Authentication complete",
                        None,
                    );
                    Ok(AuthResult {
                        headers: Some(headers),
                        ..Default::default()
                    })
                }
                "query" => {
                    let mut query = HashMap::new();
                    query.insert(placement.name.unwrap_or_default(), value);
                    emit_auth_log(
                        &*emitter,
                        &req_id,
                        LogLevel::Info,
                        "prepared",
                        "Prepared API key query parameter",
                        None,
                    );
                    emit_auth_log(
                        &*emitter,
                        &req_id,
                        LogLevel::Info,
                        "complete",
                        "Authentication complete",
                        None,
                    );
                    Ok(AuthResult {
                        query: Some(query),
                        ..Default::default()
                    })
                }
                "cookie" => {
                    let mut cookies = HashMap::new();
                    cookies.insert(placement.name.unwrap_or_default(), value);
                    emit_auth_log(
                        &*emitter,
                        &req_id,
                        LogLevel::Info,
                        "prepared",
                        "Prepared API key cookie",
                        None,
                    );
                    emit_auth_log(
                        &*emitter,
                        &req_id,
                        LogLevel::Info,
                        "complete",
                        "Authentication complete",
                        None,
                    );
                    Ok(AuthResult {
                        cookies: Some(cookies),
                        ..Default::default()
                    })
                }
                "body" => {
                    let mut body = HashMap::new();
                    body.insert(
                        placement.field_name.unwrap_or_default(),
                        serde_json::Value::String(value),
                    );
                    emit_auth_log(
                        &*emitter,
                        &req_id,
                        LogLevel::Info,
                        "prepared",
                        "Prepared API key in request body",
                        None,
                    );
                    emit_auth_log(
                        &*emitter,
                        &req_id,
                        LogLevel::Info,
                        "complete",
                        "Authentication complete",
                        None,
                    );
                    Ok(AuthResult {
                        body: Some(body),
                        ..Default::default()
                    })
                }
                _ => Err(AppError::new(
                    ErrorKind::BadRequest,
                    "Unsupported placement type".to_string(),
                )),
            }
        }
        AuthConfig::Oauth2 {
            grant_type,
            token_url,
            client_id,
            client_secret,
            scope,
            refresh_token,
            token_caching: _,
            client_auth,
            token_extra_params,
            ..
        } => match grant_type.as_str() {
            "client_credentials" => {
                let req_id = parent_request_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
                emit_auth_log(
                    &*emitter,
                    &req_id,
                    LogLevel::Info,
                    "start",
                    "Starting authentication (oauth2: client_credentials)",
                    None,
                );
                let token_url = token_url.ok_or(AppError::new(
                    ErrorKind::BadRequest,
                    "Token URL is required".to_string(),
                ))?;
                let client_id = client_id.ok_or(AppError::new(
                    ErrorKind::BadRequest,
                    "Client ID is required".to_string(),
                ))?;
                let client_secret = client_secret.ok_or(AppError::new(
                    ErrorKind::BadRequest,
                    "Client Secret is required".to_string(),
                ))?;

                let mut params = vec![("grant_type", "client_credentials")];
                if let Some(s) = &scope {
                    params.push(("scope", s));
                }

                // client authentication placement (policy: Basic or body)
                let chosen_auth = client_auth.unwrap_or(ClientAuth::Body);
                let mut headers = HashMap::new();
                match chosen_auth {
                    ClientAuth::Basic => {
                        if !client_id.is_empty() && !client_secret.is_empty() {
                            let raw = format!("{client_id}:{client_secret}");
                            let b64 = general_purpose::STANDARD.encode(raw);
                            headers.insert("Authorization".to_string(), format!("Basic {b64}"));
                        } else {
                            return Err(AppError::new(
                                ErrorKind::BadRequest,
                                "invalid_client: Client ID and Secret required for Basic auth"
                                    .to_string(),
                            ));
                        }
                    }
                    ClientAuth::Body => {
                        params.push(("client_id", &client_id));
                        params.push(("client_secret", &client_secret));
                    }
                }

                // extra provider params
                if let Some(extra) = &token_extra_params {
                    for (k, v) in extra {
                        params.push((k.as_str(), v.as_str()));
                    }
                }

                // Always POST form-encoded per policy
                let body = serde_urlencoded::to_string(params)
                    .map_err(|e| AppError::new(ErrorKind::BadRequest, e.to_string()))?
                    .into_bytes();
                let mut addl_headers = headers;
                addl_headers.insert(
                    "Content-Type".to_string(),
                    "application/x-www-form-urlencoded".to_string(),
                );

                let request_id = req_id.clone();
                let request = Request {
                    request_id: request_id.clone(),
                    url: token_url,
                    method: "POST".to_string(),
                    headers: Some(addl_headers),
                    body: Some(body),
                    ..Default::default()
                };

                emit_auth_log(
                    &*emitter,
                    &request_id,
                    LogLevel::Info,
                    "token",
                    "Requesting access token (client_credentials) via POST",
                    None,
                );

                let engine = preferred_engine();
                let response_data = engine
                    .execute(request, emitter.clone())
                    .await
                    .map_err(|e| AppError::new(ErrorKind::HttpError, e.to_string()))?;

                log_token_response_metadata(&*emitter, &req_id, &response_data);
                let token_response = parse_token_response_body(&response_data.body)?;

                let mut auth_headers = HashMap::new();
                auth_headers.insert(
                    "Authorization".to_string(),
                    format!(
                        "{} {}",
                        token_response.token_type, token_response.access_token
                    ),
                );

                emit_auth_log(
                    &*emitter,
                    &req_id,
                    LogLevel::Info,
                    "received_token",
                    "Received authentication token",
                    Some(serde_json::json!({
                        "tokenType": token_response.token_type,
                        "expiresIn": token_response.expires_in,
                    })),
                );
                emit_auth_log(
                    &*emitter,
                    &req_id,
                    LogLevel::Info,
                    "complete",
                    "Authentication complete",
                    None,
                );

                Ok(AuthResult {
                    headers: Some(auth_headers),
                    expires_at: token_response.expires_in.map(|secs| {
                        let now = chrono::Utc::now().timestamp();
                        now + secs as i64 - 300
                    }),
                    ..Default::default()
                })
            }
            "password" => Err(AppError::new(
                ErrorKind::BadRequest,
                "unsupported_grant_type: ROPC not supported by Knurl".to_string(),
            )),
            "refresh_token" => {
                let req_id = parent_request_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
                emit_auth_log(
                    &*emitter,
                    &req_id,
                    LogLevel::Info,
                    "start",
                    "Starting authentication (oauth2: refresh_token)",
                    None,
                );
                let token_url = token_url.ok_or(AppError::new(
                    ErrorKind::BadRequest,
                    "Token URL is required".to_string(),
                ))?;
                let client_id = client_id.ok_or(AppError::new(
                    ErrorKind::BadRequest,
                    "Client ID is required".to_string(),
                ))?;
                let client_secret = client_secret.ok_or(AppError::new(
                    ErrorKind::BadRequest,
                    "Client Secret is required".to_string(),
                ))?;
                let refresh_token = refresh_token.ok_or(AppError::new(
                    ErrorKind::BadRequest,
                    "Refresh token is required".to_string(),
                ))?;

                let mut params = vec![
                    ("grant_type", "refresh_token"),
                    ("refresh_token", &refresh_token),
                ];
                if let Some(s) = &scope {
                    params.push(("scope", s));
                }

                let chosen_auth = client_auth.unwrap_or(ClientAuth::Body);
                let mut headers = HashMap::new();
                match chosen_auth {
                    ClientAuth::Basic => {
                        if !client_id.is_empty() && !client_secret.is_empty() {
                            let raw = format!("{client_id}:{client_secret}");
                            let b64 = general_purpose::STANDARD.encode(raw);
                            headers.insert("Authorization".to_string(), format!("Basic {b64}"));
                        } else {
                            return Err(AppError::new(
                                ErrorKind::BadRequest,
                                "invalid_client: Client ID and Secret required for Basic auth"
                                    .to_string(),
                            ));
                        }
                    }
                    ClientAuth::Body => {
                        params.push(("client_id", &client_id));
                        params.push(("client_secret", &client_secret));
                    }
                }

                if let Some(extra) = &token_extra_params {
                    for (k, v) in extra {
                        params.push((k.as_str(), v.as_str()));
                    }
                }

                // Always POST form-encoded
                let body = serde_urlencoded::to_string(params)
                    .map_err(|e| AppError::new(ErrorKind::BadRequest, e.to_string()))?
                    .into_bytes();
                let mut addl_headers = headers;
                addl_headers.insert(
                    "Content-Type".to_string(),
                    "application/x-www-form-urlencoded".to_string(),
                );

                let request_id = req_id.clone();
                let request = Request {
                    request_id: request_id.clone(),
                    url: token_url,
                    method: "POST".to_string(),
                    headers: Some(addl_headers),
                    body: Some(body),
                    ..Default::default()
                };

                emit_auth_log(
                    &*emitter,
                    &request_id,
                    LogLevel::Info,
                    "token",
                    "Refreshing access token (refresh_token) via POST",
                    None,
                );

                let engine = preferred_engine();
                let response_data = engine
                    .execute(request, emitter.clone())
                    .await
                    .map_err(|e| AppError::new(ErrorKind::HttpError, e.to_string()))?;
                log_token_response_metadata(&*emitter, &req_id, &response_data);
                let token_response = parse_token_response_body(&response_data.body)?;

                let mut auth_headers = HashMap::new();
                auth_headers.insert(
                    "Authorization".to_string(),
                    format!(
                        "{} {}",
                        token_response.token_type, token_response.access_token
                    ),
                );

                emit_auth_log(
                    &*emitter,
                    &req_id,
                    LogLevel::Info,
                    "received_token",
                    "Received authentication token",
                    Some(serde_json::json!({
                        "tokenType": token_response.token_type,
                        "expiresIn": token_response.expires_in,
                    })),
                );
                emit_auth_log(
                    &*emitter,
                    &req_id,
                    LogLevel::Info,
                    "complete",
                    "Authentication complete",
                    None,
                );

                Ok(AuthResult {
                    headers: Some(auth_headers),
                    expires_at: token_response.expires_in.map(|secs| {
                        let now = chrono::Utc::now().timestamp();
                        now + secs as i64 - 300
                    }),
                    ..Default::default()
                })
            }
            "device_code" => Err(AppError::new(
                ErrorKind::NotImplemented,
                "Device code not yet implemented".to_string(),
            )),
            _ => Err(AppError::new(
                ErrorKind::BadRequest,
                "Unsupported grant type".to_string(),
            )),
        },
        _ => Err(AppError::new(
            ErrorKind::BadRequest,
            "Unsupported authentication type".to_string(),
        )),
    }
}

fn preferred_engine() -> Box<dyn HttpEngine> {
    Box::new(HyperEngine::new())
}

fn emit_auth_log(
    emitter: &dyn LogEmitter,
    request_id: &str,
    level: LogLevel,
    phase: &str,
    message: impl Into<String>,
    details: Option<serde_json::Value>,
) {
    let entry = LogEntry {
        request_id: request_id.to_string(),
        timestamp: Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
        level,
        info_type: None,
        message: message.into(),
        category: Some("auth".to_string()),
        phase: Some(phase.to_string()),
        elapsed_ms: None,
        details,
        bytes_logged: None,
        truncated: None,
    };
    emitter.emit(entry);
}
