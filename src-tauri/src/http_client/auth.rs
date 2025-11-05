use crate::errors::{AppError, ErrorKind};
use crate::http_client::engine::{HttpEngine, LogEmitter, TauriLogEmitter};
use crate::http_client::hyper_engine::HyperEngine;
use crate::http_client::request::Request;
use crate::http_client::response::{LogEntry, LogLevel, ResponseData};
use base64::{Engine as _, engine::general_purpose};
use chrono::{SecondsFormat, Utc};
use rand::distr::{Alphanumeric, SampleString};
use rand::rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{collections::HashMap, env};
use tauri::AppHandle;
use tokio::time::{Duration, sleep};
use url::Url;

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
        device_authorization_url: Option<String>,
        client_id: Option<String>,
        client_secret: Option<String>,
        scope: Option<String>,
        refresh_token: Option<String>,
        redirect_uri: Option<String>,
        use_pkce: Option<bool>,
        token_caching: Option<TokenCachingPolicy>,
        client_auth: Option<ClientAuth>,
        token_extra_params: Option<HashMap<String, String>>,
        discovery_url: Option<String>,
    },
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TokenCachingPolicy {
    Always,
    Never,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
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

const DEVICE_CODE_GRANT: &str = "urn:ietf:params:oauth:grant-type:device_code";
const DEFAULT_DEVICE_POLL_INTERVAL: u64 = 5;

#[derive(Debug, Deserialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    #[serde(default)]
    verification_uri_complete: Option<String>,
    #[serde(default)]
    expires_in: Option<u64>,
    #[serde(default)]
    interval: Option<u64>,
    #[serde(default)]
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TokenErrorResponse {
    error: String,
    #[serde(default)]
    error_description: Option<String>,
}

fn is_stub_oauth_enabled() -> bool {
    match env::var("KNURL_E2E_STUB_OAUTH") {
        Ok(value) => {
            let normalized = value.trim().to_ascii_lowercase();
            matches!(normalized.as_str(), "1" | "true" | "yes")
        }
        Err(_) => false,
    }
}

fn require_value<'a>(value: Option<&'a String>, message: &str) -> Result<&'a str, AppError> {
    let Some(raw) = value else {
        return Err(AppError::new(ErrorKind::BadRequest, message.to_string()));
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        Err(AppError::new(ErrorKind::BadRequest, message.to_string()))
    } else {
        Ok(trimmed)
    }
}

fn build_stub_token(
    grant_type: &str,
    subject: &str,
    scope: Option<&str>,
    issued_at: i64,
) -> String {
    let header = general_purpose::URL_SAFE_NO_PAD.encode(br#"{"alg":"HS256","typ":"JWT"}"#);
    let payload_json = serde_json::json!({
        "iss": "knurl-e2e-stub",
        "sub": subject,
        "grant": grant_type,
        "scope": scope.unwrap_or_default(),
        "iat": issued_at,
    });
    let payload_bytes = serde_json::to_vec(&payload_json).unwrap_or_default();
    let payload = general_purpose::URL_SAFE_NO_PAD.encode(payload_bytes);
    let signature =
        general_purpose::URL_SAFE_NO_PAD.encode(format!("{grant_type}-{subject}-{issued_at}"));
    format!("{header}.{payload}.{signature}")
}

struct StubOauthOptions<'a> {
    auth_url: Option<&'a String>,
    token_url: Option<&'a String>,
    device_authorization_url: Option<&'a String>,
    client_id: Option<&'a String>,
    client_secret: Option<&'a String>,
    scope: Option<&'a String>,
    refresh_token: Option<&'a String>,
    redirect_uri: Option<&'a String>,
}

