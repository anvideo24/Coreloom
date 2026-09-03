import { describe, expect, it } from "vitest";

import { normalizeClientName, normalizeProjectProgressUpdate, normalizeProjectRegistration, projectStatuses } from "@/lib/domain/clients-projects";

describe("client registration", () => {
  it("stores a trimmed client name", () => {
    expect(normalizeClientName("  Acme Studio  ")).toBe("Acme Studio");
  });
});

describe("project registration", () => {
  it("keeps a client-linked active project with its progress", () => {
    expect(normalizeProjectRegistration({
      clientId: "client-1",
      name: "  홈페이지 개편  ",
      status: "active",
      progressPercent: "35",
    })).toEqual({
      clientId: "client-1",
      name: "홈페이지 개편",
      status: "active",
      progressPercent: 35,
    });
  });

  it("rejects a progress percentage outside the dashboard range", () => {
    expect(() => normalizeProjectRegistration({
      clientId: "client-1",
      name: "홈페이지 개편",
      status: "active",
      progressPercent: "101",
    })).toThrow("Progress must be between 0 and 100");
  });

  it("exposes only the supported project states", () => {
    expect(projectStatuses).toEqual(["planned", "active", "on_hold", "complete"]);
  });
});

describe("project progress update", () => {
  it("keeps the target project, status, and current progress together", () => {
    expect(normalizeProjectProgressUpdate({
      projectId: "project-1",
      status: "on_hold",
      progressPercent: "60",
    })).toEqual({ projectId: "project-1", status: "on_hold", progressPercent: 60 });
  });
});
