import { describe, expect, it } from "vitest";

import { normalizeClientContact, normalizeClientName, normalizeProjectProgressUpdate, normalizeProjectRegistration, projectStatuses } from "@/lib/domain/clients-projects";

describe("client contact registration", () => {
  it("keeps a client-linked contact with optional email and role", () => {
    expect(normalizeClientContact({
      clientId: "client-1",
      name: "  김담당  ",
      role: "  프로젝트 매니저  ",
      email: " contact@example.com ",
      phone: " 010-0000-0000 ",
      relationStatus: "active",
    })).toEqual({
      clientId: "client-1",
      name: "김담당",
      role: "프로젝트 매니저",
      email: "contact@example.com",
      phone: "010-0000-0000",
      relationStatus: "active",
    });
  });

  it("rejects a missing name or invalid email", () => {
    expect(() => normalizeClientContact({ clientId: "client-1", name: " ", relationStatus: "active" })).toThrow("Contact name is required");
    expect(() => normalizeClientContact({ clientId: "client-1", name: "김담당", email: "not-an-email", relationStatus: "active" })).toThrow("Contact email is invalid");
  });

  it("rejects a missing client or unsupported relation status", () => {
    expect(() => normalizeClientContact({ clientId: " ", name: "김담당", relationStatus: "active" })).toThrow("Client is required");
    expect(() => normalizeClientContact({ clientId: "client-1", name: "김담당", relationStatus: "unknown" })).toThrow("Unsupported contact relation status");
  });

  it("keeps an inactive relation without requiring email or phone", () => {
    expect(normalizeClientContact({
      clientId: "client-1",
      name: "김담당",
      relationStatus: "inactive",
    })).toEqual({
      clientId: "client-1",
      name: "김담당",
      role: null,
      email: null,
      phone: null,
      relationStatus: "inactive",
    });
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
