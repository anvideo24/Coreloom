import { describe, expect, it } from "vitest";

import { companyProfileStorageMissingMessage } from "@/lib/company-setup/profile-storage";
import {
  calculateCompanySetupProgress,
  companySetupTemplates,
  normalizeCompanySetupUpdate,
} from "@/lib/domain/company-setup";

describe("company setup defaults", () => {
  it("starts a personal-business checklist with the required and conditional items", () => {
    expect(companySetupTemplates.map((item) => item.code)).toEqual([
      "business-registration-application",
      "business-place-document",
      "business-permit-check",
      "joint-business-check",
      "business-registration-certificate",
      "tax-schedule-review",
    ]);
    expect(companySetupTemplates.filter((item) => item.isConditional).map((item) => item.code)).toEqual([
      "business-place-document",
      "business-permit-check",
      "joint-business-check",
    ]);
  });
});

describe("company setup progress", () => {
  it("counts completed and not-applicable checks as settled", () => {
    expect(calculateCompanySetupProgress([
      { status: "complete" },
      { status: "not_applicable" },
      { status: "in_progress" },
    ])).toBe(67);
  });
});

describe("company setup updates", () => {
  it("trims evidence references and marks a completion time only when completed", () => {
    expect(normalizeCompanySetupUpdate({
      status: "complete",
      evidenceReference: "  C:/Coreloom/evidence/registration.pdf  ",
      note: "  발급본 확인  ",
    })).toMatchObject({
      status: "complete",
      evidenceReference: "C:/Coreloom/evidence/registration.pdf",
      note: "발급본 확인",
      completedAt: expect.any(Date),
    });
  });

  it("rejects completing an item without evidence", () => {
    expect(() => normalizeCompanySetupUpdate({ status: "complete" })).toThrow("Evidence is required to mark as complete");
    expect(() => normalizeCompanySetupUpdate({ status: "complete", evidenceReference: "  " })).toThrow("Evidence is required to mark as complete");
  });

  it("allows in-progress or not-applicable without evidence", () => {
    expect(normalizeCompanySetupUpdate({ status: "in_progress" })).toMatchObject({ status: "in_progress", evidenceReference: null, completedAt: null });
    expect(normalizeCompanySetupUpdate({ status: "not_applicable" })).toMatchObject({ status: "not_applicable", completedAt: null });
  });
});

describe("company profile storage notice", () => {
  it("tells the operator to migrate 0022 on the development PC without claiming it is already applied", () => {
    expect(companyProfileStorageMissingMessage).toContain("0022");
    expect(companyProfileStorageMissingMessage).toContain("npm run db:migrate");
    expect(companyProfileStorageMissingMessage).not.toMatch(/적용되어 있/);
  });
});
