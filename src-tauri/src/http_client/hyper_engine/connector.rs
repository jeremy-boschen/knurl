use std::fs;
use std::future::Future;
use std::io;
use std::net::{IpAddr, SocketAddr};
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll};
use std::time::{Duration, Instant};

use base64::Engine;
use base64::engine::general_purpose::STANDARD as Base64;
use hex::encode as hex_encode;
use hyper::http::Uri;
use hyper_rustls::HttpsConnectorBuilder;
use hyper_util::client::legacy::connect::HttpConnector;
use hyper_util::client::legacy::connect::dns::{GaiResolver, Name};
use hyper_util::rt::TokioIo;
use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::{
    ClientConfig, ClientConnection, DigitallySignedStruct, RootCertStore, SignatureScheme,
};
use rustls_pemfile::certs;
use serde::Serialize;
use serde_json::{Map, Value, json};
use sha2::{Digest, Sha256};
use tokio::net::TcpStream;
use tower_service::Service;
use x509_parser::objects::{oid_registry, oid2description, oid2sn};
use x509_parser::prelude::{FromDer, X509Certificate};
use x509_parser::public_key::PublicKey;
use x509_parser::x509::SubjectPublicKeyInfo;

use super::RequestLogger;
use crate::errors::{AppError, ErrorKind};
use crate::http_client::request::{HttpVersionPref, Request};

type HttpsStream = hyper_rustls::MaybeHttpsStream<TokioIo<TcpStream>>;

/// Build an HTTPS connector configured for the request, including DNS overrides and TLS settings.
pub(super) fn build_connector(
    request: &Request,
    uri: &Uri,
    logger: RequestLogger,
) -> Result<LoggingConnector<hyper_rustls::HttpsConnector<HttpConnector<OverrideResolver>>>, AppError>
{
    if uri.host().is_none() {
        return Err(AppError::new(ErrorKind::BadRequest, "URL missing host"));
    }

    let tls_config = build_tls_config(
        request.disable_ssl.unwrap_or(false),
        request.ca_path.as_deref(),
    )?;

    // Preference handled below after building DNS connector

    let port = uri
        .port_u16()
        .or_else(|| default_port_for_scheme(uri.scheme_str()))
        .unwrap_or(80);
    let host = uri.host().expect("host is checked above").to_string();

    let override_ip = request
        .ip_override
        .as_ref()
        .and_then(|value| {
            if value.trim().is_empty() {
                None
            } else {
                Some(value)
            }
        })
        .map(|value| {
            value.parse::<IpAddr>().map_err(|e| {
                AppError::new(ErrorKind::BadRequest, format!("Invalid IP override: {e}"))
            })
        })
        .transpose()?;

    let override_socket = override_ip.map(|ip| SocketAddr::new(ip, port));

    if let Some(socket) = override_socket {
        logger.info(
            "dns",
            Some("override"),
            format!("Applying DNS override for {host}:{port} -> {socket}"),
            Some(json!({
                "host": host,
                "port": port,
                "ip": socket.ip().to_string(),
            })),
        );
    }

    let resolver = OverrideResolver::new(host.clone(), override_socket, logger.clone());

    let mut http = HttpConnector::new_with_resolver(resolver);
    http.enforce_http(false);
    http.set_connect_timeout(Some(Duration::from_secs(10)));

    // Configure ALPN and HTTP protocol enablement based on preference
    let preference = request
        .http_version
        .clone()
        .unwrap_or(HttpVersionPref::Auto);
    let connector = match preference {
        HttpVersionPref::Auto => {
            logger.debug(
                "tls",
                Some("alpn_offer"),
                "ALPN: client will negotiate h2,http/1.1",
                Some(json!({"protocols": ["h2", "http/1.1"]})),
            );
            HttpsConnectorBuilder::new()
                .with_tls_config(tls_config)
                .https_or_http()
                .enable_http1()
                .enable_http2()
                .wrap_connector(http)
        }
        HttpVersionPref::Http1 => {
            logger.debug(
                "tls",
                Some("alpn_offer"),
                "ALPN: client will negotiate http/1.1 only",
                Some(json!({"protocols": ["http/1.1"]})),
            );
            HttpsConnectorBuilder::new()
                .with_tls_config(tls_config)
                .https_or_http()
                .enable_http1()
                .wrap_connector(http)
        }
        HttpVersionPref::Http2 => {
            logger.debug(
                "tls",
                Some("alpn_offer"),
                "ALPN: client will negotiate h2 only",
                Some(json!({"protocols": ["h2"]})),
            );
            HttpsConnectorBuilder::new()
                .with_tls_config(tls_config)
                .https_or_http()
                .enable_http2()
                .wrap_connector(http)
        }
    };

    Ok(LoggingConnector::new(connector, logger))
}

