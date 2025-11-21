#!/usr/bin/env node

import basicAuth from 'basic-auth';
import { randomUUID } from 'node:crypto';
import { OAuth2Server } from 'oauth2-mock-server';
import { urlencoded } from 'express';

const DEVICE_CODE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);
const TOKEN_TTL = 3600;
const DEVICE_CODE_TTL_SEC = 600;
const DEVICE_POLL_INTERVAL_SEC = 5;

const clients = new Map([
  [
    'test-client',
    {
      clientId: 'test-client',
      clientSecret: 'test-secret',
      redirectUris: [
        'http://localhost:5173/callback',
        'http://127.0.0.1:5173/callback',
        'http://localhost:1420/oauth/callback',
        'http://127.0.0.1:1420/oauth/callback',
        'tauri://localhost/oauth/callback',
      ],
      allowedGrants: new Set(['authorization_code', 'client_credentials', 'refresh_token', DEVICE_CODE_GRANT]),
      requirePkce: true,
      allowedScopes: new Set(['openid', 'profile', 'email', 'offline_access', 'api.read', 'api.write']),
      defaultScopes: ['openid', 'profile', 'offline_access'],
    },
  ],
  [
    'service-client',
    {
      clientId: 'service-client',
      clientSecret: 'service-secret',
      redirectUris: [],
      allowedGrants: new Set(['client_credentials']),
      requirePkce: false,
      allowedScopes: new Set(['api.read', 'api.write']),
      defaultScopes: ['api.read'],
    },
  ],
  [
    'public-device-client',
    {
      clientId: 'public-device-client',
      clientSecret: undefined,
      redirectUris: [],
      allowedGrants: new Set([DEVICE_CODE_GRANT]),
      requirePkce: false,
      allowedScopes: new Set(['openid', 'profile', 'offline_access']),
      defaultScopes: ['openid', 'profile'],
    },
  ],
]);

const authorizationCodes = new Map();
const deviceSessions = new Map();
const userCodeIndex = new Map();
const refreshTokens = new Map();

function nowMs() {
  return Date.now();
}

function firstString(value) {
  if (Array.isArray(value)) {
    return value[0];
  }
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
}

function parseScopes(scope, fallback = []) {
  if (typeof scope !== 'string') {
    return [...fallback];
  }
  const parts = scope
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return [...fallback];
  }
  return parts;
}

function normalizeRedirectUri(uri) {
  try {
    const parsed = new URL(uri);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'tauri:') {
      // Remove default ports to ease matching
      if ((parsed.protocol === 'http:' && parsed.port === '80') || (parsed.protocol === 'https:' && parsed.port === '443')) {
        parsed.port = '';
      }
      return parsed.toString();
    }
  } catch {
    // ignore
  }
  return uri;
}

function wrapNamedHandler(app, path, handlerName, wrapper) {
  const layer = app.router.stack.find((entry) => entry.route?.path === path);
  if (!layer) {
    throw new Error(`Failed to locate route "${path}"`);
  }
  const target = layer.route.stack.find((entry) => entry.name === handlerName);
  if (!target) {
    throw new Error(`Failed to wrap handler "${handlerName}" for route "${path}"`);
  }
  const original = target.handle;
  target.handle = wrapper(original);
}

function extractClientAuth(req) {
  const credentials = basicAuth(req);
  if (credentials?.name) {
    return {
      clientId: credentials.name,
      clientSecret: credentials.pass ?? '',
      method: 'basic',
    };
  }
  const bodyId = typeof req.body?.client_id === 'string' ? req.body.client_id : undefined;
  const bodySecret = typeof req.body?.client_secret === 'string' ? req.body.client_secret : undefined;
  if (bodyId) {
    return { clientId: bodyId, clientSecret: bodySecret ?? '', method: 'body' };
  }
  return { clientId: undefined, clientSecret: undefined, method: 'none' };
}

function ensureClientAllowed(client, grantType) {
  return client.allowedGrants.has(grantType);
}

function validateClientSecret(client, auth) {
  if (client.clientSecret) {
    if (auth.method === 'none') {
      return { ok: false, error: { status: 401, body: { error: 'invalid_client', error_description: 'client authentication required' } } };
    }
    if (auth.clientSecret !== client.clientSecret) {
      return { ok: false, error: { status: 401, body: { error: 'invalid_client', error_description: 'client secret mismatch' } } };
    }
    return { ok: true };
  }
  if (auth.method === 'basic' && auth.clientSecret) {
    return { ok: false, error: { status: 401, body: { error: 'invalid_client', error_description: 'public client must not provide secret' } } };
  }
  return { ok: true };
}

function respondJson(res, status, body) {
  console.debug(`[RESPONSE] Status: ${status}`, JSON.stringify(body, null, 2));
  res.status(status).json(body);
}

