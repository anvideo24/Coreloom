import { describe, expect, it } from "vitest";

import {
  nextDocumentVersionNumber,
  normalizeVaultDocumentDraft,
  normalizeVaultDocumentVersion,
  originalReferenceHref,
  vaultDocumentKinds,
} from "@/lib/domain/documents";

describe("private document drafts", () => {
  it("keeps a titled original location and optional project", () => {
    expect(normalizeVaultDocumentDraft({
      title: " 사업자등록증 ",
      kind: "company_setup",
      originalReference: " 회사 문서함/설립/사업자등록증.pdf ",
      projectId: " ",
      note: " 발급본 ",
    })).toEqual({
      title: "사업자등록증",
      kind: "company_setup",
      originalReference: "회사 문서함/설립/사업자등록증.pdf",
      projectId: null,
      note: "발급본",
    });
  });

  it("rejects a missing title, kind, or original location", () => {
    const valid = {
      title: "사업자등록증",
      kind: "company_setup",
      originalReference: "회사 문서함/설립/사업자등록증.pdf",
    };
    expect(() => normalizeVaultDocumentDraft({ ...valid, title: " " })).toThrow("Document title is required");
    expect(() => normalizeVaultDocumentDraft({ ...valid, kind: "invoice" })).toThrow("Unsupported document kind");
    expect(() => normalizeVaultDocumentDraft({ ...valid, originalReference: " " })).toThrow("Original reference is required");
  });

  it("exposes only the supported document kinds", () => {
    expect(vaultDocumentKinds).toEqual(["company_setup", "contract", "deliverable", "settlement", "other"]);
  });
});

describe("private document versions", () => {
  it("adds a later version without changing the previous original location", () => {
    expect(nextDocumentVersionNumber(1)).toBe(2);
    expect(normalizeVaultDocumentVersion({
      originalReference: " 회사 문서함/설립/사업자등록증-재발급.pdf ",
    })).toEqual({
      originalReference: "회사 문서함/설립/사업자등록증-재발급.pdf",
      note: null,
    });
  });

  it("opens only http or https original links", () => {
    expect(originalReferenceHref("https://example.com/docs/sample.pdf")).toBe("https://example.com/docs/sample.pdf");
    expect(originalReferenceHref("회사 문서함/설립/사업자등록증.pdf")).toBeNull();
  });
});
