import { describe, expect, it } from "vitest";
import { calculateProgress } from "@/lib/domain/projects";

describe("calculateProgress", () => {
  it("returns zero when a project has no tasks", () => {
    expect(calculateProgress([])).toBe(0);
  });

  it("rounds completed task progress to a whole percent", () => {
    expect(
      calculateProgress([
        { completedAt: "2026-09-03" },
        { completedAt: null },
        { completedAt: null },
      ]),
    ).toBe(33);
  });
});
