import { describe, expect, it } from "vitest";
import { readAuthConfig } from "@/lib/auth/config";

describe("readAuthConfig", () => {
  it("fails closed when the Auth base URL is absent", () => {
    expect(() => readAuthConfig(undefined, "a".repeat(32))).toThrow("NEON_AUTH_BASE_URL is required");
  });

  it("fails closed when the cookie secret is absent", () => {
    expect(() => readAuthConfig("https://auth.example.test", undefined)).toThrow("NEON_AUTH_COOKIE_SECRET is required");
  });
});
