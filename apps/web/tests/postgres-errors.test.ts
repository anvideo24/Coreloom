import { describe, expect, it } from "vitest";

import { isUndefinedRelationError } from "@/lib/db/postgres-errors";

describe("isUndefinedRelationError", () => {
  it("detects a neon-style undefined table error for the named relation", () => {
    const error = {
      code: "42P01",
      message: 'relation "workspace_company_profiles" does not exist',
    };
    expect(isUndefinedRelationError(error, "workspace_company_profiles")).toBe(true);
  });

  it("walks a neon sourceError wrapper", () => {
    const error = {
      message: "Error connecting to database",
      sourceError: {
        code: "42P01",
        message: 'relation "workspace_company_profiles" does not exist',
      },
    };
    expect(isUndefinedRelationError(error, "workspace_company_profiles")).toBe(true);
  });

  it("walks a drizzle wrapper cause chain", () => {
    const error = {
      message: 'Failed query: select "id" from "workspace_company_profiles"',
      cause: {
        code: "42P01",
        message: 'relation "workspace_company_profiles" does not exist',
      },
    };
    expect(isUndefinedRelationError(error, "workspace_company_profiles")).toBe(true);
  });

  it("ignores the same postgres code for a different relation", () => {
    const error = {
      code: "42P01",
      message: 'relation "other_table" does not exist',
    };
    expect(isUndefinedRelationError(error, "workspace_company_profiles")).toBe(false);
  });

  it("ignores unrelated errors", () => {
    expect(isUndefinedRelationError(new Error("DATABASE_URL is required"), "workspace_company_profiles")).toBe(false);
    expect(isUndefinedRelationError(null, "workspace_company_profiles")).toBe(false);
  });
});
