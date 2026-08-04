/**
 * @fileoverview Tests for OAuth environment validation and scope parsing.
 */

import { describe, expect, it } from "vitest";
import {
  parseOAuthScopes,
  validateOAuthEnvironment,
} from "../../src/config/oauthConfig.js";

const validOAuthEnvironment = {
  MCP_AUTH_MODE: "oauth",
  OAUTH_ISSUER_URL: "https://login.microsoftonline.com/tenant-id/v2.0",
  OAUTH_JWKS_URI:
    "https://login.microsoftonline.com/tenant-id/discovery/v2.0/keys",
  OAUTH_AUDIENCE: "11111111-2222-3333-4444-555555555555",
  OAUTH_RESOURCE_URL: "https://mcp.example.com/mcp",
  OAUTH_SCOPES_SUPPORTED: "https://mcp.example.com/mcp/ibmi.read",
  OAUTH_REQUIRED_SCOPES: "ibmi.read",
};

describe("parseOAuthScopes", () => {
  it("trims, removes empty entries, and deduplicates scopes", () => {
    expect(parseOAuthScopes("ibmi.read, profile,ibmi.read, ")).toEqual([
      "ibmi.read",
      "profile",
    ]);
  });
});

describe("validateOAuthEnvironment", () => {
  it("accepts a complete Entra OAuth configuration", () => {
    expect(() => validateOAuthEnvironment(validOAuthEnvironment)).not.toThrow();
  });

  it("does not require OAuth fields for other authentication modes", () => {
    expect(() =>
      validateOAuthEnvironment({ MCP_AUTH_MODE: "none" }),
    ).not.toThrow();
  });

  it("reports every missing critical OAuth field", () => {
    expect(() => validateOAuthEnvironment({ MCP_AUTH_MODE: "oauth" })).toThrow(
      /OAUTH_ISSUER_URL[\s\S]*OAUTH_REQUIRED_SCOPES/,
    );
  });

  it("rejects fragments on the protected resource URL", () => {
    expect(() =>
      validateOAuthEnvironment({
        ...validOAuthEnvironment,
        OAUTH_RESOURCE_URL: "https://mcp.example.com/mcp#fragment",
      }),
    ).toThrow(/OAUTH_RESOURCE_URL must not contain a fragment/);
  });

  it("rejects insecure public OAuth URLs", () => {
    expect(() =>
      validateOAuthEnvironment({
        ...validOAuthEnvironment,
        OAUTH_RESOURCE_URL: "http://mcp.example.com/mcp",
      }),
    ).toThrow(/OAUTH_RESOURCE_URL must use HTTPS/);
  });

  it("allows HTTP for loopback development URLs", () => {
    expect(() =>
      validateOAuthEnvironment({
        ...validOAuthEnvironment,
        OAUTH_RESOURCE_URL: "http://localhost:3000/mcp",
      }),
    ).not.toThrow();
  });

  it("rejects scope values that cannot be safely advertised", () => {
    expect(() =>
      validateOAuthEnvironment({
        ...validOAuthEnvironment,
        OAUTH_SCOPES_SUPPORTED: 'ibmi.read"bad',
      }),
    ).toThrow(/invalid OAuth scope token/);
  });
});
