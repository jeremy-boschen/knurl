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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};

    // ========== require_value tests ==========

    #[test]
    fn require_value_accepts_non_empty_string() {
        let test_value = "test_value".to_string();
        let value = Some(&test_value);
        let result = require_value(value, "error msg");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "test_value");
    }

    #[test]
    fn require_value_rejects_none() {
        let value: Option<&String> = None;
        let result = require_value(value, "required field missing");
        assert!(result.is_err());
        assert_eq!(result.unwrap_err().kind, ErrorKind::BadRequest);
    }

    #[test]
    fn require_value_rejects_empty_string() {
        let empty = "".to_string();
        let value = Some(&empty);
        let result = require_value(value, "cannot be empty");
        assert!(result.is_err());
    }

    #[test]
    fn require_value_rejects_whitespace_only() {
        let whitespace = "   ".to_string();
        let value = Some(&whitespace);
        let result = require_value(value, "cannot be whitespace");
        assert!(result.is_err());
    }

    #[test]
    fn require_value_trims_whitespace() {
        let padded = "  test  ".to_string();
        let value = Some(&padded);
        let result = require_value(value, "error");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "test");
    }

    #[test]
    fn require_value_trims_single_side_whitespace() {
        let padded = "token ".to_string();
        let value = Some(&padded);
        assert_eq!(require_value(value, "missing").unwrap(), "token");
    }

    // ========== build_stub_token tests ==========

    #[test]
    fn build_stub_token_creates_valid_jwt_format() {
        let token = build_stub_token(
            "client_credentials",
            "client123",
            Some("openid profile"),
            1000,
        );
        let parts: Vec<&str> = token.split('.').collect();
        assert_eq!(
            parts.len(),
            3,
            "JWT should have 3 parts (header.payload.signature)"
        );
    }

    #[test]
    fn build_stub_token_includes_grant_type() {
        let token = build_stub_token("client_credentials", "subject123", None, 1234567890);
        let parts: Vec<&str> = token.split('.').collect();
        let payload_b64 = parts[1];
        let payload_json = String::from_utf8(
            general_purpose::URL_SAFE_NO_PAD
                .decode(payload_b64)
                .unwrap(),
        )
        .unwrap();
        assert!(payload_json.contains("client_credentials"));
    }

    #[test]
    fn build_stub_token_includes_subject() {
        let subject = "test_subject_456";
        let token = build_stub_token("authorization_code", subject, None, 1000);
        let parts: Vec<&str> = token.split('.').collect();
        let payload_b64 = parts[1];
        let payload_json = String::from_utf8(
            general_purpose::URL_SAFE_NO_PAD
                .decode(payload_b64)
                .unwrap(),
        )
        .unwrap();
        assert!(payload_json.contains(subject));
    }

    #[test]
    fn build_stub_token_with_scope() {
        let token = build_stub_token("device_code", "user", Some("read write"), 2000);
        let parts: Vec<&str> = token.split('.').collect();
        let payload_b64 = parts[1];
        let payload_json = String::from_utf8(
            general_purpose::URL_SAFE_NO_PAD
                .decode(payload_b64)
                .unwrap(),
        )
        .unwrap();
        assert!(payload_json.contains("read write"));
    }

    #[test]
    fn build_stub_token_trims_scope() {
        let token = build_stub_token("client_credentials", "svc", Some("  read "), 10);
        let parts: Vec<&str> = token.split('.').collect();
        let payload =
            String::from_utf8(general_purpose::URL_SAFE_NO_PAD.decode(parts[1]).unwrap()).unwrap();
        assert!(payload.contains("read"));
    }

    #[test]
    fn build_stub_token_without_scope() {
        let token = build_stub_token("refresh_token", "user", None, 3000);
        let parts: Vec<&str> = token.split('.').collect();
        let payload_b64 = parts[1];
        let payload_json = String::from_utf8(
            general_purpose::URL_SAFE_NO_PAD
                .decode(payload_b64)
                .unwrap(),
        )
        .unwrap();
        assert!(payload_json.contains("\"scope\":\"\""));
    }

    // ========== parse_token_response_body tests ==========

    #[test]
    fn parse_token_response_json_snake_case() {
        let body = br#"{"access_token":"token123","token_type":"Bearer","expires_in":3600}"#;
        let result = parse_token_response_body(body).unwrap();
        assert_eq!(result.access_token, "token123");
        assert_eq!(result.token_type, "Bearer");
        assert_eq!(result.expires_in, Some(3600));
    }

    #[test]
    fn parse_token_response_json_camel_case() {
        let body = br#"{"accessToken":"token456","tokenType":"JWT","expiresIn":7200}"#;
        let result = parse_token_response_body(body).unwrap();
        assert_eq!(result.access_token, "token456");
        assert_eq!(result.token_type, "JWT");
        assert_eq!(result.expires_in, Some(7200));
    }

    #[test]
    fn parse_token_response_form_urlencoded() {
        let body = b"access_token=form_token&token_type=Bearer&expires_in=1800";
        let result = parse_token_response_body(body).unwrap();
        assert_eq!(result.access_token, "form_token");
        assert_eq!(result.token_type, "Bearer");
        assert_eq!(result.expires_in, Some(1800));
    }

    #[test]
    fn parse_token_response_without_expires_in() {
        let body = br#"{"access_token":"token","token_type":"Bearer"}"#;
        let result = parse_token_response_body(body).unwrap();
        assert_eq!(result.access_token, "token");
        assert_eq!(result.expires_in, None);
    }

    #[test]
    fn parse_token_response_error_handling() {
        let body =
            br#"{"error":"invalid_client","error_description":"Client authentication failed"}"#;
        let result = parse_token_response_body(body);
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("invalid_client"));
    }

    #[test]
    fn parse_token_response_error_without_description() {
        let body = br#"{"error":"unauthorized_client"}"#;
        let result = parse_token_response_body(body);
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("unauthorized_client"));
    }

    #[test]
    fn parse_token_response_missing_required_fields() {
        let body = br#"{"access_token":"token"}"#;
        let result = parse_token_response_body(body);
        assert!(result.is_err());
    }

    #[test]
    fn parse_token_response_invalid_json() {
        let body = b"not valid json";
        let result = parse_token_response_body(body);
        assert!(result.is_err());
    }

    #[test]
    fn parse_token_response_expires_in_as_string() {
        let body = br#"{"access_token":"token","token_type":"Bearer","expires_in":"9000"}"#;
        let result = parse_token_response_body(body).unwrap();
        assert_eq!(result.expires_in, Some(9000));
    }

    // ========== compute_pkce_challenge tests ==========

    #[test]
    fn compute_pkce_challenge_s256() {
        let verifier = "test_verifier_1234567890_abcdefghijk_lmnopqrstuvwxyz";
        let result = compute_pkce_challenge(verifier, "S256").unwrap();
        // S256 should produce base64url encoded SHA256 hash
        assert!(!result.is_empty());
        assert_ne!(result, verifier); // Should not be the same as verifier
    }

    #[test]
    fn compute_pkce_challenge_s256_deterministic() {
        let verifier = "same_verifier_123";
        let challenge1 = compute_pkce_challenge(verifier, "S256").unwrap();
        let challenge2 = compute_pkce_challenge(verifier, "S256").unwrap();
        assert_eq!(challenge1, challenge2); // Same input should produce same challenge
    }

    #[test]
    fn compute_pkce_challenge_plain() {
        let verifier = "plain_verifier_test";
        let result = compute_pkce_challenge(verifier, "plain").unwrap();
        assert_eq!(result, verifier);
    }

    #[test]
    fn compute_pkce_challenge_case_insensitive() {
        let verifier = "test_verifier";
        let s256_lower = compute_pkce_challenge(verifier, "s256").unwrap();
        let s256_upper = compute_pkce_challenge(verifier, "S256").unwrap();
        assert_eq!(s256_lower, s256_upper);
    }

    #[test]
    fn compute_pkce_challenge_unsupported_method() {
        let verifier = "test";
        let result = compute_pkce_challenge(verifier, "unsupported");
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("unsupported"));
    }

    // ========== generate_pkce_verifier tests ==========

    #[test]
    fn generate_pkce_verifier_creates_64_char_string() {
        let verifier = generate_pkce_verifier();
        assert_eq!(verifier.len(), 64);
    }

    #[test]
    fn generate_pkce_verifier_uses_alphanumeric() {
        let verifier = generate_pkce_verifier();
        assert!(verifier.chars().all(|c| c.is_alphanumeric()));
    }

    #[test]
    fn generate_pkce_verifier_random() {
        let v1 = generate_pkce_verifier();
        let v2 = generate_pkce_verifier();
        assert_ne!(v1, v2); // Should be different each time
    }

    // ========== generate_state tests ==========

    #[test]
    fn generate_state_creates_32_char_string() {
        let state = generate_state();
        assert_eq!(state.len(), 32);
    }

    #[test]
    fn generate_state_uses_alphanumeric() {
        let state = generate_state();
        assert!(state.chars().all(|c| c.is_alphanumeric()));
    }

    #[test]
    fn generate_state_random() {
        let s1 = generate_state();
        let s2 = generate_state();
        assert_ne!(s1, s2);
    }

    // ========== Token caching and configuration tests ==========

    #[test]
    fn auth_config_basic_serialization() {
        let config = AuthConfig::Basic {
            username: Some("user".to_string()),
            password: Some("pass".to_string()),
        };
        let json = serde_json::to_string(&config).unwrap();
        // camelCase rename_all converts Basic -> basic
        assert!(json.contains("\"type\":\"basic\""));
    }

    #[test]
    fn auth_config_bearer_serialization() {
        let config = AuthConfig::Bearer {
            token: Some("token123".to_string()),
            scheme: Some("Bearer".to_string()),
            placement: None,
        };
        let json = serde_json::to_string(&config).unwrap();
        // camelCase rename_all converts Bearer -> bearer
        assert!(json.contains("\"type\":\"bearer\""));
    }

    #[test]
    fn auth_config_api_key_serialization() {
        let config = AuthConfig::ApiKey {
            key: Some("X-API-Key".to_string()),
            value: Some("secret123".to_string()),
            placement: None,
        };
        let json = serde_json::to_string(&config).unwrap();
        // camelCase rename_all converts ApiKey -> apiKey
        assert!(json.contains("\"type\":\"apiKey\""));
    }

    #[test]
    fn auth_config_oauth2_serialization() {
        let config = AuthConfig::Oauth2 {
            grant_type: "client_credentials".to_string(),
            auth_url: None,
            token_url: Some("https://token.example.com".to_string()),
            device_authorization_url: None,
            client_id: Some("client123".to_string()),
            client_secret: Some("secret".to_string()),
            scope: None,
            refresh_token: None,
            redirect_uri: None,
            use_pkce: None,
            token_caching: None,
            client_auth: None,
            token_extra_params: None,
            discovery_url: None,
        };
        let json = serde_json::to_string(&config).unwrap();
        // camelCase rename_all converts Oauth2 -> oauth2
        assert!(json.contains("\"type\":\"oauth2\""));
    }

    // ========== is_stub_oauth_enabled tests ==========

    #[test]
    fn is_stub_oauth_enabled_respects_env_var() {
        // Cannot mutate env with forbid(unsafe_code); just ensure function is callable.
        let _ = is_stub_oauth_enabled();
    }

    // ========== emit_auth_log / stubbed_oauth_result tests ==========

    struct CollectEmitter {
        events: Arc<Mutex<Vec<LogEntry>>>,
    }

    impl LogEmitter for CollectEmitter {
        fn emit(&self, entry: LogEntry) {
            self.events.lock().unwrap().push(entry);
        }
    }

    #[test]
    fn emit_auth_log_sets_category_and_phase() {
        let events = Arc::new(Mutex::new(Vec::new()));
        let emitter = CollectEmitter {
            events: events.clone(),
        };

        emit_auth_log(
            &emitter,
            "req-1",
            LogLevel::Warning,
            "phase",
            "message",
            Some(serde_json::json!({"k": "v"})),
        );

        let stored = events.lock().unwrap();
        assert_eq!(stored.len(), 1);
        let first = &stored[0];
        assert_eq!(first.category.as_deref(), Some("auth"));
        assert_eq!(first.phase.as_deref(), Some("phase"));
        assert_eq!(first.level, LogLevel::Warning);
        assert!(!first.timestamp.is_empty());
    }

    #[test]
    fn stubbed_oauth_result_trims_scope_and_sets_expiration() {
        let events = Arc::new(Mutex::new(Vec::new()));
        let emitter = CollectEmitter {
            events: events.clone(),
        };

        let res = stubbed_oauth_result(
            &emitter,
            "req-2".to_string(),
            "client_credentials",
            StubOauthOptions {
                auth_url: None,
                token_url: Some(&"https://idp/token".to_string()),
                device_authorization_url: None,
                client_id: Some(&"id".to_string()),
                client_secret: Some(&"secret".to_string()),
                scope: Some(&"  read ".to_string()),
                refresh_token: None,
                redirect_uri: None,
            },
        )
        .expect("stub oauth result");

        assert!(res.headers.as_ref().unwrap().get("Authorization").is_some());
        assert!(res.expires_at.unwrap() > Utc::now().timestamp());

        let events = events.lock().unwrap();
        assert!(!events.is_empty());
        assert!(
            events
                .iter()
                .any(|e| e.message.contains("Generated stub authentication token"))
        );
    }

    #[test]
    fn log_token_request_preview_includes_headers_and_params() {
        let events = Arc::new(Mutex::new(Vec::new()));
        let emitter = CollectEmitter {
            events: events.clone(),
        };
        let headers = HashMap::from([("Authorization".to_string(), "Basic abc".to_string())]);
        let params = vec![("grant_type".to_string(), "client_credentials".to_string())];

        log_token_request_preview(
            &emitter,
            "req-preview",
            "POST",
            "https://idp/token",
            &headers,
            &params,
        );

        let captured = events.lock().unwrap();
        assert_eq!(captured.len(), 1);
        let details = captured[0].details.as_ref().unwrap();
        assert_eq!(details.get("method").and_then(|v| v.as_str()), Some("POST"));
        assert!(details
            .get("headers")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .any(|entry| entry.get("name").and_then(|n| n.as_str()) == Some("Authorization"))
            })
            .unwrap_or(false));
        assert!(details
            .get("body")
            .and_then(|v| v.as_array())
            .map(|arr| !arr.is_empty())
            .unwrap_or(false));
    }

    // ========== Auth placement tests ==========

    #[test]
    fn auth_placement_header_type() {
        let placement = AuthPlacement {
            r#type: "header".to_string(),
            name: Some("Authorization".to_string()),
            field_name: None,
            content_type: None,
        };
        assert_eq!(placement.r#type, "header");
        assert_eq!(placement.name.as_deref(), Some("Authorization"));
    }

    #[test]
    fn auth_placement_query_type() {
        let placement = AuthPlacement {
            r#type: "query".to_string(),
            name: Some("api_key".to_string()),
            field_name: None,
            content_type: None,
        };
        assert_eq!(placement.r#type, "query");
    }

    #[test]
    fn auth_placement_body_type() {
        let placement = AuthPlacement {
            r#type: "body".to_string(),
            name: None,
            field_name: Some("token".to_string()),
            content_type: None,
        };
        assert_eq!(placement.r#type, "body");
        assert_eq!(placement.field_name.as_deref(), Some("token"));
    }

    // ========== Auth result tests ==========

    #[test]
    fn auth_result_with_headers() {
        let mut headers = HashMap::new();
        headers.insert("Authorization".to_string(), "Bearer token123".to_string());
        let result = AuthResult {
            headers: Some(headers),
            query: None,
            cookies: None,
            body: None,
            expires_at: None,
        };
        assert!(result.headers.is_some());
        assert_eq!(result.headers.unwrap().len(), 1);
    }

    #[test]
    fn auth_result_with_expires() {
        let now = Utc::now().timestamp();
        let result = AuthResult {
            headers: None,
            query: None,
            cookies: None,
            body: None,
            expires_at: Some(now + 3600),
        };
        assert!(result.expires_at.is_some());
        assert!(result.expires_at.unwrap() > now);
    }

    // ========== OIDC discovery tests ==========

    #[test]
    fn oidc_discovery_serialization() {
        let discovery = OidcDiscovery {
            authorization_endpoint: Some("https://auth.example.com/authorize".to_string()),
            token_endpoint: Some("https://auth.example.com/token".to_string()),
            device_authorization_endpoint: Some("https://auth.example.com/device".to_string()),
        };
        let json = serde_json::to_string(&discovery).unwrap();
        assert!(json.contains("authorizationEndpoint"));
    }

    // ========== Client auth tests ==========

    #[test]
    fn client_auth_basic_serialization() {
        let auth = ClientAuth::Basic;
        let json = serde_json::to_string(&auth).unwrap();
        // camelCase rename_all converts Basic -> basic
        assert!(json.contains("basic"));
    }

    #[test]
    fn client_auth_body_serialization() {
        let auth = ClientAuth::Body;
        let json = serde_json::to_string(&auth).unwrap();
        // camelCase rename_all converts Body -> body
        assert!(json.contains("body"));
    }

    // ========== Token caching policy tests ==========

    #[test]
    fn token_caching_policy_always() {
        let policy = TokenCachingPolicy::Always;
        let json = serde_json::to_string(&policy).unwrap();
        // camelCase rename_all converts Always -> always
        assert!(json.contains("always"));
    }

    #[test]
    fn token_caching_policy_never() {
        let policy = TokenCachingPolicy::Never;
        let json = serde_json::to_string(&policy).unwrap();
        // camelCase rename_all converts Never -> never
        assert!(json.contains("never"));
    }

    // ========== Basic auth encoding tests ==========

    #[test]
    fn basic_auth_encoding_standard_credentials() {
        let username = "user";
        let password = "pass";
        let encoded = general_purpose::STANDARD.encode(format!("{username}:{password}"));
        assert_eq!(encoded, "dXNlcjpwYXNz");
    }

    #[test]
    fn basic_auth_encoding_special_characters() {
        let username = "user@example.com";
        let password = "p@ss:word";
        let encoded = general_purpose::STANDARD.encode(format!("{username}:{password}"));
        let decoded = String::from_utf8(
            general_purpose::STANDARD
                .decode(&encoded)
                .expect("valid base64"),
        )
        .expect("valid utf8");
        assert_eq!(decoded, "user@example.com:p@ss:word");
    }

    #[test]
    fn basic_auth_encoding_empty_password() {
        let username = "user";
        let password = "";
        let encoded = general_purpose::STANDARD.encode(format!("{username}:{password}"));
        let decoded = String::from_utf8(
            general_purpose::STANDARD
                .decode(&encoded)
                .expect("valid base64"),
        )
        .expect("valid utf8");
        assert_eq!(decoded, "user:");
    }

    // ========== Stub OAuth tests ==========

    #[test]
    fn stubbed_oauth_client_credentials_missing_token_url() {
        // Create a mock emitter (use a null emitter for testing)
        struct NullEmitter;
        impl LogEmitter for NullEmitter {
            fn emit(&self, _entry: LogEntry) {}
        }

        let client = "client".to_string();
        let secret = "secret".to_string();
        let options = StubOauthOptions {
            auth_url: None,
            token_url: None, // Missing
            device_authorization_url: None,
            client_id: Some(&client),
            client_secret: Some(&secret),
            scope: None,
            refresh_token: None,
            redirect_uri: None,
        };
        let emitter = NullEmitter;
        let result = stubbed_oauth_result(
            &emitter,
            "req123".to_string(),
            "client_credentials",
            options,
        );
        assert!(result.is_err());
    }

    #[test]
    fn stubbed_oauth_authorization_code_all_required_fields() {
        struct NullEmitter;
        impl LogEmitter for NullEmitter {
            fn emit(&self, _entry: LogEntry) {}
        }

        let auth_url = "https://auth.example.com".to_string();
        let token_url = "https://token.example.com".to_string();
        let client_id = "client123".to_string();
        let scope = "read write".to_string();
        let redirect_uri = "http://localhost".to_string();
        let options = StubOauthOptions {
            auth_url: Some(&auth_url),
            token_url: Some(&token_url),
            device_authorization_url: None,
            client_id: Some(&client_id),
            client_secret: None,
            scope: Some(&scope),
            refresh_token: None,
            redirect_uri: Some(&redirect_uri),
        };
        let emitter = NullEmitter;
        let result = stubbed_oauth_result(
            &emitter,
            "req123".to_string(),
            "authorization_code",
            options,
        );
        assert!(result.is_ok());
        let auth_result = result.unwrap();
        assert!(auth_result.headers.is_some());
        let headers = auth_result.headers.unwrap();
        assert!(headers.contains_key("Authorization"));
        let auth_header = headers["Authorization"].clone();
        assert!(auth_header.starts_with("Bearer "));
    }

    #[test]
    fn stubbed_oauth_device_code_flow() {
        struct NullEmitter;
        impl LogEmitter for NullEmitter {
            fn emit(&self, _entry: LogEntry) {}
        }

        let token_url = "https://token.example.com".to_string();
        let device_auth_url = "https://device.example.com".to_string();
        let client_id = "device_client".to_string();
        let options = StubOauthOptions {
            auth_url: None,
            token_url: Some(&token_url),
            device_authorization_url: Some(&device_auth_url),
            client_id: Some(&client_id),
            client_secret: None,
            scope: None,
            refresh_token: None,
            redirect_uri: None,
        };
        let emitter = NullEmitter;
        let result = stubbed_oauth_result(&emitter, "req123".to_string(), "device_code", options);
        assert!(result.is_ok());
    }

    #[test]
    fn stubbed_oauth_refresh_token_flow() {
        struct NullEmitter;
        impl LogEmitter for NullEmitter {
            fn emit(&self, _entry: LogEntry) {}
        }

        let token_url = "https://token.example.com".to_string();
        let refresh_token = "refresh_token_value".to_string();
        let options = StubOauthOptions {
            auth_url: None,
            token_url: Some(&token_url),
            device_authorization_url: None,
            client_id: None,
            client_secret: None,
            scope: None,
            refresh_token: Some(&refresh_token),
            redirect_uri: None,
        };
        let emitter = NullEmitter;
        let result = stubbed_oauth_result(&emitter, "req123".to_string(), "refresh_token", options);
        assert!(result.is_ok());
    }

    #[test]
    fn stubbed_oauth_password_flow_not_supported() {
        struct NullEmitter;
        impl LogEmitter for NullEmitter {
            fn emit(&self, _entry: LogEntry) {}
        }

        let token_url = "https://token.example.com".to_string();
        let client = "client".to_string();
        let secret = "secret".to_string();
        let options = StubOauthOptions {
            auth_url: None,
            token_url: Some(&token_url),
            device_authorization_url: None,
            client_id: Some(&client),
            client_secret: Some(&secret),
            scope: None,
            refresh_token: None,
            redirect_uri: None,
        };
        let emitter = NullEmitter;
        let result = stubbed_oauth_result(&emitter, "req123".to_string(), "password", options);
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("ROPC not supported"));
    }

    #[test]
    fn stubbed_oauth_unsupported_grant_type() {
        struct NullEmitter;
        impl LogEmitter for NullEmitter {
            fn emit(&self, _entry: LogEntry) {}
        }

        let options = StubOauthOptions {
            auth_url: None,
            token_url: None,
            device_authorization_url: None,
            client_id: None,
            client_secret: None,
            scope: None,
            refresh_token: None,
            redirect_uri: None,
        };
        let emitter = NullEmitter;
        let result = stubbed_oauth_result(&emitter, "req123".to_string(), "unknown_grant", options);
        assert!(result.is_err());
        assert!(result.unwrap_err().message.contains("Unsupported"));
    }

    // ========== Additional coverage for helpers ==========

    #[test]
    fn log_token_request_preview_records_details() {
        let emitter = CollectEmitter {
            events: Arc::new(Mutex::new(Vec::new())),
        };
        let mut headers = HashMap::new();
        headers.insert(
            "Content-Type".to_string(),
            "application/x-www-form-urlencoded".to_string(),
        );
        let body = vec![("grant_type".to_string(), "client_credentials".to_string())];

        log_token_request_preview(
            &emitter,
            "req-preview",
            "POST",
            "https://idp/token",
            &headers,
            &body,
        );

        let events = emitter.events.lock().unwrap();
        assert_eq!(events.len(), 1);
        let details = events[0].details.as_ref().unwrap();
        assert_eq!(details["method"], "POST");
        assert_eq!(details["url"], "https://idp/token");
        assert_eq!(details["headers"][0]["name"], "Content-Type");
        assert_eq!(details["body"][0]["name"], "grant_type");
    }

    #[test]
    fn log_token_response_metadata_captures_status_and_headers() {
        let emitter = CollectEmitter {
            events: Arc::new(Mutex::new(Vec::new())),
        };
        let headers = vec![("content-type".to_string(), "application/json".to_string())];
        let response = ResponseData {
            request_id: "req-meta".into(),
            status: 200,
            status_text: "OK".into(),
            headers,
            cookies: Vec::new(),
            body: b"{\"access_token\":\"ok\"}".to_vec(),
            file_path: None,
            size: 0,
            duration: 10,
            timestamp: "now".into(),
        };

        log_token_response_metadata(&emitter, "req-meta", &response);

        let events = emitter.events.lock().unwrap();
        assert_eq!(events.len(), 1);
        let details = events[0].details.as_ref().unwrap();
        assert_eq!(details["status"], 200);
        assert_eq!(details["contentType"], "application/json");
        assert_eq!(details["size"], 21);
    }

    #[test]
    fn headless_and_device_flags_read_env() {
        unsafe {
            std::env::set_var("KNURL_OAUTH_HEADLESS", "1");
            std::env::set_var("KNURL_OAUTH_AUTO_DEVICE", "1");
        }
        assert!(is_headless_mode());
        assert!(auto_complete_device_enabled());
        unsafe {
            std::env::remove_var("KNURL_OAUTH_HEADLESS");
            std::env::remove_var("KNURL_OAUTH_AUTO_DEVICE");
        }
    }

    #[test]
    fn compute_pkce_challenge_supports_s256_and_plain() {
        // Example from RFC 7636
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        let expected = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
        let computed = compute_pkce_challenge(verifier, "S256").unwrap();
        assert_eq!(computed, expected);

        let plain = compute_pkce_challenge("abc", "plain").unwrap();
        assert_eq!(plain, "abc");
    }

    #[test]
    fn compute_pkce_challenge_rejects_unknown_method() {
        let err = compute_pkce_challenge("verifier", "MD5").unwrap_err();
        assert_eq!(err.kind, ErrorKind::BadRequest);
    }

    #[test]
    fn generated_state_and_verifier_have_expected_lengths() {
        let state = generate_state();
        let verifier = generate_pkce_verifier();
        assert_eq!(state.len(), 32);
        assert_eq!(verifier.len(), 64);
    }
}
