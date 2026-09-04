import { describe, expect, it } from "vitest";
import path from "node:path";

import {
  documentDownloadDisposition,
  MAX_DOCUMENT_BYTES,
  nextDocumentVersionNumber,
  normalizeStoredDocumentFile,
  normalizeVaultDocumentDraft,
  normalizeVaultDocumentSource,
  normalizeVaultDocumentVersion,
  originalReferenceHref,
  sanitizeOriginalFilename,
  vaultDocumentDownloadPath,
  vaultDocumentKinds,
} from "@/lib/domain/documents";
import { documentStorageKey, documentStoreRoot, resolveStoredDocumentPath } from "@/lib/documents/storage";

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
      clientCompanyId: null,
      note: "발급본",
    });
  });

  it("links a client without a project for company evidence", () => {
    expect(
      normalizeVaultDocumentDraft({
        title: "사업자등록증",
        kind: "company_setup",
        originalReference: "docs/reg.pdf",
        clientCompanyId: "client-1",
      }),
    ).toEqual({
      title: "사업자등록증",
      kind: "company_setup",
      originalReference: "docs/reg.pdf",
      projectId: null,
      clientCompanyId: "client-1",
      note: null,
    });
  });

  it("rejects linking both a project and a client", () => {
    expect(() =>
      normalizeVaultDocumentDraft({
        title: "사업자등록증",
        kind: "company_setup",
        originalReference: "docs/reg.pdf",
        projectId: "project-1",
        clientCompanyId: "client-1",
      }),
    ).toThrow("Link to a project or a client, not both");
  });

  it("rejects a missing title, kind, or original location", () => {
    const valid = {
      title: "사업자등록증",
      kind: "company_setup",
      originalReference: "회사 문서함/설립/사업자등록증.pdf",
    };
    expect(() => normalizeVaultDocumentDraft({ ...valid, title: " " })).toThrow("Document title is required");
    expect(() => normalizeVaultDocumentDraft({ ...valid, kind: "invoice" })).toThrow("Unsupported document kind");
    expect(() => normalizeVaultDocumentDraft({ ...valid, originalReference: " " })).toThrow("Original file or location is required");
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

  it("accepts an uploaded original filename when no location is given", () => {
    expect(normalizeVaultDocumentSource({ filename: "license.pdf" })).toEqual({
      originalReference: "license.pdf",
    });
    expect(() => normalizeVaultDocumentSource({})).toThrow("Original file or location is required");
  });

  it("keeps a private download path and a safe stored filename", () => {
    expect(vaultDocumentDownloadPath("doc-1", "ver-1")).toBe("/documents/doc-1/versions/ver-1/download");
    expect(sanitizeOriginalFilename("../secret.pdf")).toBe("secret.pdf");
    expect(documentDownloadDisposition("license.pdf")).toContain("attachment");
  });

  it("rejects empty, oversized, or unsupported original files", () => {
    expect(() => normalizeStoredDocumentFile({ filename: "license.pdf", contentType: "application/pdf", byteSize: 0 }))
      .toThrow("Document file is empty");
    expect(() => normalizeStoredDocumentFile({
      filename: "license.pdf",
      contentType: "application/pdf",
      byteSize: MAX_DOCUMENT_BYTES + 1,
    })).toThrow("Document file is too large");
    expect(() => normalizeStoredDocumentFile({ filename: "notes.txt", contentType: "text/plain", byteSize: 12 }))
      .toThrow("Unsupported document file type");
  });
});

describe("private document store", () => {
  it("keeps originals under a local folder and rejects path escape", () => {
    expect(documentStoreRoot(undefined, "/tmp/coreloom")).toBe(path.resolve("/tmp/coreloom/.local/documents"));
    const key = documentStorageKey(
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222",
      "33333333-3333-3333-3333-333333333333",
      "license.pdf",
    );
    expect(key).toContain("license.pdf");
    expect(() => documentStorageKey("workspace", "doc", "ver", "license.pdf")).toThrow("Invalid document storage path");
    expect(() => resolveStoredDocumentPath("/tmp/coreloom/.local/documents", "../outside.pdf"))
      .toThrow("Invalid document storage path");
  });
});
