import { describe, expect, it } from "vitest";

import {
  formatClientListMeta,
  normalizeBusinessRegistrationNumber,
  normalizeClientCompanyProfile,
  normalizeClientContact,
  normalizeClientName,
  normalizeProjectProgressUpdate,
  normalizeProjectRegistration,
  projectStatuses,
} from "@/lib/domain/clients-projects";

describe("client company profile", () => {
  it("keeps company tax and contact fields together", () => {
    expect(
      normalizeClientCompanyProfile({
        name: "  주식회사 예시  ",
        businessRegistrationNumber: "1234567890",
        representativeName: " 홍길동 ",
        address: " 서울시 ",
        businessType: " 서비스업 ",
        businessItem: " 소프트웨어 ",
        website: "example.com",
        phone: " 02-0000-0000 ",
        email: " office@example.com ",
        businessRegistrationRef: " docs/reg.pdf ",
      }),
    ).toEqual({
      name: "주식회사 예시",
      businessRegistrationNumber: "123-45-67890",
      representativeName: "홍길동",
      address: "서울시",
      businessType: "서비스업",
      businessItem: "소프트웨어",
      website: "example.com",
      phone: "02-0000-0000",
      email: "office@example.com",
      businessRegistrationRef: "docs/reg.pdf",
    });
  });

  it("rejects a business registration number that is not 10 digits", () => {
    expect(() => normalizeBusinessRegistrationNumber("123")).toThrow("Business registration number must be 10 digits");
  });

  it("formats list meta with registration number and representative", () => {
    expect(
      formatClientListMeta({
        businessRegistrationNumber: "123-45-67890",
        representativeName: "홍길동",
        contactCount: 2,
        projectCount: 1,
      }),
    ).toBe("123-45-67890 · 대표 홍길동 · 담당자 2명 · 프로젝트 1개");
  });
});

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
      taxInvoiceRecipient: false,
    });
  });

  it("requires email when the contact receives tax invoices", () => {
    expect(() =>
      normalizeClientContact({
        clientId: "client-1",
        name: "김담당",
        relationStatus: "active",
        taxInvoiceRecipient: true,
      }),
    ).toThrow("Tax invoice recipient email is required");
    expect(
      normalizeClientContact({
        clientId: "client-1",
        name: "김담당",
        email: "billing@example.com",
        relationStatus: "active",
        taxInvoiceRecipient: "on",
      }).taxInvoiceRecipient,
    ).toBe(true);
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
      taxInvoiceRecipient: false,
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

describe("client name", () => {
  it("trims the mutual name", () => {
    expect(normalizeClientName("  예시  ")).toBe("예시");
  });
});
