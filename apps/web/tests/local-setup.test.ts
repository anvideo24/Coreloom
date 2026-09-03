import { describe, expect, it } from "vitest";

import { localEnvironmentFile, parseLocalSetup } from "@/lib/setup/local-environment";

const validInput = {
  databaseUrl: "postgresql://founder:password@example.neon.tech/coreloom?sslmode=require",
  founderEmail: "founder@example.com",
  authBaseUrl: "https://auth.example.neon.tech",
  cookieSecret: "a".repeat(32),
};

describe("local development setup", () => {
  it("accepts the development values required for founder sign-in", () => {
    expect(parseLocalSetup(validInput)).toEqual({
      ...validInput,
      databaseBranch: "ai-development",
    });
  });

  it("rejects a short cookie secret before it can be saved", () => {
    expect(() => parseLocalSetup({ ...validInput, cookieSecret: "too-short" })).toThrow(
      "쿠키 비밀값은 32자 이상이어야 합니다.",
    );
  });

  it("writes only quoted local configuration values and fixes the development branch", () => {
    expect(localEnvironmentFile(parseLocalSetup(validInput))).toBe(
      'DATABASE_URL="postgresql://founder:password@example.neon.tech/coreloom?sslmode=require"\n' +
        'CORELOOM_DATABASE_BRANCH="ai-development"\n' +
        'NEON_AUTH_BASE_URL="https://auth.example.neon.tech"\n' +
        'NEON_AUTH_COOKIE_SECRET="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"\n' +
        'CORELOOM_FOUNDER_EMAIL="founder@example.com"\n',
    );
  });
});
