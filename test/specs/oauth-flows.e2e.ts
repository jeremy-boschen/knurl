const issuer = process.env.KNURL_E2E_OAUTH_ISSUER ?? "";
const redirectUri = process.env.KNURL_E2E_OAUTH_REDIRECT_URI ?? "http://127.0.0.1:1420/oauth/callback";
const clientId = process.env.KNURL_E2E_OAUTH_CLIENT_ID ?? "test-client";
const clientSecret = process.env.KNURL_E2E_OAUTH_CLIENT_SECRET ?? "test-secret";
const publicClientId = process.env.KNURL_E2E_OAUTH_PUBLIC_CLIENT_ID ?? "public-device-client";

async function invokeAuth(config: Record<string, unknown>) {

  const outcome = await browser.executeAsync((cfg, done) => {
    const bridge = (window as unknown as { __KNURL_E2E__?: { invokeAuth?: Function } }).__KNURL_E2E__;
    if (!bridge?.invokeAuth) {
      done({ ok: false, error: "Knurl e2e bridge unavailable" });
      return;
    }
    bridge
      .invokeAuth(cfg)
      .then((result: unknown) => done({ ok: true, result }))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        done({ ok: false, error: message });
      });
  }, config);

  if (!outcome.ok) {
    throw new Error(outcome.error ?? "Unknown invoke failure");
  }
  return outcome.result as { headers?: Record<string, string>; expiresAt?: number };
}

describe("OAuth flows", () => {
  before(async () => {
    await expect(issuer).not.toBe("");
  });

  const baseAuthConfig = {
    authUrl: `${issuer}/authorize`,
    tokenUrl: `${issuer}/token`,
    deviceAuthorizationUrl: `${issuer}/device_authorization`,
    discoveryUrl: `${issuer}/.well-known/openid-configuration`,
  } as const;

  it("performs client_credentials grant", async () => {
    const result = await invokeAuth({
      type: "oauth2",
      grantType: "client_credentials",
      authUrl: baseAuthConfig.authUrl,
      tokenUrl: baseAuthConfig.tokenUrl,
      clientId,
      clientSecret,
      scope: "openid profile offline_access",
      clientAuth: "body",
    });

    const header = result.headers?.Authorization ?? result.headers?.authorization;
    await expect(header).toBeDefined();
    await expect(header).toContain("Bearer ");
  });

  it("performs authorization_code with PKCE", async () => {
    const result = await invokeAuth({
      type: "oauth2",
      grantType: "authorization_code",
      authUrl: baseAuthConfig.authUrl,
      tokenUrl: baseAuthConfig.tokenUrl,
      discoveryUrl: baseAuthConfig.discoveryUrl,
      clientId,
      clientSecret,
      scope: "openid profile offline_access",
      redirectUri,
      usePkce: true,
      clientAuth: "basic",
    });

    const header = result.headers?.Authorization ?? result.headers?.authorization;
    await expect(header).toBeDefined();
    await expect(header).toContain("Bearer ");
    await expect(result.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("performs device_code grant with polling", async () => {
    const result = await invokeAuth({
      type: "oauth2",
      grantType: "device_code",
      tokenUrl: baseAuthConfig.tokenUrl,
      deviceAuthorizationUrl: baseAuthConfig.deviceAuthorizationUrl,
      clientId: publicClientId,
      scope: "openid profile",
      clientAuth: "body",
    });

    const header = result.headers?.Authorization ?? result.headers?.authorization;
    await expect(header).toBeDefined();
    await expect(header).toContain("Bearer ");
  });
});