/// Extract a sanitized host header value from the override string, falling back to the URL host.
pub(super) fn compute_host_header(
    override_value: Option<&str>,
    uri_host: Option<&str>,
) -> Option<String> {
    match override_value.and_then(|value| sanitize_host_token(value).ok()) {
        Some(host) if !host.is_empty() => Some(host),
        _ => uri_host.map(|h| h.to_string()),
    }
}

fn sanitize_host_token(value: &str) -> Result<String, AppError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(String::new());
    }
    if trimmed.starts_with('[') {
        // IPv6 literal with optional port e.g. [::1]:443
        if let Some(end) = trimmed.find(']') {
            let host = &trimmed[..=end];
            return Ok(host.to_string());
        }
    }
    if let Some((host_part, port_part)) = trimmed.rsplit_once(':')
        && port_part.chars().all(|c| c.is_ascii_digit())
    {
        return Ok(host_part.to_string());
    }
    Ok(trimmed.to_string())
}

fn default_port_for_scheme(scheme: Option<&str>) -> Option<u16> {
    match scheme {
        Some("https") => Some(443),
        Some("http") => Some(80),
        _ => None,
    }
}

#[derive(Clone)]
pub(super) struct OverrideResolver {
    target_host: String,
    override_socket: Option<SocketAddr>,
    logger: RequestLogger,
}

impl OverrideResolver {
    fn new(
        target_host: String,
        override_socket: Option<SocketAddr>,
        logger: RequestLogger,
    ) -> Self {
        Self {
            target_host,
            override_socket,
            logger,
        }
    }
}

impl Service<Name> for OverrideResolver {
    type Response = std::vec::IntoIter<SocketAddr>;
    type Error = io::Error;
    type Future =
        Pin<Box<dyn std::future::Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn poll_ready(&mut self, _cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        Poll::Ready(Ok(()))
    }

    fn call(&mut self, name: Name) -> Self::Future {
        let override_socket = self.override_socket;
        let target_host = self.target_host.clone();
        let logger = self.logger.clone();
        let lookup = name.to_string();

        Box::pin(async move {
            let start = Instant::now();
            logger.debug(
                "dns",
                Some("lookup"),
                format!("Resolving host {lookup}"),
                Some(json!({"host": lookup})),
            );

            if let Some(socket) = override_socket
                && lookup.eq_ignore_ascii_case(&target_host)
            {
                logger.info(
                    "dns",
                    Some("override_hit"),
                    format!("DNS override hit: {lookup} -> {socket}"),
                    Some(json!({
                        "host": lookup,
                        "ip": socket.ip().to_string(),
                        "port": socket.port(),
                    })),
                );
                return Ok(vec![socket].into_iter());
            }

            let mut resolver = GaiResolver::new();

            match resolver.call(name).await {
                Ok(addrs) => {
                    let results: Vec<SocketAddr> = addrs.collect();
                    let elapsed = start.elapsed().as_millis();
                    let ipv4: Vec<String> = results
                        .iter()
                        .filter_map(|addr| match addr {
                            SocketAddr::V4(v4) => Some(v4.ip().to_string()),
                            _ => None,
                        })
                        .collect();
                    let ipv6: Vec<String> = results
                        .iter()
                        .filter_map(|addr| match addr {
                            SocketAddr::V6(v6) => Some(v6.ip().to_string()),
                            _ => None,
                        })
                        .collect();

                    logger.info(
                        "dns",
                        Some("resolved"),
                        format!("Host {lookup} was resolved."),
                        Some(json!({
                            "host": lookup.clone(),
                            "elapsedMs": elapsed,
                            "addresses": results.iter().map(|addr| addr.to_string()).collect::<Vec<_>>(),
                        })),
                    );

                    if ipv6.is_empty() {
                        logger.debug(
                            "dns",
                            Some("ipv6"),
                            "IPv6: (none)",
                            Some(json!({"host": lookup.clone()})),
                        );
                    } else {
                        logger.debug(
                            "dns",
                            Some("ipv6"),
                            format!("IPv6: {}", ipv6.join(", ")),
                            Some(json!({"host": lookup.clone(), "ipv6": ipv6})),
                        );
                    }

                    if ipv4.is_empty() {
                        logger.debug(
                            "dns",
                            Some("ipv4"),
                            "IPv4: (none)",
                            Some(json!({"host": lookup.clone()})),
                        );
                    } else {
                        logger.debug(
                            "dns",
                            Some("ipv4"),
                            format!("IPv4: {}", ipv4.join(", ")),
                            Some(json!({"host": lookup, "ipv4": ipv4})),
                        );
                    }

                    Ok(results.into_iter())
                }
                Err(err) => {
                    let elapsed = start.elapsed().as_millis();
                    logger.error(
                        "dns",
                        Some("error"),
                        format!("DNS lookup failed for {lookup}: {err}"),
                        Some(json!({
                            "host": lookup,
                            "elapsedMs": elapsed,
                            "error": err.to_string(),
                        })),
                    );
                    Err(err)
                }
            }
        })
    }
}

