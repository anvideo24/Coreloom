import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { sanitizeOriginalFilename } from "@/lib/domain/documents";

const STORAGE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function documentStoreRoot(envDir = process.env.CORELOOM_DOCUMENT_DIR, cwd = process.cwd()) {
  return path.resolve(envDir?.trim() || path.join(cwd, ".local/documents"));
}

export function documentStorageKey(workspaceId: string, documentId: string, versionId: string, filename: string) {
  if (![workspaceId, documentId, versionId].every((id) => STORAGE_ID.test(id))) {
    throw new Error("Invalid document storage path");
  }
  return `${workspaceId}/${documentId}/${versionId}/${sanitizeOriginalFilename(filename)}`;
}

export function resolveStoredDocumentPath(root: string, storageKey: string) {
  const resolved = path.resolve(root, storageKey);
  const base = path.resolve(root);
  if (resolved !== base && !resolved.startsWith(`${base}${path.sep}`)) {
    throw new Error("Invalid document storage path");
  }
  return resolved;
}

export async function writeStoredDocument(input: {
  root?: string;
  workspaceId: string;
  documentId: string;
  versionId: string;
  filename: string;
  bytes: Uint8Array;
}) {
  const root = input.root ?? documentStoreRoot();
  const storageKey = documentStorageKey(input.workspaceId, input.documentId, input.versionId, input.filename);
  const filePath = resolveStoredDocumentPath(root, storageKey);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, input.bytes);
  return storageKey;
}

export async function readStoredDocument(storageKey: string, root = documentStoreRoot()) {
  return readFile(resolveStoredDocumentPath(root, storageKey));
}
