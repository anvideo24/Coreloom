import { describe, expect, it } from "vitest";
import { requireDatabaseUrl } from "@/lib/db/config";

describe("requireDatabaseUrl", () => {
  it("fails closed when DATABASE_URL is absent", () => {
    expect(() => requireDatabaseUrl(undefined)).toThrow("DATABASE_URL is required");
  });

  it("rejects a non-Postgres value", () => {
    expect(() => requireDatabaseUrl("https://example.test")).toThrow("postgresql:// or postgres://");
  });
});