fn build_tls_config(
    disable_verification: bool,
    custom_ca: Option<&str>,
) -> Result<ClientConfig, AppError> {
    // Load OS trust store first; fall back to webpki roots if unavailable or empty.
    let mut roots = RootCertStore::empty();
    // rustls-native-certs 0.8 returns a CertificateResult with accessors
    // Iterate certificates if available and add them to the root store.
    let native = rustls_native_certs::load_native_certs();
    for cert in native.certs {
        let _ = roots.add(cert);
    }
    // Native certs should be sufficient for desktop apps
    // If empty, HTTPS connections will fail which is appropriate feedback

    if let Some(path) = custom_ca {
        let data = fs::read(path).map_err(|e| {
            AppError::new(ErrorKind::IoError, format!("Failed to read CA bundle: {e}"))
        })?;
        let mut reader = std::io::Cursor::new(data);
        let certificates = certs(&mut reader)
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::new(ErrorKind::BadRequest, format!("Invalid CA bundle: {e}")))?;
        let (added, _) = roots.add_parsable_certificates(certificates);
        if added == 0 {
            return Err(AppError::new(
                ErrorKind::BadRequest,
                "No valid certificates found in custom CA bundle",
            ));
        }
    }

    let mut config = ClientConfig::builder()
        .with_root_certificates(roots)
        .with_no_client_auth();

    if disable_verification {
        config
            .dangerous()
            .set_certificate_verifier(Arc::new(NoVerifier));
    }

    Ok(config)
}

#[derive(Debug)]
struct NoVerifier;

impl ServerCertVerifier for NoVerifier {
    fn verify_server_cert(
        &self,
        _end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _server_name: &ServerName,
        _ocsp: &[u8],
        _now: UnixTime,
    ) -> Result<ServerCertVerified, rustls::Error> {
        Ok(ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _signature: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _signature: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        vec![
            SignatureScheme::ECDSA_NISTP256_SHA256,
            SignatureScheme::ECDSA_NISTP384_SHA384,
            SignatureScheme::ECDSA_NISTP521_SHA512,
            SignatureScheme::RSA_PKCS1_SHA256,
            SignatureScheme::RSA_PKCS1_SHA384,
            SignatureScheme::RSA_PKCS1_SHA512,
            SignatureScheme::RSA_PSS_SHA256,
            SignatureScheme::RSA_PSS_SHA384,
            SignatureScheme::RSA_PSS_SHA512,
        ]
    }
}

#[derive(Clone)]
pub(super) struct LoggingConnector<C> {
    inner: C,
    logger: RequestLogger,
}

impl<C> LoggingConnector<C> {
    fn new(inner: C, logger: RequestLogger) -> Self {
        Self { inner, logger }
    }
}

impl<C> Service<Uri> for LoggingConnector<C>
where
    C: Service<Uri, Response = HttpsStream, Error = Box<dyn std::error::Error + Send + Sync>>
        + Clone
        + Send,
    C::Future: Send + 'static,
{
    type Response = C::Response;
    type Error = C::Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, req: Uri) -> Self::Future {
        let mut inner = self.inner.clone();
        let logger = self.logger.clone();
        let fut = inner.call(req);

        Box::pin(async move {
            match fut.await {
                Ok(stream) => {
                    log_connection_details(&logger, &stream);
                    Ok(stream)
                }
                Err(err) => {
                    logger.error(
                        "tls",
                        Some("error"),
                        format!("TLS connection failed: {err}"),
                        None,
                    );
                    Err(err)
                }
            }
        })
    }
}

