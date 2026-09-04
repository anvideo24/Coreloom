export const vaultDocumentKinds = ["company_setup", "contract", "deliverable", "settlement", "other"] as const;

export type VaultDocumentKind = (typeof vaultDocumentKinds)[number];

export const vaultDocumentKindLabels: Record<VaultDocumentKind, string> = {
  company_setup: "설립 증빙",
  contract: "계약",
  deliverable: "산출물",
  settlement: "정산",
  other: "기타",
};

export const COMPANY_DOCUMENT_LABEL = "회사 공통";

export function nextDocumentVersionNumber(latestVersionNumber: number) {
  return latestVersionNumber + 1;
}

export const allowedDocumentContentTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

export function normalizeOriginalReference(value: string) {
  const originalReference = value.trim();
  if (!originalReference) throw new Error("Original reference is required");
  if (originalReference.length > 500) throw new Error("Original reference is too long");
  return originalReference;
}

export function sanitizeOriginalFilename(name: string) {
  const cleaned = name.replace(/[/\\]/g, "").replace(/^\.+/, "").trim();
  if (!cleaned) throw new Error("Original filename is required");
  if (cleaned.length > 180) throw new Error("Original filename is too long");
  return cleaned;
}

export function normalizeVaultDocumentSource(input: { originalReference?: string; filename?: string }) {
  const originalReference = input.originalReference?.trim() || "";
  const filename = input.filename?.trim() || "";
  if (!originalReference && !filename) throw new Error("Original file or location is required");
  return {
    originalReference: originalReference
      ? normalizeOriginalReference(originalReference)
      : sanitizeOriginalFilename(filename),
  };
}

export function normalizeStoredDocumentFile(input: { filename: string; contentType: string; byteSize: number }) {
  if (input.byteSize <= 0) throw new Error("Document file is empty");
  if (input.byteSize > MAX_DOCUMENT_BYTES) throw new Error("Document file is too large");
  if (!(allowedDocumentContentTypes as readonly string[]).includes(input.contentType)) {
    throw new Error("Unsupported document file type");
  }
  return {
    filename: sanitizeOriginalFilename(input.filename),
    contentType: input.contentType,
    byteSize: input.byteSize,
  };
}

export function vaultDocumentDownloadPath(documentId: string, versionId: string) {
  return `/documents/${documentId}/versions/${versionId}/download`;
}

export function documentDownloadDisposition(filename: string) {
  const safe = sanitizeOriginalFilename(filename).replace(/"/g, "");
  return `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

export function originalReferenceHref(reference: string) {
  try {
    const parsed = new URL(reference);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return reference;
  } catch {
    return null;
  }
  return null;
}

export function normalizeVaultDocumentDraft(input: {
  title: string;
  kind: string;
  originalReference?: string;
  filename?: string;
  projectId?: string;
  clientCompanyId?: string;
  note?: string;
}): {
  title: string;
  kind: VaultDocumentKind;
  originalReference: string;
  projectId: string | null;
  clientCompanyId: string | null;
  note: string | null;
} {
  const title = input.title.trim();
  const projectId = input.projectId?.trim() || null;
  const clientCompanyId = input.clientCompanyId?.trim() || null;
  const note = input.note?.trim() || null;

  if (!title) throw new Error("Document title is required");
  if (title.length > 160) throw new Error("Document title is too long");
  if (!vaultDocumentKinds.includes(input.kind as VaultDocumentKind)) throw new Error("Unsupported document kind");
  if (note && note.length > 500) throw new Error("Document note is too long");
  if (projectId && clientCompanyId) throw new Error("Link to a project or a client, not both");

  return {
    title,
    kind: input.kind as VaultDocumentKind,
    originalReference: normalizeVaultDocumentSource({
      originalReference: input.originalReference,
      filename: input.filename,
    }).originalReference,
    projectId,
    clientCompanyId,
    note,
  };
}

export function normalizeVaultDocumentVersion(input: { originalReference?: string; filename?: string; note?: string }) {
  const note = input.note?.trim() || null;
  if (note && note.length > 500) throw new Error("Document note is too long");
  return {
    originalReference: normalizeVaultDocumentSource({
      originalReference: input.originalReference,
      filename: input.filename,
    }).originalReference,
    note,
  };
}
