import { describe, expect, it } from "vitest";

import {
  cloudAgentEnvironmentFile,
  missingCloudAgentLoginSecrets,
  missingCloudAgentSecrets,
} from "@/lib/setup/cloud-agent-env";

const full = {
  DATABASE_URL: "postgresql://example/db",
  NEON_AUTH_BASE_URL: "https://example.auth",
  NEON_AUTH_COOKIE_SECRET: "x".repeat(32),
  CORELOOM_FOUNDER_EMAIL: "founder@example.com",
  TEST_LOGIN_USERNAME: "founder@example.com",
  TEST_LOGIN_PASSWORD: "not-a-real-password",
};

describe("cloud agent env", () => {
  it("lists missing required secrets by name only", () => {
    expect(missingCloudAgentSecrets({})).toEqual([
      "DATABASE_URL",
      "NEON_AUTH_BASE_URL",
      "NEON_AUTH_COOKIE_SECRET",
      "CORELOOM_FOUNDER_EMAIL",
    ]);
    expect(missingCloudAgentLoginSecrets({ TEST_LOGIN_USERNAME: "a" })).toEqual([
      "TEST_LOGIN_PASSWORD",
    ]);
  });

  it("writes .env.local body without login secrets", () => {
    const body = cloudAgentEnvironmentFile(full);
    expect(body).toContain('DATABASE_URL="postgresql://example/db"');
    expect(body).toContain('CORELOOM_DATABASE_BRANCH="ai-development"');
    expect(body).toContain('CORELOOM_FOUNDER_EMAIL="founder@example.com"');
    expect(body).not.toContain("TEST_LOGIN");
    expect(body).not.toContain("not-a-real-password");
  });

  it("throws with secret names when required values are missing", () => {
    expect(() => cloudAgentEnvironmentFile({})).toThrow(/DATABASE_URL/);
  });
});
