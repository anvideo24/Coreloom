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

export function normalizeOriginalReference(value: string) {
  const originalReference = value.trim();
  if (!originalReference) throw new Error("Original reference is required");
  if (originalReference.length > 500) throw new Error("Original reference is too long");
  return originalReference;
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
  originalReference: string;
  projectId?: string;
  note?: string;
}): {
  title: string;
  kind: VaultDocumentKind;
  originalReference: string;
  projectId: string | null;
  note: string | null;
} {
  const title = input.title.trim();
  const projectId = input.projectId?.trim() || null;
  const note = input.note?.trim() || null;

  if (!title) throw new Error("Document title is required");
  if (title.length > 160) throw new Error("Document title is too long");
  if (!vaultDocumentKinds.includes(input.kind as VaultDocumentKind)) throw new Error("Unsupported document kind");
  if (note && note.length > 500) throw new Error("Document note is too long");

  return {
    title,
    kind: input.kind as VaultDocumentKind,
    originalReference: normalizeOriginalReference(input.originalReference),
    projectId,
    note,
  };
}

export function normalizeVaultDocumentVersion(input: { originalReference: string; note?: string }) {
  const note = input.note?.trim() || null;
  if (note && note.length > 500) throw new Error("Document note is too long");
  return {
    originalReference: normalizeOriginalReference(input.originalReference),
    note,
  };
}