fn log_connection_details(logger: &RequestLogger, stream: &HttpsStream) {
    match stream {
        hyper_rustls::MaybeHttpsStream::Https(tls_io) => {
            let tls_stream = tls_io.inner();
            let (io_wrapper, conn) = tls_stream.get_ref();
            let tcp = io_wrapper.inner().inner();
            let remote_addr = tcp.peer_addr().ok();
            let local_addr = tcp.local_addr().ok();
            log_tls_handshake(logger, conn, remote_addr, local_addr);
        }
        hyper_rustls::MaybeHttpsStream::Http(tcp_io) => {
            let tcp = tcp_io.inner();
            let remote_addr = tcp.peer_addr().ok();
            let local_addr = tcp.local_addr().ok();
            logger.info(
                "connect",
                Some("tcp"),
                "Established plain HTTP connection",
                Some(json!({
                    "remoteAddr": remote_addr.map(|a| a.to_string()),
                    "localAddr": local_addr.map(|a| a.to_string()),
                })),
            );
        }
    }
}

fn log_tls_handshake(
    logger: &RequestLogger,
    conn: &ClientConnection,
    remote_addr: Option<SocketAddr>,
    local_addr: Option<SocketAddr>,
) {
    let alpn = conn
        .alpn_protocol()
        .map(|proto| String::from_utf8_lossy(proto).to_string());
    let protocol = conn
        .protocol_version()
        .map(|version| format!("{version:?}"));
    let cipher = conn
        .negotiated_cipher_suite()
        .map(|suite| format!("{:?}", suite.suite()));

    let mut details = Map::new();

    if let Some(addr) = remote_addr {
        details.insert("remoteAddr".to_string(), json!(addr.to_string()));
        logger.debug(
            "connect",
            Some("trying"),
            format!("Trying {addr}..."),
            Some(json!({"remoteAddr": addr.to_string()})),
        );
    }
    if let Some(addr) = local_addr {
        details.insert("localAddr".to_string(), json!(addr.to_string()));
        logger.debug(
            "tls",
            Some("endpoint"),
            format!("Local address: {addr}"),
            Some(json!({"localAddr": addr.to_string()})),
        );
    }

    match protocol.clone() {
        Some(proto) => {
            details.insert("protocol".to_string(), json!(proto));
            logger.debug(
                "tls",
                Some("protocol"),
                format!("Negotiated TLS version: {proto}"),
                Some(json!({"protocol": proto})),
            );
        }
        None => {
            logger.debug(
                "tls",
                Some("protocol"),
                "Negotiated TLS version: <unknown>",
                None,
            );
        }
    }

    match cipher.clone() {
        Some(cipher_suite) => {
            details.insert("cipherSuite".to_string(), json!(cipher_suite));
            logger.debug(
                "tls",
                Some("cipher"),
                format!("Cipher suite: {cipher_suite}"),
                Some(json!({"cipherSuite": cipher_suite})),
            );
        }
        None => logger.debug("tls", Some("cipher"), "Cipher suite: <unknown>", None),
    }

    match alpn.clone() {
        Some(proto) => {
            details.insert("alpn".to_string(), json!(proto));
            logger.debug(
                "tls",
                Some("alpn_selected"),
                format!("ALPN: server accepted {proto}"),
                Some(json!({"selected": proto})),
            );
        }
        None => logger.debug(
            "tls",
            Some("alpn_selected"),
            "ALPN: no protocol negotiated",
            None,
        ),
    }

    if let Some(certs) = conn.peer_certificates() {
        let summaries: Vec<_> = certs
            .iter()
            .enumerate()
            .map(|(idx, cert)| summarize_certificate(idx, cert))
            .collect();

        for summary in &summaries {
            let block = format_certificate_block(summary);
            logger.debug(
                "tls",
                Some("certificate"),
                block,
                Some(json!({"index": summary.index, "summary": summary})),
            );
        }

        details.insert("peerCertificates".to_string(), json!(summaries));
    }

    logger.info(
        "tls",
        Some("handshake"),
        "TLS handshake complete",
        Some(Value::Object(details)),
    );
}

