import { describe, expect, it } from "vitest";
import { assertDevelopmentTarget } from "@/lib/db/migrate";

describe("assertDevelopmentTarget", () => {
  it("accepts the declared ai-development target", () => {
    expect(() => assertDevelopmentTarget("ai-development")).not.toThrow();
  });

  it("refuses a production or missing target declaration", () => {
    expect(() => assertDevelopmentTarget("production")).toThrow("ai-development");
    expect(() => assertDevelopmentTarget(undefined)).toThrow("ai-development");
  });
});
