/**
 * @fileoverview Validation and parsing helpers for OAuth server configuration.
 */

export interface OAuthEnvironment {
  MCP_AUTH_MODE?: string;
  OAUTH_ISSUER_URL?: string;
  OAUTH_JWKS_URI?: string;
  OAUTH_AUDIENCE?: string;
  OAUTH_RESOURCE_URL?: string;
  OAUTH_SCOPES_SUPPORTED?: string;
  OAUTH_REQUIRED_SCOPES?: string;
}

const OAUTH_SCOPE_TOKEN = /^[\x21\x23-\x5b\x5d-\x7e]+$/;

/** Parses a comma-separated scope list, removing whitespace and duplicates. */
export function parseOAuthScopes(value?: string): string[] | undefined {
  if (!value) {
    return undefined;
  }

  const scopes = [
    ...new Set(value.split(",").map((scope) => scope.trim())),
  ].filter(Boolean);
  return scopes.length > 0 ? scopes : undefined;
}

function isLoopback(hostname: string): boolean {
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  );
}

function validateSecureUrl(
  name: string,
  value: string,
  options: { allowQuery?: boolean } = {},
): string[] {
  const errors: string[] = [];
  const url = new URL(value);

  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && isLoopback(url.hostname))
  ) {
    errors.push(
      `${name} must use HTTPS (HTTP is only allowed for loopback development URLs)`,
    );
  }
  if (url.hash) {
    errors.push(`${name} must not contain a fragment`);
  }
  if (!options.allowQuery && url.search) {
    errors.push(`${name} must not contain a query string`);
  }

  return errors;
}

/**
 * Fails fast when OAuth mode cannot provide discovery or enforce authorization.
 */
export function validateOAuthEnvironment(env: OAuthEnvironment): void {
  if (env.MCP_AUTH_MODE !== "oauth") {
    return;
  }

  const required = [
    "OAUTH_ISSUER_URL",
    "OAUTH_AUDIENCE",
    "OAUTH_RESOURCE_URL",
    "OAUTH_SCOPES_SUPPORTED",
    "OAUTH_REQUIRED_SCOPES",
  ] as const;
  const missing = required.filter((name) => !env[name]?.trim());
  const errors = missing.map(
    (name) => `${name} is required when MCP_AUTH_MODE=oauth`,
  );

  if (env.OAUTH_ISSUER_URL) {
    errors.push(...validateSecureUrl("OAUTH_ISSUER_URL", env.OAUTH_ISSUER_URL));
  }
  if (env.OAUTH_JWKS_URI) {
    errors.push(...validateSecureUrl("OAUTH_JWKS_URI", env.OAUTH_JWKS_URI));
  }
  if (env.OAUTH_RESOURCE_URL) {
    errors.push(
      ...validateSecureUrl("OAUTH_RESOURCE_URL", env.OAUTH_RESOURCE_URL, {
        allowQuery: true,
      }),
    );
  }

  for (const [name, value] of [
    ["OAUTH_SCOPES_SUPPORTED", env.OAUTH_SCOPES_SUPPORTED],
    ["OAUTH_REQUIRED_SCOPES", env.OAUTH_REQUIRED_SCOPES],
  ] as const) {
    for (const scope of parseOAuthScopes(value) ?? []) {
      if (!OAUTH_SCOPE_TOKEN.test(scope)) {
        errors.push(`${name} contains an invalid OAuth scope token: ${scope}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid OAuth configuration:\n- ${errors.join("\n- ")}`);
  }
}