#[derive(Serialize)]
struct CertificateSummary {
    index: usize,
    sha256: String,
    subject: Option<String>,
    issuer: Option<String>,
    version: Option<String>,
    serial: Option<String>,
    signature_algorithm: Option<String>,
    signature_algorithm_oid: Option<String>,
    signature_algorithm_description: Option<String>,
    not_before: Option<String>,
    not_after: Option<String>,
    public_key_algorithm: Option<String>,
    public_key_algorithm_oid: Option<String>,
    public_key_algorithm_description: Option<String>,
    public_key: Option<KeyDetails>,
    signature_lines: Option<Vec<String>>,
    pem: String,
}

#[derive(Serialize)]
struct KeyDetails {
    kind: String,
    bits: Option<usize>,
    modulus_lines: Option<Vec<String>>,
    exponent_decimal: Option<String>,
    exponent_hex: Option<String>,
    data_lines: Option<Vec<String>>,
    curve: Option<String>,
    curve_oid: Option<String>,
    curve_description: Option<String>,
}

fn summarize_certificate(index: usize, cert: &CertificateDer<'_>) -> CertificateSummary {
    let der = cert.as_ref();
    let fingerprint = hex_encode(Sha256::digest(der));
    let pem = encode_pem_block("CERTIFICATE", der);

    let mut summary = CertificateSummary {
        index,
        sha256: fingerprint,
        subject: None,
        issuer: None,
        version: None,
        serial: None,
        signature_algorithm: None,
        signature_algorithm_oid: None,
        signature_algorithm_description: None,
        not_before: None,
        not_after: None,
        public_key_algorithm: None,
        public_key_algorithm_oid: None,
        public_key_algorithm_description: None,
        public_key: None,
        signature_lines: None,
        pem,
    };

    if let Ok((_, parsed)) = X509Certificate::from_der(der) {
        summary.subject = Some(parsed.subject().to_string());
        summary.issuer = Some(parsed.issuer().to_string());
        summary.version = Some(parsed.version().0.to_string());
        summary.serial = Some(parsed.tbs_certificate.raw_serial_as_string());
        summary.not_before = Some(parsed.validity().not_before.to_string());
        summary.not_after = Some(parsed.validity().not_after.to_string());

        let signature_oid = &parsed.signature_algorithm.algorithm;
        let sig_dotted = signature_oid.to_string();
        let sig_name = oid2sn(signature_oid, oid_registry())
            .map(|s| s.to_string())
            .unwrap_or_else(|_| sig_dotted.clone());
        let sig_desc = oid2description(signature_oid, oid_registry())
            .ok()
            .map(|s| s.to_string());
        summary.signature_algorithm = Some(sig_name);
        summary.signature_algorithm_oid = Some(sig_dotted);
        summary.signature_algorithm_description = sig_desc;

        let signature_lines = format_hex_lines(parsed.signature_value.data.as_ref(), 16);
        if !signature_lines.is_empty() {
            summary.signature_lines = Some(signature_lines);
        }

        let public_key = parsed.public_key();
        let pk_oid = public_key.algorithm.oid();
        let pk_dotted = pk_oid.to_string();
        let pk_name = oid2sn(pk_oid, oid_registry())
            .map(|s| s.to_string())
            .unwrap_or_else(|_| pk_dotted.clone());
        let pk_desc = oid2description(pk_oid, oid_registry())
            .ok()
            .map(|s| s.to_string());
        summary.public_key_algorithm = Some(pk_name);
        summary.public_key_algorithm_oid = Some(pk_dotted);
        summary.public_key_algorithm_description = pk_desc;

        if let Ok(parsed_key) = public_key.parsed() {
            let mut details = extract_key_details(parsed_key);
            if let Some((curve_oid, curve_name, curve_desc)) =
                extract_named_curve_from_spki(public_key)
            {
                details.curve_oid = Some(curve_oid);
                details.curve = Some(curve_name);
                details.curve_description = curve_desc;
            }
            summary.public_key = Some(details);
        }
    }

    summary
}

