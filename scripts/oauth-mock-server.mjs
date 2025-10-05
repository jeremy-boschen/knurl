#!/usr/bin/env node
/*
  oauth-mock-server.mjs
  ----------------------------------------------------------------------------
  This script starts an OAuth 2.0 mock server using `oauth2-mock-server`.
  The server is designed for testing and implicitly accepts client requests
  without explicit registration.

  OAUTH CLIENT SETUP (use these values in your client)
  ------------------
  client_id:     test-client
  client_secret: test-secret
  redirect_uris: http://localhost:5173/callback, http://127.0.0.1:5173/callback
*/

import { OAuth2Server } from 'oauth2-mock-server';

const PORT = Number(process.env.PORT || 3000);

async function main() {
  console.log('Configuring OAuth 2.0 Mock Server...');

  const server = new OAuth2Server();

  // Generate a key for signing tokens.
  await server.issuer.keys.generate('RS256');

  // To support the password grant, the library expects a listener
  // for the 'beforeTokenSigning' event. Inside this listener, we can
  // validate the username/password and set the `sub` (subject) claim.
  // For this mock, we'll accept any credentials and return the username as the sub.
  server.service.on('beforeTokenSigning', (token, req) => {
    if (req.body.grant_type === 'password') {
      console.log(`[Event: beforeTokenSigning] Handling password grant for user: ${req.body.username}`);
      token.payload.sub = req.body.username;
    }
  });

  try {
    await server.start(PORT, 'localhost');
    console.log(`OAuth 2.0 Mock Server is running at http://localhost:${PORT}`);
    console.log(`Issuer URL: ${server.issuer.url}`);
    console.log(`OIDC Discovery: ${server.issuer.url}/.well-known/openid-configuration`);
    console.log(`JWKS: ${server.issuer.url}/jwks`);
  } catch (error) {
    console.error('Failed to start OAuth 2.0 Mock Server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('An unexpected error occurred:', error);
  process.exit(1);
});