fn stubbed_oauth_result(
    emitter: &dyn LogEmitter,
    request_id: String,
    grant_type: &str,
    options: StubOauthOptions<'_>,
) -> Result<AuthResult, AppError> {
    let StubOauthOptions {
        auth_url,
        token_url,
        device_authorization_url,
        client_id,
        client_secret,
        scope,
        refresh_token,
        redirect_uri,
    } = options;

    emit_auth_log(
        emitter,
        &request_id,
        LogLevel::Info,
        "start",
        format!("Starting authentication (oauth2 stub: {grant_type})"),
        None,
    );

    let issued_at = Utc::now().timestamp();
    let expires_at = issued_at + 3300;
    let scope_trimmed = scope.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    });

    let build_result = |subject: &str| -> AuthResult {
        let token = build_stub_token(grant_type, subject, scope_trimmed, issued_at);
        let mut headers = HashMap::new();
        headers.insert("Authorization".to_string(), format!("Bearer {token}"));
        emit_auth_log(
            emitter,
            &request_id,
            LogLevel::Info,
            "received_token",
            "Generated stub authentication token",
            Some(serde_json::json!({
                "grantType": grant_type,
                "scope": scope_trimmed,
            })),
        );
        emit_auth_log(
            emitter,
            &request_id,
            LogLevel::Info,
            "complete",
            "Authentication complete",
            None,
        );
        AuthResult {
            headers: Some(headers),
            expires_at: Some(expires_at),
            ..Default::default()
        }
    };

    match grant_type {
        "client_credentials" => {
            let _ = require_value(token_url, "Token URL is required")?;
            let client = require_value(client_id, "Client ID is required")?;
            let _ = require_value(client_secret, "Client Secret is required")?;
            Ok(build_result(client))
        }
        "authorization_code" => {
            let _ = require_value(auth_url, "Auth URL is required")?;
            let _ = require_value(token_url, "Token URL is required")?;
            let client = require_value(client_id, "Client ID is required")?;
            let _ = require_value(redirect_uri, "Redirect URI is required")?;
            Ok(build_result(client))
        }
        "device_code" => {
            let _ = require_value(
                device_authorization_url,
                "Device authorization URL is required",
            )?;
            let _ = require_value(token_url, "Token URL is required")?;
            let client = require_value(client_id, "Client ID is required")?;
            Ok(build_result(client))
        }
        "refresh_token" => {
            let _ = require_value(token_url, "Token URL is required")?;
            let token = require_value(refresh_token, "Refresh token is required")?;
            Ok(build_result(token))
        }
        "password" => Err(AppError::new(
            ErrorKind::BadRequest,
            "unsupported_grant_type: ROPC not supported by Knurl".to_string(),
        )),
        other => Err(AppError::new(
            ErrorKind::BadRequest,
            format!("Unsupported OAuth2 grant type: {other}"),
        )),
    }
}

#[derive(Debug, Clone)]
struct ResolvedOauthEndpoints {
    authorization: Option<String>,
    token: Option<String>,
    device: Option<String>,
}

#[derive(Debug)]
struct AuthorizationCallback {
    code: String,
    state: Option<String>,
}

#[derive(Debug)]
struct AuthorizationCodeParams {
    request_id: Option<String>,
    endpoints: ResolvedOauthEndpoints,
    client_id: String,
    client_secret: Option<String>,
    scope: Option<String>,
    redirect_uri: String,
    use_pkce: bool,
    client_auth: ClientAuth,
    token_extra_params: Option<HashMap<String, String>>,
}