fn extract_key_details(key: PublicKey<'_>) -> KeyDetails {
    match key {
        PublicKey::RSA(rsa) => {
            let modulus = strip_leading_zero(rsa.modulus);
            let modulus_lines = format_hex_lines(modulus, 16);
            let bits = Some(calculate_key_bits(modulus));
            let exponent_decimal = rsa.try_exponent().ok().map(|v| v.to_string());
            let exponent_hex = rsa
                .try_exponent()
                .ok()
                .map(|v| format!("0x{v:x}"))
                .or_else(|| {
                    Some(format!(
                        "0x{}",
                        hex_encode(strip_leading_zero(rsa.exponent))
                    ))
                });

            KeyDetails {
                kind: "RSA".to_string(),
                bits,
                modulus_lines: Some(modulus_lines),
                exponent_decimal,
                exponent_hex,
                data_lines: None,
                curve: None,
                curve_oid: None,
                curve_description: None,
            }
        }
        PublicKey::EC(ec) => {
            let data_lines = format_hex_lines(ec.data(), 16);
            KeyDetails {
                kind: "EC".to_string(),
                bits: Some(calculate_key_bits(strip_leading_zero(ec.data()))),
                modulus_lines: None,
                exponent_decimal: None,
                exponent_hex: None,
                data_lines: Some(data_lines),
                curve: None,
                curve_oid: None,
                curve_description: None,
            }
        }
        PublicKey::DSA(y) => {
            let data_lines = format_hex_lines(strip_leading_zero(y), 16);
            KeyDetails {
                kind: "DSA".to_string(),
                bits: Some(calculate_key_bits(strip_leading_zero(y))),
                modulus_lines: None,
                exponent_decimal: None,
                exponent_hex: None,
                data_lines: Some(data_lines),
                curve: None,
                curve_oid: None,
                curve_description: None,
            }
        }
        PublicKey::GostR3410(y) | PublicKey::GostR3410_2012(y) => {
            let data_lines = format_hex_lines(strip_leading_zero(y), 16);
            KeyDetails {
                kind: "GOST".to_string(),
                bits: Some(calculate_key_bits(strip_leading_zero(y))),
                modulus_lines: None,
                exponent_decimal: None,
                exponent_hex: None,
                data_lines: Some(data_lines),
                curve: None,
                curve_oid: None,
                curve_description: None,
            }
        }
        PublicKey::Unknown(bytes) => {
            let data_lines = format_hex_lines(bytes, 16);
            KeyDetails {
                kind: "Unknown".to_string(),
                bits: None,
                modulus_lines: None,
                exponent_decimal: None,
                exponent_hex: None,
                data_lines: Some(data_lines),
                curve: None,
                curve_oid: None,
                curve_description: None,
            }
        }
    }
}

