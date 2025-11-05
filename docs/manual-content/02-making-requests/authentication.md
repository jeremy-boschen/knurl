---
title: Authentication
description: How to authenticate with APIs using Bearer tokens, API keys, Basic auth, and OAuth2
category: making-requests
order: 3
---

## Authentication Overview

Most APIs require you to prove who you are. The **Authentication tab** handles this.

If your API doesn't require authentication, leave it set to **None** and skip this guide.

## Bearer Token

Use this for APIs that use bearer tokens (common for OAuth2 tokens).

**In Knurl**:
1. Go to the **Authentication tab**
2. Select **Bearer Token**
3. Paste your token
4. Knurl adds `Authorization: Bearer <token>` to your request headers

**Example**: If you have an API token `abc123xyz`, Knurl sends:
```
Authorization: Bearer abc123xyz
```

## Basic Authentication

Use this for APIs that use username/password (like HTTP Basic Auth).

**In Knurl**:
1. Go to the **Authentication tab**
2. Select **Basic Auth**
3. Enter your username and password
4. Knurl encodes them and sends as `Authorization: Basic <base64>`

This is useful for internal APIs or basic authentication schemes.

## API Key

Use this for APIs that require an API key in a custom header.

**In Knurl**:
1. Go to the **Authentication tab**
2. Select **API Key**
3. Specify the header name (example: `X-API-Key`)
4. Enter your API key
5. Knurl adds `X-API-Key: <your-key>` to the request

**Example**: If your API uses `Authorization: ApiKey abc123xyz`:
- Header: `Authorization`
- Value: `ApiKey abc123xyz`

## OAuth2

Use this for APIs with full OAuth2 flows (like Google, GitHub, or other third-party services).

**In Knurl**:
1. Go to the **Authentication tab**
2. Select **OAuth2**
3. Fill in OAuth2 details:
   - Authorization URL
   - Token URL
   - Client ID
   - Client Secret
   - Scopes
4. Click **Get Token** and complete the auth flow
5. Knurl automatically adds the token to your requests

This is for advanced integrations where you need to exchange credentials for tokens.

## Inheriting Authentication

Collections and folders can have default authentication. Individual requests can:
- Use the inherited authentication from their collection
- Override with different authentication
- Disable authentication for that specific request

This is useful when all your requests use the same API key, but you occasionally need to test with different credentials.

## Tips

- **Don't hardcode secrets**: Use [environment variables](../environments/managing-environments.md) for tokens and keys
- **Keep tokens fresh**: Tokens expire; update them regularly or use OAuth2 for automatic refresh
- **Different environments**: Your dev API key is different from production—use environments to switch
- **Test without auth**: Temporarily disable authentication to diagnose "401 Unauthorized" errors
