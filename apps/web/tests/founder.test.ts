import { describe, expect, it } from "vitest";
import { founderIdentityFromSession } from "@/lib/auth/founder";

describe("founderIdentityFromSession", () => {
  const founderEmail = "founder@example.test";

  it("returns the configured founder", () => {
    expect(founderIdentityFromSession({ id: "user-1", email: founderEmail }, founderEmail)).toEqual({
      id: "user-1",
      email: founderEmail,
    });
  });

  it("rejects a missing session", () => {
    expect(() => founderIdentityFromSession(null, founderEmail)).toThrow("Sign-in is required");
  });

  it("rejects another email", () => {
    expect(() => founderIdentityFromSession({ id: "user-2", email: "other@example.test" }, founderEmail)).toThrow(
      "Founder account is required",
    );
  });
});