fn format_certificate_block(summary: &CertificateSummary) -> String {
    let mut lines = Vec::new();
    lines.push(format!("[#{}] Certificate", summary.index));
    if let Some(subject) = &summary.subject {
        lines.push(format!("  Subject: {subject}"));
    }
    if let Some(issuer) = &summary.issuer {
        lines.push(format!("  Issuer: {issuer}"));
    }
    lines.push(format!("  SHA-256: {}", summary.sha256));
    if let Some(version) = &summary.version {
        lines.push(format!("  Version: {version}"));
    }
    if let Some(serial) = &summary.serial {
        lines.push(format!("  Serial: {serial}"));
    }
    if let Some(sig_alg) = &summary.signature_algorithm {
        let mut sig = format!("  Signature Algorithm: {sig_alg}");
        if let Some(oid) = &summary.signature_algorithm_oid {
            sig.push_str(&format!(" (oid: {oid})"));
        }
        if let Some(desc) = &summary.signature_algorithm_description {
            sig.push_str(&format!(" – {desc}"));
        }
        lines.push(sig);
    }
    if let Some(nb) = &summary.not_before {
        lines.push(format!("  Not Before: {nb}"));
    }
    if let Some(na) = &summary.not_after {
        lines.push(format!("  Not After: {na}"));
    }
    if let Some(pk_alg) = &summary.public_key_algorithm {
        let mut pk = format!("  Public Key Algorithm: {pk_alg}");
        if let Some(oid) = &summary.public_key_algorithm_oid {
            pk.push_str(&format!(" (oid: {oid})"));
        }
        if let Some(desc) = &summary.public_key_algorithm_description {
            pk.push_str(&format!(" – {desc}"));
        }
        lines.push(pk);
    }
    if let Some(key) = &summary.public_key {
        let kind = &key.kind;
        let bits = key
            .bits
            .map(|b| b.to_string())
            .unwrap_or_else(|| "?".to_string());
        lines.push(format!("  Public Key: {kind} ({bits} bits)"));
        if let Some(curve) = &key.curve {
            let mut cur = format!("    Curve: {curve}");
            if let Some(oid) = &key.curve_oid {
                cur.push_str(&format!(" (oid: {oid})"));
            }
            if let Some(desc) = &key.curve_description {
                cur.push_str(&format!(" – {desc}"));
            }
            lines.push(cur);
        }
        if let Some(hex) = &key.exponent_hex {
            let mut e = format!("    rsa(e): {hex}");
            if let Some(dec) = &key.exponent_decimal {
                e.push_str(&format!(" ({dec} dec)"));
            }
            lines.push(e);
        }
        if let Some(mod_lines) = &key.modulus_lines
            && !mod_lines.is_empty()
        {
            lines.push("    rsa(n):".to_string());
            for m in mod_lines {
                lines.push(format!("      {m}"));
            }
        }
        if let Some(data_lines) = &key.data_lines
            && !data_lines.is_empty()
        {
            lines.push("    key-data:".to_string());
            for d in data_lines {
                lines.push(format!("      {d}"));
            }
        }
    }
    if let Some(sig_lines) = &summary.signature_lines
        && !sig_lines.is_empty()
    {
        lines.push("  Signature:".to_string());
        for s in sig_lines {
            lines.push(format!("    {s}"));
        }
    }
    lines.join("\n")
}

/// Attempt to extract a named EC curve from the SPKI algorithm parameters.
/// Returns (curve_oid, curve_name, curve_description) when available.
fn extract_named_curve_from_spki(
    spki: &SubjectPublicKeyInfo<'_>,
) -> Option<(String, String, Option<String>)> {
    // For EC public keys, the algorithm parameters typically contain the curve OID.
    // x509-parser exposes parameters as a DER value we can try to interpret as an OID.
    let params = spki.algorithm.parameters.as_ref()?;
    // Best-effort: interpret parameters as an OID; ignore if it's another form (explicit parameters).
    let curve_oid = params.as_oid().ok()?;
    let dotted = curve_oid.to_string();
    let name = oid2sn(&curve_oid, oid_registry())
        .map(|s| s.to_string())
        .unwrap_or_else(|_| dotted.clone());
    let desc = oid2description(&curve_oid, oid_registry())
        .ok()
        .map(|s| s.to_string());
    Some((dotted, name, desc))
}

fn format_hex_lines(bytes: &[u8], row_size: usize) -> Vec<String> {
    bytes
        .chunks(row_size)
        .map(|chunk| {
            let mut joined = chunk
                .iter()
                .map(|b| format!("{b:02x}"))
                .collect::<Vec<_>>()
                .join(":");
            joined.push(':');
            joined
        })
        .collect()
}

fn strip_leading_zero(mut bytes: &[u8]) -> &[u8] {
    while let Some((&0u8, rest)) = bytes.split_first() {
        bytes = rest;
    }
    bytes
}

fn calculate_key_bits(bytes: &[u8]) -> usize {
    if bytes.is_empty() {
        return 0;
    }
    let mut slice = bytes;
    while let Some((first, rest)) = slice.split_first() {
        if *first == 0 {
            slice = rest;
        } else {
            let leading = first.leading_zeros() as usize;
            return slice.len() * 8 - leading;
        }
        if slice.is_empty() {
            return 0;
        }
    }
    0
}

fn encode_pem_block(label: &str, der: &[u8]) -> String {
    let encoded = Base64.encode(der);
    let mut pem = String::new();
    pem.push_str(&format!("-----BEGIN {label}-----\n"));
    for chunk in encoded.as_bytes().chunks(64) {
        pem.push_str(std::str::from_utf8(chunk).unwrap_or(""));
        pem.push('\n');
    }
    pem.push_str(&format!("-----END {label}-----"));
    pem
}