async function handleDeviceTokenRequest(server, req, res, client, auth) {
  const validation = validateClientSecret(client, auth);
  if (!validation.ok) {
    respondJson(res, validation.error.status, validation.error.body);
    return;
  }
  if (!ensureClientAllowed(client, DEVICE_CODE_GRANT)) {
    respondJson(res, 400, { error: 'unauthorized_client' });
    return;
  }
  const deviceCode = typeof req.body?.device_code === 'string' ? req.body.device_code : undefined;
  if (!deviceCode) {
    respondJson(res, 400, { error: 'invalid_request', error_description: 'device_code required' });
    return;
  }
  const session = deviceSessions.get(deviceCode);
  if (!session) {
    respondJson(res, 400, { error: 'invalid_grant' });
    return;
  }
  if (session.clientId !== client.clientId) {
    respondJson(res, 400, { error: 'invalid_grant' });
    return;
  }
  if (session.expiresAt <= nowMs()) {
    deviceSessions.delete(deviceCode);
    userCodeIndex.delete(session.userCode);
    respondJson(res, 400, { error: 'expired_token' });
    return;
  }
  const now = nowMs();
  if (!session.approvedAt) {
    if (session.lastPoll && now - session.lastPoll < DEVICE_POLL_INTERVAL_SEC * 1000) {
      session.lastPoll = now;
      respondJson(res, 400, { error: 'slow_down' });
      return;
    }
    session.lastPoll = now;
    respondJson(res, 400, { error: 'authorization_pending' });
    return;
  }
  if (session.consumedAt) {
    respondJson(res, 400, { error: 'invalid_grant' });
    return;
  }
  session.consumedAt = now;
  const scope = session.scopes.join(' ');
  const subject = session.subject ?? 'device-user@example.com';
  const transform = (_header, payload) => {
    payload.scope = scope;
    payload.sub = subject;
    payload.amr = ['mfa'];
    payload.auth_time = Math.floor(session.approvedAt / 1000);
  };
  const accessToken = await server.service.buildToken(req, TOKEN_TTL, transform);
  const refreshToken = randomUUID();
  refreshTokens.set(refreshToken, {
    clientId: client.clientId,
    scope: session.scopes,
    subject,
    issuedAt: now,
  });
  respondJson(res, 200, {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: TOKEN_TTL,
    scope,
    refresh_token: refreshToken,
  });
  deviceSessions.delete(deviceCode);
  userCodeIndex.delete(session.userCode);
}

