---
title: Environments & Variables
description: How to use environments to test against different APIs (dev, staging, production)
category: environments
order: 1
---

## What are Environments?

Environments let you switch between different configurations (dev, staging, production) without editing your requests.

**Example**: Instead of changing `https://api.dev.example.com` to `https://api.prod.example.com`, you create an environment variable `{{baseUrl}}` that changes based on which environment you're using.

## Creating an Environment

1. Right-click a collection in the sidebar
2. Select **Manage Environments**
3. Click **"+ New Environment"**
4. Give it a name (example: "Development", "Production")
5. Add variables

## Using Variables

Variables are in the format `{{variableName}}`. You can use them anywhere in your request:

**In the URL**:
```
https://{{baseUrl}}/users
```

**In headers**:
```
X-API-Key: {{apiKey}}
Authorization: Bearer {{token}}
```

**In request body**:
```json
{
  "userId": "{{userId}}",
  "email": "{{userEmail}}"
}
```

## Environment Variables

Create variables for values that change between environments:

| Variable | Dev Value | Prod Value |
|----------|-----------|-----------|
| `baseUrl` | `api.dev.example.com` | `api.example.com` |
| `apiKey` | `dev-key-123` | `prod-key-456` |
| `timeout` | `30000` | `60000` |
| `token` | `dev-token` | (OAuth2 token) |

## Switching Environments

At the top of the request editor, there's an **Environment dropdown**.

- Select an environment to use it
- All variables `{{variableName}}` are replaced with values from that environment
- Different requests can use different environments

## Setting Default Environment

Right-click a collection → **Collection Settings** → Set **Default Environment**

All requests in that collection use this environment by default (unless overridden).

## Tips

- **Don't hardcode secrets**: Use environment variables for API keys, tokens, passwords
- **One environment per API server**: Dev, Staging, Production
- **Use descriptive variable names**: `{{apiKey}}` instead of `{{key1}}`
- **Test with multiple environments**: Switch environments to verify your requests work across servers
- **Share base configuration**: Export a collection with common variables, teammates can customize for their setup
