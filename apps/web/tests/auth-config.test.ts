import { describe, expect, it } from "vitest";
import { readAuthConfig } from "@/lib/auth/config";
import { signInFailureMessage } from "@/lib/auth/sign-in-error";

describe("readAuthConfig", () => {
  it("fails closed when the Auth base URL is absent", () => {
    expect(() => readAuthConfig(undefined, "a".repeat(32))).toThrow("NEON_AUTH_BASE_URL is required");
  });

  it("fails closed when the cookie secret is absent", () => {
    expect(() => readAuthConfig("https://auth.example.test", undefined)).toThrow("NEON_AUTH_COOKIE_SECRET is required");
  });
});

describe("signInFailureMessage", () => {
  it("keeps credential failures generic", () => {
    expect(signInFailureMessage({ status: 401 })).toBe("로그인 정보를 확인해 주세요.");
  });

  it("explains a blocked phone origin without exposing internals", () => {
    expect(signInFailureMessage({ status: 403 })).toContain("휴대폰 HTTPS 주소");
    expect(signInFailureMessage({ code: "INVALID_ORIGIN" })).toContain("휴대폰 HTTPS 주소");
  });

  it("explains a blocked PC loopback origin without mentioning the phone address", () => {
    expect(signInFailureMessage({ status: 0 }, "127.0.0.1")).toContain("http://localhost:3000/sign-in");
    expect(signInFailureMessage({ code: "INVALID_ORIGIN" }, "localhost")).not.toContain("휴대폰 HTTPS 주소");
  });
});
