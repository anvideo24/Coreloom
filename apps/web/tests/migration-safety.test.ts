import { describe, expect, it } from "vitest";

import { assertDevelopmentTarget, databaseHost, describeDatabaseTarget } from "@/lib/db/migrate";
import { cloudAgentEnvironmentFile } from "@/lib/setup/cloud-agent-env";

const DEV_URL = "postgresql://user:secret@ep-dev-1234.ap-southeast-1.aws.neon.tech/neondb";
const PROD_URL = "postgresql://user:secret@ep-prod-9999.ap-southeast-1.aws.neon.tech/neondb";
const DEV_HOST = "ep-dev-1234.ap-southeast-1.aws.neon.tech";

describe("assertDevelopmentTarget", () => {
  it("accepts the confirmed ai-development database", () => {
    expect(() =>
      assertDevelopmentTarget({ branch: "ai-development", databaseUrl: DEV_URL, allowedHost: DEV_HOST }),
    ).not.toThrow();
  });

  it("refuses a production or missing branch declaration", () => {
    expect(() =>
      assertDevelopmentTarget({ branch: "production", databaseUrl: DEV_URL, allowedHost: DEV_HOST }),
    ).toThrow("ai-development");
    expect(() => assertDevelopmentTarget({ databaseUrl: DEV_URL, allowedHost: DEV_HOST })).toThrow("ai-development");
  });

  it("refuses when the connection points somewhere other than the confirmed database", () => {
    // 이 줄이 예전 구멍이다. 선언은 ai-development 인데 실제 접속은 운영일 수 있었다.
    expect(() =>
      assertDevelopmentTarget({ branch: "ai-development", databaseUrl: PROD_URL, allowedHost: DEV_HOST }),
    ).toThrow("does not match the confirmed database");
  });

  it("refuses until a human confirms the target once", () => {
    expect(() => assertDevelopmentTarget({ branch: "ai-development", databaseUrl: DEV_URL })).toThrow(
      "CORELOOM_DATABASE_HOST",
    );
  });

  it("refuses a connection string with no host instead of asking for an empty value", () => {
    expect(() =>
      assertDevelopmentTarget({ branch: "ai-development", databaseUrl: "postgresql:///neondb" }),
    ).toThrow("no host");
  });

  it("tells the human to verify rather than paste blindly", () => {
    // 거부 문구가 「이 줄을 넣어라」로 읽히면, 운영 주소를 넣은 사람은 그대로 되붙인다.
    try {
      assertDevelopmentTarget({ branch: "ai-development", databaseUrl: DEV_URL });
      throw new Error("should have refused");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("Do NOT paste this blindly");
      expect(message).toContain("Neon Console");
      expect(message).not.toContain(`${"CORELOOM_DATABASE_HOST"}="${DEV_HOST}"`);
    }
  });

  it("never puts credentials in the target description", () => {
    expect(describeDatabaseTarget(DEV_URL)).toBe(`${DEV_HOST}/neondb`);
    expect(describeDatabaseTarget(DEV_URL)).not.toContain("secret");
    expect(databaseHost(DEV_URL)).toBe(DEV_HOST);
  });
});

describe("cloud agent environment", () => {
  const base = {
    DATABASE_URL: DEV_URL,
    NEON_AUTH_BASE_URL: "https://auth.example.test",
    NEON_AUTH_COOKIE_SECRET: "x".repeat(32),
    CORELOOM_FOUNDER_EMAIL: "owner@example.test",
  };

  it("passes a confirmed host through when one is provided", () => {
    expect(cloudAgentEnvironmentFile({ ...base, CORELOOM_DATABASE_HOST: DEV_HOST })).toContain(
      `CORELOOM_DATABASE_HOST="${DEV_HOST}"`,
    );
  });

  it("does not invent a confirmed host", () => {
    // 지어내면 관문이 다시 무의미해진다. 없으면 마이그레이션이 스스로 멈추게 둔다.
    expect(cloudAgentEnvironmentFile(base)).not.toContain("CORELOOM_DATABASE_HOST");
  });
});
