import { describe, expect, it } from "vitest";

import {
  appendDevelopmentDatabaseConfig,
  localEnvironmentFile,
  parseDevelopmentDatabaseSetup,
  parseLocalSetup,
} from "@/lib/setup/local-environment";

const validInput = {
  founderEmail: "founder@example.com",
  authBaseUrl: "https://auth.example.neon.tech",
  cookieSecret: "a".repeat(32),
};

describe("local development setup", () => {
  it("accepts only the values required for founder sign-in", () => {
    expect(parseLocalSetup(validInput)).toEqual(validInput);
  });

  it("rejects a short cookie secret before it can be saved", () => {
    expect(() => parseLocalSetup({ ...validInput, cookieSecret: "too-short" })).toThrow(
      "쿠키 비밀값은 32자 이상이어야 합니다.",
    );
  });

  it("writes only quoted Auth configuration values", () => {
    expect(localEnvironmentFile(parseLocalSetup(validInput))).toBe(
        'NEON_AUTH_BASE_URL="https://auth.example.neon.tech"\n' +
        'NEON_AUTH_COOKIE_SECRET="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"\n' +
        'CORELOOM_FOUNDER_EMAIL="founder@example.com"\n',
    );
  });

  it("adds the development database without replacing the existing Auth settings", () => {
    const existing = localEnvironmentFile(parseLocalSetup(validInput));
    const database = parseDevelopmentDatabaseSetup({
      databaseUrl: "postgresql://founder:password@example.neon.tech/coreloom?sslmode=require",
    });

    expect(appendDevelopmentDatabaseConfig(existing, database)).toBe(
      existing +
        'DATABASE_URL="postgresql://founder:password@example.neon.tech/coreloom?sslmode=require"\n' +
        'CORELOOM_DATABASE_BRANCH="ai-development"\n',
    );
  });
});