#[derive(Debug)]
struct DeviceCodeParams {
    request_id: Option<String>,
    endpoints: ResolvedOauthEndpoints,
    client_id: String,
    client_secret: Option<String>,
    scope: Option<String>,
    client_auth: ClientAuth,
    token_extra_params: Option<HashMap<String, String>>,
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

fn log_token_request_preview(
    emitter: &dyn LogEmitter,
    request_id: &str,
    method: &str,
    url: &str,
    headers: &HashMap<String, String>,
    form_fields: &[(String, String)],
) {
    let header_entries: Vec<serde_json::Value> = headers
        .iter()
        .map(|(name, value)| serde_json::json!({ "name": name, "value": value }))
        .collect();
    let body_entries: Vec<serde_json::Value> = form_fields
        .iter()
        .map(|(name, value)| serde_json::json!({ "name": name, "value": value }))
        .collect();
    let details = serde_json::json!({
        "method": method,
        "url": url,
        "headers": header_entries,
        "body": body_entries,
    });
    emit_auth_log(
        emitter,
        request_id,
        LogLevel::Info,
        "request_preview",
        "Prepared OAuth2 token request",
        Some(details),
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
            auth_url,
            token_url,
            device_authorization_url,
            client_id,
            client_secret,
            scope,
            refresh_token,
            redirect_uri,
            use_pkce,
            token_caching: _,
            client_auth,
            token_extra_params,
            discovery_url,
        } => {
            if is_stub_oauth_enabled() {
                let req_id = parent_request_id
                    .clone()
                    .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
                return stubbed_oauth_result(
                    &*emitter,
                    req_id,
                    grant_type.as_str(),
                    StubOauthOptions {
                        auth_url: auth_url.as_ref(),
                        token_url: token_url.as_ref(),
                        device_authorization_url: device_authorization_url.as_ref(),
                        client_id: client_id.as_ref(),
                        client_secret: client_secret.as_ref(),
                        scope: scope.as_ref(),
                        refresh_token: refresh_token.as_ref(),
                        redirect_uri: redirect_uri.as_ref(),
                    },
                );
            }

            match grant_type.as_str() {
                "client_credentials" => {
                    let req_id =
                        parent_request_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
                    emit_auth_log(
                        &*emitter,
                        &req_id,
                        LogLevel::Info,
                        "start",
                        "Starting authentication (oauth2: client_credentials)",
                        None,
                    );
                    let endpoints = resolve_oauth_endpoints(
                        &app,
                        &auth_url,
                        &token_url,
                        &device_authorization_url,
                        &discovery_url,
                    )
                    .await?;
                    let token_url = endpoints.token.ok_or(AppError::new(
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

                    let params_preview: Vec<(String, String)> = params
                        .iter()
                        .map(|(k, v)| ((*k).to_string(), (*v).to_string()))
                        .collect();

                    // Always POST form-encoded per policy
                    let body = serde_urlencoded::to_string(params)
                        .map_err(|e| AppError::new(ErrorKind::BadRequest, e.to_string()))?
                        .into_bytes();
                    let mut addl_headers = headers;
                    addl_headers.insert(
                        "Content-Type".to_string(),
                        "application/x-www-form-urlencoded".to_string(),
                    );

                    log_token_request_preview(
                        &*emitter,
                        &req_id,
                        "POST",
                        &token_url,
                        &addl_headers,
                        &params_preview,
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
                "authorization_code" => {
                    let endpoints = resolve_oauth_endpoints(
                        &app,
                        &auth_url,
                        &token_url,
                        &device_authorization_url,
                        &discovery_url,
                    )
                    .await?;
                    let redirect_value = redirect_uri.clone().ok_or(AppError::new(
                        ErrorKind::BadRequest,
                        "Redirect URI is required".to_string(),
                    ))?;
                    let cid = client_id.clone().ok_or(AppError::new(
                        ErrorKind::BadRequest,
                        "Client ID is required".to_string(),
                    ))?;
                    handle_authorization_code(
                        emitter.clone(),
                        AuthorizationCodeParams {
                            request_id: parent_request_id.clone(),
                            endpoints,
                            client_id: cid,
                            client_secret: client_secret.clone(),
                            scope: scope.clone(),
                            redirect_uri: redirect_value,
                            use_pkce: use_pkce.unwrap_or(true),
                            client_auth: client_auth.clone().unwrap_or(ClientAuth::Body),
                            token_extra_params: token_extra_params.clone(),
                        },
                    )
                    .await
                }
                "password" => Err(AppError::new(
                    ErrorKind::BadRequest,
                    "unsupported_grant_type: ROPC not supported by Knurl".to_string(),
                )),
                "refresh_token" => {
                    let req_id =
                        parent_request_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
                    emit_auth_log(
                        &*emitter,
                        &req_id,
                        LogLevel::Info,
                        "start",
                        "Starting authentication (oauth2: refresh_token)",
                        None,
                    );
                    let endpoints = resolve_oauth_endpoints(
                        &app,
                        &auth_url,
                        &token_url,
                        &device_authorization_url,
                        &discovery_url,
                    )
                    .await?;
                    let token_url = endpoints.token.ok_or(AppError::new(
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

                    let params_preview: Vec<(String, String)> = params
                        .iter()
                        .map(|(k, v)| ((*k).to_string(), (*v).to_string()))
                        .collect();

                    // Always POST form-encoded
                    let body = serde_urlencoded::to_string(params)
                        .map_err(|e| AppError::new(ErrorKind::BadRequest, e.to_string()))?
                        .into_bytes();
                    let mut addl_headers = headers;
                    addl_headers.insert(
                        "Content-Type".to_string(),
                        "application/x-www-form-urlencoded".to_string(),
                    );

                    log_token_request_preview(
                        &*emitter,
                        &req_id,
                        "POST",
                        &token_url,
                        &addl_headers,
                        &params_preview,
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
                "device_code" => {
                    let endpoints = resolve_oauth_endpoints(
                        &app,
                        &auth_url,
                        &token_url,
                        &device_authorization_url,
                        &discovery_url,
                    )
                    .await?;
                    let cid = client_id.clone().ok_or(AppError::new(
                        ErrorKind::BadRequest,
                        "Client ID is required".to_string(),
                    ))?;
                    handle_device_code(
                        emitter.clone(),
                        DeviceCodeParams {
                            request_id: parent_request_id.clone(),
                            endpoints,
                            client_id: cid,
                            client_secret: client_secret.clone(),
                            scope: scope.clone(),
                            client_auth: client_auth.clone().unwrap_or(ClientAuth::Body),
                            token_extra_params: token_extra_params.clone(),
                        },
                    )
                    .await
                }
                _ => Err(AppError::new(
                    ErrorKind::BadRequest,
                    "Unsupported grant type".to_string(),
                )),
            }
        }
        _ => Err(AppError::new(
            ErrorKind::BadRequest,
            "Unsupported authentication type".to_string(),
        )),
    }
}

fn preferred_engine() -> Box<dyn HttpEngine> {
    Box::new(HyperEngine::new())
}

async fn resolve_oauth_endpoints(
    app: &AppHandle,
    auth_url: &Option<String>,
    token_url: &Option<String>,
    device_authorization_url: &Option<String>,
    discovery_url: &Option<String>,
) -> Result<ResolvedOauthEndpoints, AppError> {
    if let Some(discovery) = discovery_url {
        let discovery_result = discover_oidc(app.clone(), discovery.clone()).await?;
        let authorization = auth_url.clone().or(discovery_result.authorization_endpoint);
        let token = token_url.clone().or(discovery_result.token_endpoint);
        let device = device_authorization_url
            .clone()
            .or(discovery_result.device_authorization_endpoint);
        Ok(ResolvedOauthEndpoints {
            authorization,
            token,
            device,
        })
    } else {
        Ok(ResolvedOauthEndpoints {
            authorization: auth_url.clone(),
            token: token_url.clone(),
            device: device_authorization_url.clone(),
        })
    }
}

fn is_headless_mode() -> bool {
    std::env::var("KNURL_OAUTH_HEADLESS")
        .map(|value| value != "0")
        .unwrap_or(false)
}

fn auto_complete_device_enabled() -> bool {
    std::env::var("KNURL_OAUTH_AUTO_DEVICE")
        .map(|value| value != "0")
        .unwrap_or(false)
}

fn generate_state() -> String {
    let mut rng = rng();
    Alphanumeric.sample_string(&mut rng, 32)
}

fn generate_pkce_verifier() -> String {
    let mut rng = rng();
    Alphanumeric.sample_string(&mut rng, 64)
}

fn compute_pkce_challenge(verifier: &str, method: &str) -> Result<String, AppError> {
    match method {
        "S256" | "s256" => {
            let mut hasher = Sha256::new();
            hasher.update(verifier.as_bytes());
            let digest = hasher.finalize();
            Ok(general_purpose::URL_SAFE_NO_PAD.encode(digest))
        }
        "plain" => Ok(verifier.to_string()),
        other => Err(AppError::new(
            ErrorKind::BadRequest,
            format!("Unsupported PKCE method: {other}"),
        )),
    }
}

async fn perform_headless_authorization(
    emitter: &std::sync::Arc<TauriLogEmitter>,
    request_id: &str,
    authorization_url: Url,
    expected_redirect: &Url,
) -> Result<AuthorizationCallback, AppError> {
    let engine = preferred_engine();
    let auth_request = Request {
        request_id: format!("{request_id}-authorize"),
        url: authorization_url.to_string(),
        method: "GET".to_string(),
        max_redirects: Some(0),
        ..Default::default()
    };

    emit_auth_log(
        &**emitter,
        request_id,
        LogLevel::Info,
        "authorize",
        format!("Initiating headless authorization at {}", auth_request.url),
        None,
    );

    let response = engine
        .execute(auth_request, emitter.clone())
        .await
        .map_err(|e| AppError::new(ErrorKind::HttpError, e.to_string()))?;

    let location = response
        .headers
        .iter()
        .find(|(name, _)| name.eq_ignore_ascii_case("location"))
        .map(|(_, value)| value.clone())
        .ok_or_else(|| {
            AppError::new(
                ErrorKind::BadRequest,
                "Authorization endpoint did not provide redirect location".to_string(),
            )
        })?;

    let callback_url = Url::parse(&location).map_err(|e| {
        AppError::new(
            ErrorKind::BadRequest,
            format!("Failed to parse authorization redirect location: {e}"),
        )
    })?;

    let expected_port = expected_redirect.port_or_known_default();
    let callback_port = callback_url.port_or_known_default();
    if callback_url.scheme() != expected_redirect.scheme()
        || callback_url.host_str() != expected_redirect.host_str()
        || callback_port != expected_port
    {
        return Err(AppError::new(
            ErrorKind::BadRequest,
            format!(
                "Authorization redirect URI mismatch (expected {expected_redirect} but received {callback_url})"
            ),
        ));
    }

    let query = callback_url.query().ok_or_else(|| {
        AppError::new(
            ErrorKind::BadRequest,
            "Authorization response missing query string".to_string(),
        )
    })?;

    let query_map: HashMap<String, String> = serde_urlencoded::from_str(query).map_err(|e| {
        AppError::new(
            ErrorKind::BadRequest,
            format!("Failed to parse authorization response parameters: {e}"),
        )
    })?;

    let code = query_map.get("code").cloned().ok_or_else(|| {
        AppError::new(
            ErrorKind::BadRequest,
            "Authorization response missing code".to_string(),
        )
    })?;

    let state = query_map.get("state").cloned();

    Ok(AuthorizationCallback { code, state })
}

async fn handle_authorization_code(
    emitter: std::sync::Arc<TauriLogEmitter>,
    params: AuthorizationCodeParams,
) -> Result<AuthResult, AppError> {
    let AuthorizationCodeParams {
        request_id,
        endpoints,
        client_id,
        mut client_secret,
        scope,
        redirect_uri,
        use_pkce,
        client_auth,
        token_extra_params,
    } = params;

    let req_id = request_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    emit_auth_log(
        &*emitter,
        &req_id,
        LogLevel::Info,
        "start",
        "Starting authentication (oauth2: authorization_code)",
        None,
    );

    if !is_headless_mode() {
        return Err(AppError::new(
            ErrorKind::NotImplemented,
            "Interactive authorization_code flow is not yet available; set KNURL_OAUTH_HEADLESS=1 for mock testing"
                .to_string(),
        ));
    }

    let authorization_endpoint = endpoints.authorization.ok_or(AppError::new(
        ErrorKind::BadRequest,
        "Authorization URL is required".to_string(),
    ))?;
    let token_endpoint = endpoints.token.ok_or(AppError::new(
        ErrorKind::BadRequest,
        "Token URL is required".to_string(),
    ))?;
    let redirect_url = Url::parse(&redirect_uri)
        .map_err(|e| AppError::new(ErrorKind::BadRequest, format!("Invalid redirect URI: {e}")))?;

    let code_verifier = use_pkce.then(generate_pkce_verifier);
    let code_challenge = code_verifier
        .as_ref()
        .map(|verifier| compute_pkce_challenge(verifier, "S256"))
        .transpose()?;
    let state = generate_state();

    let mut authorization_url = Url::parse(&authorization_endpoint).map_err(|e| {
        AppError::new(
            ErrorKind::BadRequest,
            format!("Invalid authorization URL: {e}"),
        )
    })?;
    {
        let mut pairs = authorization_url.query_pairs_mut();
        pairs.append_pair("response_type", "code");
        pairs.append_pair("client_id", &client_id);
        pairs.append_pair("redirect_uri", redirect_url.as_str());
        if let Some(scope_val) = scope.as_ref().filter(|s| !s.trim().is_empty()) {
            pairs.append_pair("scope", scope_val);
        }
        pairs.append_pair("state", &state);
        if let Some(challenge) = &code_challenge {
            pairs.append_pair("code_challenge", challenge);
            pairs.append_pair("code_challenge_method", "S256");
        }
    }

    let callback =
        perform_headless_authorization(&emitter, &req_id, authorization_url, &redirect_url).await?;
    if let Some(returned_state) = callback.state.as_ref()
        && returned_state != &state
    {
        return Err(AppError::new(
            ErrorKind::BadRequest,
            "State mismatch in authorization response".to_string(),
        ));
    }

    let mut headers = HashMap::new();
    let mut params: Vec<(String, String)> = vec![
        ("grant_type".to_string(), "authorization_code".to_string()),
        ("code".to_string(), callback.code.clone()),
        ("redirect_uri".to_string(), redirect_url.to_string()),
    ];

    if let Some(scope_val) = scope.clone().filter(|s| !s.trim().is_empty()) {
        params.push(("scope".to_string(), scope_val));
    }

    if let Some(verifier) = code_verifier.as_ref() {
        params.push(("code_verifier".to_string(), verifier.clone()));
    }

    match client_auth {
        ClientAuth::Basic => {
            if let Some(secret) = client_secret.as_ref() {
                let raw = format!("{client_id}:{secret}");
                let b64 = general_purpose::STANDARD.encode(raw);
                headers.insert("Authorization".to_string(), format!("Basic {b64}"));
            } else {
                return Err(AppError::new(
                    ErrorKind::BadRequest,
                    "invalid_client: Client Secret is required for Basic auth".to_string(),
                ));
            }
        }
        ClientAuth::Body => {
            params.push(("client_id".to_string(), client_id.clone()));
            if let Some(secret) = client_secret.take() {
                params.push(("client_secret".to_string(), secret));
            }
        }
    }

    if let Some(extra) = token_extra_params {
        for (key, value) in extra {
            params.push((key, value));
        }
    }

    let params_preview: Vec<(String, String)> = params.clone();
    let form_pairs: Vec<(&str, &str)> = params
        .iter()
        .map(|(k, v)| (k.as_str(), v.as_str()))
        .collect();

    let body = serde_urlencoded::to_string(&form_pairs)
        .map_err(|e| AppError::new(ErrorKind::BadRequest, e.to_string()))?
        .into_bytes();

    headers.insert(
        "Content-Type".to_string(),
        "application/x-www-form-urlencoded".to_string(),
    );

    log_token_request_preview(
        &*emitter,
        &req_id,
        "POST",
        &token_endpoint,
        &headers,
        &params_preview,
    );

    let request = Request {
        request_id: format!("{req_id}-token"),
        url: token_endpoint,
        method: "POST".to_string(),
        headers: Some(headers),
        body: Some(body),
        ..Default::default()
    };

    emit_auth_log(
        &*emitter,
        &req_id,
        LogLevel::Info,
        "token",
        "Exchanging authorization code for tokens",
        None,
    );

    let engine = preferred_engine();
    let response = engine
        .execute(request, emitter.clone())
        .await
        .map_err(|e| AppError::new(ErrorKind::HttpError, e.to_string()))?;

    log_token_response_metadata(&*emitter, &req_id, &response);
    let token_response = parse_token_response_body(&response.body)?;

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

async fn handle_device_code(
    emitter: std::sync::Arc<TauriLogEmitter>,
    params: DeviceCodeParams,
) -> Result<AuthResult, AppError> {
    let DeviceCodeParams {
        request_id,
        endpoints,
        client_id,
        client_secret,
        scope,
        client_auth,
        token_extra_params,
    } = params;

    let req_id = request_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    emit_auth_log(
        &*emitter,
        &req_id,
        LogLevel::Info,
        "start",
        "Starting authentication (oauth2: device_code)",
        None,
    );

    let device_endpoint = endpoints.device.ok_or(AppError::new(
        ErrorKind::BadRequest,
        "Device authorization URL is required".to_string(),
    ))?;

    let token_endpoint = endpoints.token.ok_or(AppError::new(
        ErrorKind::BadRequest,
        "Token URL is required".to_string(),
    ))?;

    let mut params: Vec<(String, String)> = vec![("client_id".to_string(), client_id.clone())];
    if let Some(scope_val) = scope.as_ref().filter(|s| !s.trim().is_empty()) {
        params.push(("scope".to_string(), scope_val.clone()));
    }

    let mut headers = HashMap::new();
    if matches!(client_auth, ClientAuth::Basic) {
        if let Some(secret) = client_secret.as_ref() {
            let raw = format!("{client_id}:{secret}");
            let b64 = general_purpose::STANDARD.encode(raw);
            headers.insert("Authorization".to_string(), format!("Basic {b64}"));
        } else {
            return Err(AppError::new(
                ErrorKind::BadRequest,
                "invalid_client: Client Secret is required for Basic auth".to_string(),
            ));
        }
    }

    let params_preview = params.clone();
    let form_pairs: Vec<(&str, &str)> = params
        .iter()
        .map(|(k, v)| (k.as_str(), v.as_str()))
        .collect();
    let body = serde_urlencoded::to_string(&form_pairs)
        .map_err(|e| AppError::new(ErrorKind::BadRequest, e.to_string()))?
        .into_bytes();

    headers.insert(
        "Content-Type".to_string(),
        "application/x-www-form-urlencoded".to_string(),
    );

    log_token_request_preview(
        &*emitter,
        &req_id,
        "POST",
        &device_endpoint,
        &headers,
        &params_preview,
    );

    let device_request = Request {
        request_id: format!("{req_id}-device"),
        url: device_endpoint.clone(),
        method: "POST".to_string(),
        headers: Some(headers.clone()),
        body: Some(body),
        ..Default::default()
    };

    emit_auth_log(
        &*emitter,
        &req_id,
        LogLevel::Info,
        "device_authorization",
        "Requesting device code",
        None,
    );

    let engine = preferred_engine();
    let device_response = engine
        .execute(device_request, emitter.clone())
        .await
        .map_err(|e| AppError::new(ErrorKind::HttpError, e.to_string()))?;

    let device_payload: DeviceCodeResponse = serde_json::from_slice(&device_response.body)
        .map_err(|e| {
            AppError::new(
                ErrorKind::JsonError,
                format!("Failed to parse device code response: {e}"),
            )
        })?;

    emit_auth_log(
        &*emitter,
        &req_id,
        LogLevel::Info,
        "device_prompt",
        format!(
            "Device authorization required: code {} at {}",
            device_payload.user_code, device_payload.verification_uri
        ),
        Some(serde_json::json!({
            "userCode": device_payload.user_code,
            "verificationUri": device_payload.verification_uri,
            "verificationUriComplete": device_payload.verification_uri_complete,
            "expiresIn": device_payload.expires_in,
            "interval": device_payload.interval,
            "message": device_payload.message,
        })),
    );

    if auto_complete_device_enabled()
        && let Some(complete_uri) = device_payload.verification_uri_complete.as_ref()
    {
        let _ = auto_complete_device(complete_uri, &emitter, &req_id).await;
    }

    let mut interval = device_payload
        .interval
        .unwrap_or(DEFAULT_DEVICE_POLL_INTERVAL)
        .max(1);
    let expires_at = device_payload
        .expires_in
        .map(|secs| chrono::Utc::now().timestamp() + secs as i64)
        .unwrap_or_else(|| chrono::Utc::now().timestamp() + 600);

    let mut token_params_base: Vec<(String, String)> = vec![
        ("grant_type".to_string(), DEVICE_CODE_GRANT.to_string()),
        (
            "device_code".to_string(),
            device_payload.device_code.clone(),
        ),
    ];

    if matches!(client_auth, ClientAuth::Body) {
        token_params_base.push(("client_id".to_string(), client_id.clone()));
        if let Some(secret) = client_secret.as_ref() {
            token_params_base.push(("client_secret".to_string(), secret.clone()));
        }
    }

    if let Some(extra) = token_extra_params {
        for (key, value) in extra {
            token_params_base.push((key, value));
        }
    }

    loop {
        if chrono::Utc::now().timestamp() > expires_at {
            return Err(AppError::new(
                ErrorKind::Timeout,
                "Device authorization expired before completion".to_string(),
            ));
        }

        sleep(Duration::from_secs(interval)).await;

        let token_params = token_params_base.clone();
        let params_preview = token_params.clone();
        let form_pairs: Vec<(&str, &str)> = token_params
            .iter()
            .map(|(k, v)| (k.as_str(), v.as_str()))
            .collect();
        let body = serde_urlencoded::to_string(&form_pairs)
            .map_err(|e| AppError::new(ErrorKind::BadRequest, e.to_string()))?
            .into_bytes();

        let mut poll_headers = headers.clone();
        poll_headers.insert(
            "Content-Type".to_string(),
            "application/x-www-form-urlencoded".to_string(),
        );

        log_token_request_preview(
            &*emitter,
            &req_id,
            "POST",
            &token_endpoint,
            &poll_headers,
            &params_preview,
        );

        let poll_request = Request {
            request_id: format!("{req_id}-device-token"),
            url: token_endpoint.clone(),
            method: "POST".to_string(),
            headers: Some(poll_headers.clone()),
            body: Some(body),
            ..Default::default()
        };

        let response = engine
            .execute(poll_request, emitter.clone())
            .await
            .map_err(|e| AppError::new(ErrorKind::HttpError, e.to_string()))?;

        if response.status == 200 {
            log_token_response_metadata(&*emitter, &req_id, &response);
            let token_response = parse_token_response_body(&response.body)?;

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

            return Ok(AuthResult {
                headers: Some(auth_headers),
                expires_at: token_response.expires_in.map(|secs| {
                    let now = chrono::Utc::now().timestamp();
                    now + secs as i64 - 300
                }),
                ..Default::default()
            });
        }

        if let Ok(err) = serde_json::from_slice::<TokenErrorResponse>(&response.body) {
            let detail = err
                .error_description
                .as_deref()
                .filter(|d| !d.is_empty())
                .map(|d| format!(" – {d}"))
                .unwrap_or_default();
            match err.error.as_str() {
                "authorization_pending" => {
                    emit_auth_log(
                        &*emitter,
                        &req_id,
                        LogLevel::Debug,
                        "device_wait",
                        "Authorization pending",
                        None,
                    );
                    continue;
                }
                "slow_down" => {
                    interval += 5;
                    emit_auth_log(
                        &*emitter,
                        &req_id,
                        LogLevel::Debug,
                        "device_wait",
                        format!("Received slow_down, increasing interval to {interval}s"),
                        None,
                    );
                    continue;
                }
                "expired_token" | "access_denied" => {
                    return Err(AppError::new(
                        ErrorKind::BadRequest,
                        format!("Device authorization failed: {}{detail}", err.error),
                    ));
                }
                other => {
                    return Err(AppError::new(
                        ErrorKind::BadRequest,
                        format!("Device authorization error: {other}{detail}"),
                    ));
                }
            }
        } else {
            return Err(AppError::new(
                ErrorKind::BadRequest,
                "Unexpected response from token endpoint during device polling".to_string(),
            ));
        }
    }
}
async fn auto_complete_device(
    verification_uri: &str,
    emitter: &std::sync::Arc<TauriLogEmitter>,
    request_id: &str,
) -> Result<(), AppError> {
    emit_auth_log(
        &**emitter,
        request_id,
        LogLevel::Info,
        "device_auto",
        format!("Auto-completing device verification at {verification_uri}"),
        None,
    );

    let engine = preferred_engine();
    let request = Request {
        request_id: format!("{request_id}-device-verify"),
        url: verification_uri.to_string(),
        method: "GET".to_string(),
        ..Default::default()
    };

    let _ = engine.execute(request, emitter.clone()).await;
    Ok(())
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