async function main() {
  console.log('Configuring OAuth 2.0 mock server...');
  const server = new OAuth2Server();
  await server.issuer.keys.generate('RS256');

  const app = server.service.requestHandler;

  wrapNamedHandler(app, '/.well-known/openid-configuration', 'openidConfigurationHandler', (original) => async (req, res, next) => {
    console.debug('[DISCOVERY ENDPOINT] OpenID Connect discovery requested');
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      console.debug('[DISCOVERY ENDPOINT] Sending configuration:', { issuer: body.issuer, token_endpoint: body.token_endpoint, authorization_endpoint: body.authorization_endpoint });
      const issuer = server.issuer.url;
      const base = issuer ? issuer.replace(/\/$/, '') : `http://${HOST}:${PORT}`;
      const grantTypes = new Set([...(body.grant_types_supported ?? []), 'refresh_token', DEVICE_CODE_GRANT]);
      return originalJson({
        ...body,
        token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
        grant_types_supported: Array.from(grantTypes),
        scopes_supported: ['openid', 'profile', 'email', 'offline_access', 'api.read', 'api.write'],
        device_authorization_endpoint: `${base}/device_authorization`,
      });
    };
    try {
      await original(req, res, next);
    } finally {
      res.json = originalJson;
    }
  });

  wrapNamedHandler(app, '/authorize', 'authorizeHandler', (original) => async (req, res, next) => {
    console.debug('[AUTHORIZE ENDPOINT] Query params:', { client_id: req.query.client_id, redirect_uri: req.query.redirect_uri, scope: req.query.scope });
    const clientId = firstString(req.query.client_id);
    if (!clientId) {
      respondJson(res, 400, { error: 'invalid_request', error_description: 'client_id required' });
      return;
    }
    const client = clients.get(clientId);
    if (!client) {
      respondJson(res, 400, { error: 'invalid_client' });
      return;
    }
    if (!ensureClientAllowed(client, 'authorization_code')) {
      respondJson(res, 400, { error: 'unauthorized_client' });
      return;
    }
    const redirectUri = firstString(req.query.redirect_uri);
    if (!redirectUri) {
      respondJson(res, 400, { error: 'invalid_request', error_description: 'redirect_uri required' });
      return;
    }
    const normalized = normalizeRedirectUri(redirectUri);
    const allowedRedirects = client.redirectUris.map(normalizeRedirectUri);
    if (!allowedRedirects.includes(normalized)) {
      respondJson(res, 400, { error: 'invalid_request', error_description: 'redirect_uri not registered' });
      return;
    }
    if (client.requirePkce && !firstString(req.query.code_challenge)) {
      respondJson(res, 400, { error: 'invalid_request', error_description: 'PKCE required' });
      return;
    }
    const requestedScopes = parseScopes(firstString(req.query.scope), client.defaultScopes);
    const invalidScope = requestedScopes.find((scope) => !client.allowedScopes.has(scope));
    if (invalidScope) {
      respondJson(res, 400, { error: 'invalid_scope', error_description: `scope ${invalidScope} not allowed` });
      return;
    }
    req.query.scope = requestedScopes.join(' ');
    await original(req, res, next);
  });

  wrapNamedHandler(app, '/token', 'tokenHandler', (original) => async (req, res, next) => {
    console.debug('[TOKEN ENDPOINT] Request body:', JSON.stringify(req.body, null, 2));
    console.debug('[TOKEN ENDPOINT] Auth headers:', req.headers.authorization ? '***' : 'none');
    const grantTypeRaw = typeof req.body?.grant_type === 'string' ? req.body.grant_type : '';
    const grantType = grantTypeRaw || '';
    const auth = extractClientAuth(req);
    console.debug('[TOKEN ENDPOINT] Extracted auth:', { clientId: auth.clientId, method: auth.method });
    const client = auth.clientId ? clients.get(auth.clientId) : undefined;

    if (grantType === DEVICE_CODE_GRANT || grantType === 'device_code') {
      if (!client || !auth.clientId) {
        respondJson(res, 401, { error: 'invalid_client' });
        return;
      }
      await handleDeviceTokenRequest(server, req, res, client, auth);
      return;
    }

    if (!client) {
      respondJson(res, 401, { error: 'invalid_client' });
      return;
    }

    const secretValidation = validateClientSecret(client, auth);
    if (!secretValidation.ok) {
      respondJson(res, secretValidation.error.status, secretValidation.error.body);
      return;
    }

    if (!grantType) {
      respondJson(res, 400, { error: 'invalid_request', error_description: 'grant_type required' });
      return;
    }

    if (!ensureClientAllowed(client, grantType)) {
      respondJson(res, 400, { error: 'unauthorized_client' });
      return;
    }

    if (grantType === 'authorization_code') {
      const code = typeof req.body?.code === 'string' ? req.body.code : undefined;
      if (!code) {
        respondJson(res, 400, { error: 'invalid_request', error_description: 'code required' });
        return;
      }
      const record = authorizationCodes.get(code);
      if (!record) {
        respondJson(res, 400, { error: 'invalid_grant' });
        return;
      }
      if (record.clientId !== client.clientId) {
        respondJson(res, 400, { error: 'invalid_grant' });
        return;
      }
      if (record.expiresAt <= nowMs()) {
        authorizationCodes.delete(code);
        respondJson(res, 400, { error: 'invalid_grant' });
        return;
      }
      const redirectUri = typeof req.body?.redirect_uri === 'string' ? req.body.redirect_uri : undefined;
      if (redirectUri && normalizeRedirectUri(redirectUri) !== record.redirectUri) {
        respondJson(res, 400, { error: 'invalid_grant', error_description: 'redirect_uri mismatch' });
        return;
      }
      req.body.scope = record.scope.join(' ');
      authorizationCodes.delete(code);
    }

    if (grantType === 'refresh_token') {
      const token = typeof req.body?.refresh_token === 'string' ? req.body.refresh_token : undefined;
      if (!token) {
        respondJson(res, 400, { error: 'invalid_request', error_description: 'refresh_token required' });
        return;
      }
      const stored = refreshTokens.get(token);
      if (!stored) {
        respondJson(res, 400, { error: 'invalid_grant' });
        return;
      }
      if (stored.clientId !== client.clientId) {
        respondJson(res, 400, { error: 'invalid_grant' });
        return;
      }
      req.body.scope = stored.scope.join(' ');
    }

    await original(req, res, next);
  });

  app.post('/device_authorization', urlencoded({ extended: false }), (req, res) => {
    console.debug('[DEVICE AUTHORIZATION ENDPOINT] Request body:', JSON.stringify(req.body, null, 2));
    console.debug('[DEVICE AUTHORIZATION ENDPOINT] Auth headers:', req.headers.authorization ? '***' : 'none');
    const auth = extractClientAuth(req);
    console.debug('[DEVICE AUTHORIZATION ENDPOINT] Extracted auth:', { clientId: auth.clientId, method: auth.method });
    if (!auth.clientId) {
      respondJson(res, 400, { error: 'invalid_client' });
      return;
    }
    const client = clients.get(auth.clientId);
    if (!client) {
      respondJson(res, 400, { error: 'invalid_client' });
      return;
    }
    const validation = validateClientSecret(client, auth);
    if (!validation.ok) {
      respondJson(res, validation.error.status, validation.error.body);
      return;
    }
    if (!ensureClientAllowed(client, DEVICE_CODE_GRANT)) {
      respondJson(res, 400, { error: 'unauthorized_client' });
      return;
    }
    const scopes = parseScopes(req.body?.scope, client.defaultScopes);
    const invalidScope = scopes.find((scope) => !client.allowedScopes.has(scope));
    if (invalidScope) {
      respondJson(res, 400, { error: 'invalid_scope', error_description: `scope ${invalidScope} not allowed` });
      return;
    }
    const deviceCode = randomUUID();
    const userCode = randomUUID().slice(0, 8).toUpperCase();
    const issuedAt = nowMs();
    const expiresAt = issuedAt + DEVICE_CODE_TTL_SEC * 1000;
    const subject = 'mock-user@example.com';
    deviceSessions.set(deviceCode, {
      clientId: client.clientId,
      userCode,
      scopes,
      issuedAt,
      expiresAt,
      interval: DEVICE_POLL_INTERVAL_SEC,
      subject,
    });
    userCodeIndex.set(userCode, deviceCode);
    const issuer = server.issuer.url;
    const base = issuer ? issuer.replace(/\/$/, '') : `http://${HOST}:${PORT}`;
    respondJson(res, 200, {
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: `${base}/device/verify`,
      verification_uri_complete: `${base}/device/verify?user_code=${encodeURIComponent(userCode)}`,
      expires_in: DEVICE_CODE_TTL_SEC,
      interval: DEVICE_POLL_INTERVAL_SEC,
    });
  });

  app.post('/device/activate', (req, res) => {
    const userCodeRaw = typeof req.body?.user_code === 'string' ? req.body.user_code : '';
    const userCode = userCodeRaw.trim().toUpperCase();
    if (!userCode) {
      respondJson(res, 400, { error: 'invalid_request', error_description: 'user_code required' });
      return;
    }
    const deviceCode = userCodeIndex.get(userCode);
    if (!deviceCode) {
      respondJson(res, 404, { error: 'invalid_user_code' });
      return;
    }
    const session = deviceSessions.get(deviceCode);
    if (!session) {
      userCodeIndex.delete(userCode);
      respondJson(res, 404, { error: 'invalid_user_code' });
      return;
    }
    session.approvedAt = nowMs();
    respondJson(res, 200, { status: 'approved', user_code: userCode });
  });

  app.get('/device/verify', (req, res) => {
    const userCodeParam = firstString(req.query.user_code);
    if (!userCodeParam) {
      respondJson(res, 200, { status: 'pending', message: 'submit user_code to approve device' });
      return;
    }
    const userCode = userCodeParam.trim().toUpperCase();
    const deviceCode = userCodeIndex.get(userCode);
    if (!deviceCode) {
      respondJson(res, 404, { error: 'invalid_user_code' });
      return;
    }
    const session = deviceSessions.get(deviceCode);
    if (!session) {
      userCodeIndex.delete(userCode);
      respondJson(res, 404, { error: 'invalid_user_code' });
      return;
    }
    session.approvedAt = nowMs();
    respondJson(res, 200, { status: 'approved', user_code: userCode });
  });

  server.service.on('beforeAuthorizeRedirect', (redirect, req) => {
    const code = redirect.url.searchParams.get('code');
    if (!code) {
      return;
    }
    const clientId = firstString(req.query.client_id);
    const redirectUri = firstString(req.query.redirect_uri);
    const client = clientId ? clients.get(clientId) : undefined;
    if (!client || !redirectUri) {
      return;
    }
    const normalizedUri = normalizeRedirectUri(redirectUri);
    const scopeString = firstString(req.query.scope) ?? client.defaultScopes.join(' ');
    const scopes = parseScopes(scopeString, client.defaultScopes);
    authorizationCodes.set(code, {
      clientId: client.clientId,
      redirectUri: normalizedUri,
      scope: scopes,
      issuedAt: nowMs(),
      expiresAt: nowMs() + 300_000,
    });
  });

  server.service.on('beforeResponse', (tokenResponse, req) => {
    const grantType = req.body?.grant_type;
    if (grantType === 'authorization_code' || grantType === 'refresh_token') {
      const refreshToken = tokenResponse.body?.refresh_token;
      const accessToken = tokenResponse.body?.access_token;
      const clientId = extractClientAuth(req).clientId;
      if (refreshToken && clientId) {
        const scopes = typeof tokenResponse.body?.scope === 'string' ? parseScopes(tokenResponse.body.scope, []) : [];
        refreshTokens.set(refreshToken, {
          clientId,
          scope: scopes,
          subject: 'mock-user@example.com',
          issuedAt: nowMs(),
          accessToken,
        });
      }
    }
  });

  // Mock HTTP endpoints for E2E response analysis testing
  app.get('/mock/json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Custom-Header', 'test-value');
    respondJson(res, 200, {
      args: req.query,
      headers: Object.fromEntries(
        Object.entries(req.headers)
          .filter(([k]) => !k.startsWith('host'))
          .slice(0, 5)
      ),
      origin: req.ip || '127.0.0.1',
      url: `http://${req.hostname}${req.originalUrl}`,
    });
  });

  app.get('/mock/get', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    respondJson(res, 200, {
      method: 'GET',
      args: req.query,
      headers: Object.fromEntries(
        Object.entries(req.headers)
          .filter(([k]) => !k.startsWith('host'))
          .map(([k, v]) => [`Req-Header-${k}`, v])
      ),
      origin: req.ip || '127.0.0.1',
      url: `http://${req.hostname}${req.originalUrl}`,
    });
  });

  app.post('/mock/post', urlencoded({ extended: true }), (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    respondJson(res, 200, {
      method: 'POST',
      args: req.query,
      form: req.body,
      headers: Object.fromEntries(
        Object.entries(req.headers)
          .filter(([k]) => !k.startsWith('host'))
          .map(([k, v]) => [`Req-Header-${k}`, v])
      ),
      origin: req.ip || '127.0.0.1',
      url: `http://${req.hostname}${req.originalUrl}`,
    });
  });

  app.get('/mock/status/:code', (req, res) => {
    const statusCode = parseInt(req.params.code, 10) || 200;
    res.setHeader('Content-Type', 'application/json');
    res.status(statusCode);
    respondJson(res, statusCode, {
      status: statusCode,
      message: `HTTP ${statusCode}`,
    });
  });

  app.get('/mock/response-headers', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Custom-Header', 'test-value');
    res.setHeader('X-Another-Header', 'another-value');
    if (req.query['X-Custom-Header']) {
      res.setHeader('X-Custom-Header', String(req.query['X-Custom-Header']));
    }
    respondJson(res, 200, {
      headers_sent: Object.fromEntries(
        Array.from(
          Object.entries({
            'content-type': res.getHeader('content-type'),
            'x-custom-header': res.getHeader('x-custom-header'),
            'x-another-header': res.getHeader('x-another-header'),
          }).filter(([, v]) => v)
        )
      ),
    });
  });

  app.get('/mock/xml', (req, res) => {
    res.setHeader('Content-Type', 'application/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<root>
  <message>This is a mock XML response</message>
  <timestamp>${new Date().toISOString()}</timestamp>
  <method>GET</method>
</root>`);
  });

  app.get('/mock/html', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html>
<head><title>Mock HTML Response</title></head>
<body>
  <h1>Mock HTML Response</h1>
  <p>This is a test HTML response for e2e testing.</p>
</body>
</html>`);
  });

  app.get('/mock/text', (req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send('This is a plain text mock response\nWith multiple lines\nFor testing');
  });

  app.get('/mock/error', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(500);
    respondJson(res, 500, {
      error: 'Internal Server Error',
      message: 'This is a mock error response for testing error handling',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/mock/not-found', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(404);
    respondJson(res, 404, {
      error: 'Not Found',
      message: 'The requested resource was not found',
      path: req.originalUrl,
    });
  });

  app.get('/mock/delay/:seconds', (req, res) => {
    const seconds = parseInt(req.params.seconds, 10) || 0;
    const delayMs = Math.min(seconds * 1000, 60000); // Cap at 60 seconds
    setTimeout(() => {
      res.setHeader('Content-Type', 'application/json');
      respondJson(res, 200, {
        delayed: true,
        delay_seconds: seconds,
        timestamp: new Date().toISOString(),
      });
    }, delayMs);
  });

  app.get('/mock/error-delayed/:seconds', (req, res) => {
    const seconds = parseInt(req.params.seconds, 10) || 0;
    const delayMs = Math.min(seconds * 1000, 60000); // Cap at 60 seconds
    setTimeout(() => {
      res.setHeader('Content-Type', 'application/json');
      res.status(500);
      respondJson(res, 500, {
        error: 'Internal Server Error',
        message: 'This error occurred after a delay for testing',
        delay_seconds: seconds,
        timestamp: new Date().toISOString(),
      });
    }, delayMs);
  });

  // GitHub API Mock Endpoints
  app.get('/mock/github/user/repos', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    respondJson(res, 200, [
      {
        id: 1,
        name: 'knurl',
        full_name: 'newty/knurl',
        owner: {
          login: 'newty',
          id: 1,
          avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
          url: 'http://localhost:3000/mock/github/users/newty',
        },
        private: false,
        description: 'Desktop HTTP client for API development',
        url: 'http://localhost:3000/mock/github/repos/newty/knurl',
        html_url: 'https://github.com/newty/knurl',
        language: 'TypeScript',
        stargazers_count: 42,
        watchers_count: 42,
        forks_count: 5,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2025-10-29T12:00:00Z',
      },
      {
        id: 2,
        name: 'api-docs',
        full_name: 'newty/api-docs',
        owner: {
          login: 'newty',
          id: 1,
          avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
        },
        private: false,
        description: 'API documentation templates',
        url: 'http://localhost:3000/mock/github/repos/newty/api-docs',
        language: 'Markdown',
        stargazers_count: 8,
        forks_count: 1,
        created_at: '2024-03-20T08:30:00Z',
        updated_at: '2025-10-20T15:00:00Z',
      },
    ]);
  });

  app.get('/mock/github/repos/:owner/:repo', (req, res) => {
    const { owner, repo } = req.params;
    res.setHeader('Content-Type', 'application/json');
    respondJson(res, 200, {
      id: 1,
      name: repo,
      full_name: `${owner}/${repo}`,
      owner: {
        login: owner,
        id: 1,
        avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
        url: `http://localhost:3000/mock/github/users/${owner}`,
      },
      private: false,
      description: 'A sample repository from the GitHub API mock',
      url: `http://localhost:3000/mock/github/repos/${owner}/${repo}`,
      html_url: `https://github.com/${owner}/${repo}`,
      language: 'TypeScript',
      stargazers_count: 42,
      watchers_count: 42,
      forks_count: 5,
      open_issues_count: 12,
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2025-10-29T12:00:00Z',
      pushed_at: '2025-10-28T18:30:00Z',
    });
  });

  app.get('/mock/github/repos/:owner/:repo/issues', (req, res) => {
    const { owner, repo } = req.params;
    const state = req.query.state || 'open';
    const labels = req.query.labels ? String(req.query.labels).split(',') : [];

    res.setHeader('Content-Type', 'application/json');
    respondJson(res, 200, [
      {
        id: 1,
        number: 1,
        title: 'Add dark mode support',
        body: 'Users have requested dark mode support to reduce eye strain during nighttime usage.',
        state,
        labels: [{ name: 'enhancement', color: 'a2eeef' }],
        created_at: '2024-10-01T12:00:00Z',
        updated_at: '2025-10-28T14:30:00Z',
        user: {
          login: 'alice',
          id: 2,
        },
        assignee: null,
      },
      {
        id: 2,
        number: 2,
        title: 'Fix response parsing bug',
        body: 'XML responses are not being parsed correctly when charset is specified.',
        state,
        labels: [{ name: 'bug', color: 'd73a4a' }],
        created_at: '2024-09-15T08:30:00Z',
        updated_at: '2025-10-27T10:15:00Z',
        user: {
          login: 'bob',
          id: 3,
        },
        assignee: { login: 'newty', id: 1 },
      },
    ]);
  });

  app.post('/mock/github/repos/:owner/:repo/issues', (req, res) => {
    const { owner, repo } = req.params;
    const { title, body, labels } = req.body;

    res.setHeader('Content-Type', 'application/json');
    respondJson(res, 201, {
      id: 999,
      number: 3,
      title: title || 'New Issue',
      body: body || '',
      state: 'open',
      labels: Array.isArray(labels) ? labels.map((l) => ({ name: l, color: 'a2eeef' })) : [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user: {
        login: 'mock-user',
        id: 999,
      },
      assignee: null,
      url: `http://localhost:3000/mock/github/repos/${owner}/${repo}/issues/3`,
    });
  });

  app.get('/mock/github/repos/:owner/:repo/issues/:number', (req, res) => {
    const { owner, repo, number } = req.params;
    res.setHeader('Content-Type', 'application/json');
    respondJson(res, 200, {
      id: parseInt(number, 10),
      number: parseInt(number, 10),
      title: 'Sample Issue',
      body: 'This is a sample issue returned from the mock GitHub API.',
      state: 'open',
      labels: [{ name: 'help-wanted', color: '008672' }],
      created_at: '2024-10-01T12:00:00Z',
      updated_at: '2025-10-29T09:00:00Z',
      user: {
        login: 'contributor',
        id: 100,
      },
      assignee: { login: 'newty', id: 1 },
      url: `http://localhost:3000/mock/github/repos/${owner}/${repo}/issues/${number}`,
    });
  });

  app.get('/mock/github/user', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    respondJson(res, 200, {
      login: 'authenticated-user',
      id: 999,
      avatar_url: 'https://avatars.githubusercontent.com/u/999?v=4',
      gravatar_id: '',
      url: 'http://localhost:3000/mock/github/users/authenticated-user',
      html_url: 'https://github.com/authenticated-user',
      followers_url: 'http://localhost:3000/mock/github/users/authenticated-user/followers',
      following_url: 'http://localhost:3000/mock/github/users/authenticated-user/following',
      gists_url: 'http://localhost:3000/mock/github/users/authenticated-user/gists',
      repos_url: 'http://localhost:3000/mock/github/users/authenticated-user/repos',
      name: 'Authenticated User',
      company: 'Your Company',
      blog: 'https://example.com',
      location: 'San Francisco, CA',
      email: null,
      bio: 'A developer who uses Knurl',
      twitter_username: null,
      public_repos: 15,
      public_gists: 8,
      followers: 250,
      following: 80,
      created_at: '2020-01-15T10:00:00Z',
      updated_at: '2025-10-29T12:00:00Z',
    });
  });

  app.post('/mock/github/user/repos', (req, res) => {
    const { name, description, private: isPrivate } = req.body;
    res.setHeader('Content-Type', 'application/json');
    respondJson(res, 201, {
      id: 999,
      name: name || 'new-repository',
      full_name: `authenticated-user/${name || 'new-repository'}`,
      owner: {
        login: 'authenticated-user',
        id: 999,
        avatar_url: 'https://avatars.githubusercontent.com/u/999?v=4',
      },
      private: isPrivate || false,
      description: description || '',
      url: `http://localhost:3000/mock/github/repos/authenticated-user/${name || 'new-repository'}`,
      language: null,
      stargazers_count: 0,
      forks_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  app.get('/mock/github/repos/:owner/:repo/issues/:number/comments', (req, res) => {
    const { owner, repo, number } = req.params;
    res.setHeader('Content-Type', 'application/json');
    respondJson(res, 200, [
      {
        id: 1,
        url: `http://localhost:3000/mock/github/repos/${owner}/${repo}/issues/comments/1`,
        body: 'This is a helpful comment on the issue.',
        user: {
          login: 'commenter',
          id: 100,
        },
        created_at: '2025-10-25T10:00:00Z',
        updated_at: '2025-10-25T10:00:00Z',
      },
    ]);
  });

  app.get('/mock/github/repos/:owner/:repo/pulls', (req, res) => {
    const { owner, repo } = req.params;
    const state = req.query.state || 'open';
    res.setHeader('Content-Type', 'application/json');
    respondJson(res, 200, [
      {
        id: 1,
        number: 1,
        title: 'Add new feature',
        body: 'This PR adds a new feature to the project.',
        state,
        user: {
          login: 'contributor',
          id: 100,
        },
        created_at: '2025-10-20T12:00:00Z',
        updated_at: '2025-10-29T10:00:00Z',
        url: `http://localhost:3000/mock/github/repos/${owner}/${repo}/pulls/1`,
      },
    ]);
  });

  app.get('/mock/github/repos/:owner/:repo/pulls/:number', (req, res) => {
    const { owner, repo, number } = req.params;
    res.setHeader('Content-Type', 'application/json');
    respondJson(res, 200, {
      id: parseInt(number, 10),
      number: parseInt(number, 10),
      title: 'Feature: Add dark mode',
      body: 'Adds dark mode support to the application.',
      state: 'open',
      user: {
        login: 'developer',
        id: 50,
      },
      created_at: '2025-10-20T12:00:00Z',
      updated_at: '2025-10-29T10:00:00Z',
      url: `http://localhost:3000/mock/github/repos/${owner}/${repo}/pulls/${number}`,
    });
  });

  app.get('/mock/github/repos/:owner/:repo/commits', (req, res) => {
    const { owner, repo } = req.params;
    res.setHeader('Content-Type', 'application/json');
    respondJson(res, 200, [
      {
        sha: 'abc123def456',
        message: 'Initial commit',
        author: {
          name: 'Developer',
          email: 'dev@example.com',
          date: '2025-10-15T10:00:00Z',
        },
        url: `http://localhost:3000/mock/github/repos/${owner}/${repo}/commits/abc123def456`,
      },
      {
        sha: 'def456ghi789',
        message: 'Add new feature',
        author: {
          name: 'Developer',
          email: 'dev@example.com',
          date: '2025-10-25T10:00:00Z',
        },
        url: `http://localhost:3000/mock/github/repos/${owner}/${repo}/commits/def456ghi789`,
      },
    ]);
  });

  app.get('/mock/github/repos/:owner/:repo/commits/:sha', (req, res) => {
    const { owner, repo, sha } = req.params;
    res.setHeader('Content-Type', 'application/json');
    respondJson(res, 200, {
      sha,
      message: 'Commit message',
      author: {
        name: 'Developer',
        email: 'dev@example.com',
        date: '2025-10-25T10:00:00Z',
      },
      tree: { sha: 'treeSha123', url: 'http://localhost:3000/mock/github/repos/' + owner + '/' + repo + '/git/trees/treeSha123' },
      url: `http://localhost:3000/mock/github/repos/${owner}/${repo}/commits/${sha}`,
    });
  });

  app.get('/mock/github/users/:username/followers', (req, res) => {
    const { username } = req.params;
    res.setHeader('Content-Type', 'application/json');
    respondJson(res, 200, [
      {
        login: 'follower1',
        id: 101,
        avatar_url: 'https://avatars.githubusercontent.com/u/101?v=4',
        url: `http://localhost:3000/mock/github/users/follower1`,
      },
      {
        login: 'follower2',
        id: 102,
        avatar_url: 'https://avatars.githubusercontent.com/u/102?v=4',
        url: `http://localhost:3000/mock/github/users/follower2`,
      },
    ]);
  });

  app.get('/mock/github/users/:username', (req, res) => {
    const { username } = req.params;
    res.setHeader('Content-Type', 'application/json');
    respondJson(res, 200, {
      login: username,
      id: 1,
      avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
      gravatar_id: '',
      url: `http://localhost:3000/mock/github/users/${username}`,
      html_url: `https://github.com/${username}`,
      followers_url: `http://localhost:3000/mock/github/users/${username}/followers`,
      following_url: `http://localhost:3000/mock/github/users/${username}/following`,
      gists_url: `http://localhost:3000/mock/github/users/${username}/gists`,
      repos_url: `http://localhost:3000/mock/github/users/${username}/repos`,
      name: username.charAt(0).toUpperCase() + username.slice(1),
      company: 'Tech Company',
      blog: 'https://blog.example.com',
      location: 'San Francisco, CA',
      email: null,
      bio: 'API enthusiast and developer',
      twitter_username: null,
      public_repos: 10,
      public_gists: 5,
      followers: 150,
      following: 50,
      created_at: '2020-01-15T10:00:00Z',
      updated_at: '2025-10-29T12:00:00Z',
    });
  });

  app.get('/mock/github/search/repositories', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    respondJson(res, 200, {
      total_count: 1000,
      incomplete_results: false,
      items: [
        {
          id: 1,
          name: 'knurl',
          full_name: 'newty/knurl',
          owner: {
            login: 'newty',
            id: 1,
          },
          private: false,
          description: 'Desktop HTTP client for API development',
          language: 'TypeScript',
          stargazers_count: 42,
          forks_count: 5,
          url: 'http://localhost:3000/mock/github/repos/newty/knurl',
        },
        {
          id: 2,
          name: 'api-utils',
          full_name: 'dev/api-utils',
          owner: {
            login: 'dev',
            id: 2,
          },
          private: false,
          description: 'Utility library for API development',
          language: 'TypeScript',
          stargazers_count: 150,
          forks_count: 20,
          url: 'http://localhost:3000/mock/github/repos/dev/api-utils',
        },
      ],
    });
  });

  app.get('/mock/github/search/issues', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    respondJson(res, 200, {
      total_count: 42,
      incomplete_results: false,
      items: [
        {
          id: 1,
          number: 1,
          title: 'Add dark mode support',
          body: 'Users request dark mode',
          state: 'open',
          url: 'http://localhost:3000/mock/github/repos/newty/knurl/issues/1',
        },
        {
          id: 2,
          number: 2,
          title: 'Fix response parsing',
          body: 'XML responses not parsed correctly',
          state: 'open',
          url: 'http://localhost:3000/mock/github/repos/newty/knurl/issues/2',
        },
      ],
    });
  });

  app.get('/mock/github/user/gists', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    respondJson(res, 200, [
      {
        id: 'abc123',
        url: 'http://localhost:3000/mock/github/gists/abc123',
        description: 'My first gist',
        public: true,
        created_at: '2025-01-15T10:00:00Z',
        updated_at: '2025-10-29T12:00:00Z',
      },
    ]);
  });

  app.get('/mock/github/gists/:id', (req, res) => {
    const { id } = req.params;
    res.setHeader('Content-Type', 'application/json');
    respondJson(res, 200, {
      id,
      url: `http://localhost:3000/mock/github/gists/${id}`,
      description: 'Example gist',
      public: true,
      files: {
        'example.js': {
          filename: 'example.js',
          type: 'application/javascript',
          language: 'JavaScript',
          raw_url: 'http://localhost:3000/mock/github/gists/' + id + '/raw',
          size: 123,
          content: 'console.log("Hello, World!");',
        },
      },
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-10-29T12:00:00Z',
    });
  });

  try {
    await server.start(PORT, HOST);
  } catch (err) {
    console.error('Failed to start OAuth 2.0 mock server', err);
    process.exit(1);
  }

  console.log(`OAuth 2.0 mock server running at http://${HOST}:${PORT}`);
  console.log(`Issuer URL: ${server.issuer.url}`);
  console.log(`Discovery URL: ${server.issuer.url}/.well-known/openid-configuration`);
  console.log(`Device verification: ${server.issuer.url}/device/verify`);

  const shutdown = async () => {
    await server.stop();
    console.log('OAuth 2.0 mock server stopped');
  };

  process.once('SIGINT', () => {
    shutdown().catch((err) => {
      console.error('Shutdown failed', err);
      process.exit(1);
    });
  });
  process.once('SIGTERM', () => {
    shutdown().catch((err) => {
      console.error('Shutdown failed', err);
      process.exit(1);
    });
  });
}

main().catch((err) => {
  console.error('Unexpected error starting OAuth 2.0 mock server', err);
  process.exit(1);
});
