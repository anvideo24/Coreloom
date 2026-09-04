import { describe, expect, it } from "vitest";

import {
  assertContractAmendmentSource,
  executeContract,
  nextContractVersionNumber,
  normalizeContractTerms,
  recordContractOriginal,
} from "@/lib/domain/contracts";

describe("contract originals", () => {
  it("records a stamped original on a draft", () => {
    expect(recordContractOriginal({ status: "draft", originalReference: " 문서함/날인본.pdf " })).toEqual({
      status: "original_recorded",
      originalReference: "문서함/날인본.pdf",
    });
  });

  it("updates the original location before execution", () => {
    expect(recordContractOriginal({ status: "original_recorded", originalReference: "문서함/수정-날인본.pdf" })).toEqual({
      status: "original_recorded",
      originalReference: "문서함/수정-날인본.pdf",
    });
  });

  it("rejects an empty original or a change to an executed contract", () => {
    expect(() => recordContractOriginal({ status: "draft", originalReference: " " })).toThrow("Stamped original reference is required");
    expect(() => recordContractOriginal({ status: "executed", originalReference: "문서함/날인본.pdf" })).toThrow("Executed contracts cannot be changed");
  });
});

describe("contract terms", () => {
  it("keeps optional effective dates and auto-renew on a draft", () => {
    expect(
      normalizeContractTerms({
        status: "draft",
        effectiveStartOn: "2026-09-01",
        effectiveEndOn: "2027-08-31",
        autoRenew: "true",
      }),
    ).toEqual({
      effectiveStartOn: "2026-09-01",
      effectiveEndOn: "2027-08-31",
      autoRenew: true,
    });
  });

  it("rejects an end before the start or a change after execution", () => {
    expect(() =>
      normalizeContractTerms({
        status: "draft",
        effectiveStartOn: "2027-01-01",
        effectiveEndOn: "2026-01-01",
      }),
    ).toThrow("Effective end date must be on or after start date");
    expect(() =>
      normalizeContractTerms({
        status: "executed",
        effectiveStartOn: "2026-09-01",
      }),
    ).toThrow("Executed contracts cannot be changed");
  });
});

describe("contract execution", () => {
  it("requires representative approval and a stored original", () => {
    expect(executeContract({ status: "original_recorded", originalReference: "문서함/날인본.pdf", approved: true })).toEqual({
      status: "executed",
    });
    expect(() => executeContract({ status: "original_recorded", originalReference: "문서함/날인본.pdf", approved: false })).toThrow("Representative approval is required");
    expect(() => executeContract({ status: "draft", originalReference: null, approved: true })).toThrow("Stamped original is required before execution");
  });
});

describe("contract versioning", () => {
  it("creates the next immutable version number from an executed contract", () => {
    expect(nextContractVersionNumber(1)).toBe(2);
    expect(() => assertContractAmendmentSource("draft")).toThrow("Only an executed contract can start an amendment");
    expect(() => assertContractAmendmentSource("executed")).not.toThrow();
  });
});
