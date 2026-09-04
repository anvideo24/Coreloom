import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { createDatabase } from "@/lib/db/client";
import { auditEvents, clientCompanies, projects, vaultDocumentVersions, vaultDocuments } from "@/lib/db/schema";
import { COMPANY_DOCUMENT_LABEL, nextDocumentVersionNumber, normalizeStoredDocumentFile, normalizeVaultDocumentDraft, normalizeVaultDocumentVersion } from "@/lib/domain/documents";
import { writeStoredDocument } from "@/lib/documents/storage";
import { ensureFounderWorkspace } from "@/lib/workspace/founder-workspace";

type StoredDocumentUpload = {
  filename: string;
  contentType: string;
  bytes: Uint8Array;
};

export async function listFounderVaultDocuments(authUserId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "documents");
  const database = createDatabase();
  const projectRows = await database.select({
    id: projects.id,
    name: projects.name,
    clientName: clientCompanies.name,
  }).from(projects)
    .innerJoin(clientCompanies, eq(projects.clientCompanyId, clientCompanies.id))
    .where(and(eq(projects.workspaceId, workspace.id), isNull(projects.deletedAt), isNull(clientCompanies.deletedAt)))
    .orderBy(asc(clientCompanies.name), asc(projects.name));

  const clientRows = await database.select({
    id: clientCompanies.id,
    name: clientCompanies.name,
  }).from(clientCompanies)
    .where(and(eq(clientCompanies.workspaceId, workspace.id), isNull(clientCompanies.deletedAt)))
    .orderBy(asc(clientCompanies.name));

  const versionRows = await database.select({
    documentId: vaultDocuments.id,
    versionId: vaultDocumentVersions.id,
    versionNumber: vaultDocumentVersions.versionNumber,
    title: vaultDocuments.title,
    kind: vaultDocuments.kind,
    originalReference: vaultDocumentVersions.originalReference,
    storedFilename: vaultDocumentVersions.storedFilename,
    storageKey: vaultDocumentVersions.storageKey,
    clientName: clientCompanies.name,
    projectName: projects.name,
    createdAt: vaultDocumentVersions.createdAt,
  }).from(vaultDocumentVersions)
    .innerJoin(vaultDocuments, eq(vaultDocumentVersions.documentId, vaultDocuments.id))
    .leftJoin(projects, eq(vaultDocuments.projectId, projects.id))
    .leftJoin(clientCompanies, eq(vaultDocuments.clientCompanyId, clientCompanies.id))
    .where(and(
      eq(vaultDocuments.workspaceId, workspace.id),
      isNull(vaultDocuments.deletedAt),
    ))
    .orderBy(desc(vaultDocumentVersions.createdAt));

  const latestByDocument = new Map<string, (typeof versionRows)[number] & { counterparty: string; hasStoredFile: boolean }>();
  for (const row of versionRows) {
    if (latestByDocument.has(row.documentId)) continue;
    latestByDocument.set(row.documentId, {
      ...row,
      hasStoredFile: Boolean(row.storageKey),
      counterparty: row.projectName && row.clientName
        ? `${row.clientName} · ${row.projectName}`
        : row.clientName
          ? row.clientName
          : COMPANY_DOCUMENT_LABEL,
    });
  }

  return {
    projects: projectRows,
    clients: clientRows,
    documents: [...latestByDocument.values()],
  };
}

export async function getFounderVaultDocumentDetail(authUserId: string, documentId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "documents");
  const database = createDatabase();
  const [document] = await database.select({
    id: vaultDocuments.id,
    title: vaultDocuments.title,
    kind: vaultDocuments.kind,
    clientName: clientCompanies.name,
    projectName: projects.name,
  }).from(vaultDocuments)
    .leftJoin(projects, eq(vaultDocuments.projectId, projects.id))
    .leftJoin(clientCompanies, eq(vaultDocuments.clientCompanyId, clientCompanies.id))
    .where(and(
      eq(vaultDocuments.id, documentId),
      eq(vaultDocuments.workspaceId, workspace.id),
      isNull(vaultDocuments.deletedAt),
    ))
    .limit(1);
  if (!document) return null;

  const versions = await database.select({
    id: vaultDocumentVersions.id,
    versionNumber: vaultDocumentVersions.versionNumber,
    originalReference: vaultDocumentVersions.originalReference,
    storedFilename: vaultDocumentVersions.storedFilename,
    contentType: vaultDocumentVersions.contentType,
    byteSize: vaultDocumentVersions.byteSize,
    storageKey: vaultDocumentVersions.storageKey,
    note: vaultDocumentVersions.note,
    createdAt: vaultDocumentVersions.createdAt,
  }).from(vaultDocumentVersions)
    .where(and(
      eq(vaultDocumentVersions.documentId, document.id),
      eq(vaultDocumentVersions.workspaceId, workspace.id),
    ))
    .orderBy(desc(vaultDocumentVersions.versionNumber));

  return {
    document: {
      ...document,
      counterparty: document.projectName && document.clientName
        ? `${document.clientName} · ${document.projectName}`
        : COMPANY_DOCUMENT_LABEL,
    },
    versions,
  };
}

async function storeUploadedVersion(input: {
  workspaceId: string;
  documentId: string;
  versionId: string;
  file?: StoredDocumentUpload;
}) {
  if (!input.file) return null;
  const stored = normalizeStoredDocumentFile({
    filename: input.file.filename,
    contentType: input.file.contentType,
    byteSize: input.file.bytes.byteLength,
  });
  const storageKey = await writeStoredDocument({
    workspaceId: input.workspaceId,
    documentId: input.documentId,
    versionId: input.versionId,
    filename: stored.filename,
    bytes: input.file.bytes,
  });
  const database = createDatabase();
  await database.update(vaultDocumentVersions).set({
    storedFilename: stored.filename,
    contentType: stored.contentType,
    byteSize: stored.byteSize,
    storageKey,
  }).where(eq(vaultDocumentVersions.id, input.versionId));
  return stored;
}

export async function createFounderVaultDocument(input: {
  actorUserId: string;
  title: string;
  kind: string;
  originalReference?: string;
  projectId?: string;
  clientCompanyId?: string;
  note?: string;
  file?: StoredDocumentUpload;
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "documents");
  const database = createDatabase();
  const draft = normalizeVaultDocumentDraft({
    ...input,
    filename: input.file?.filename,
  });

  let clientCompanyId: string | null = draft.clientCompanyId;
  if (draft.projectId) {
    const [project] = await database.select({
      id: projects.id,
      clientCompanyId: projects.clientCompanyId,
    }).from(projects)
      .innerJoin(clientCompanies, eq(projects.clientCompanyId, clientCompanies.id))
      .where(and(
        eq(projects.id, draft.projectId),
        eq(projects.workspaceId, workspace.id),
        isNull(projects.deletedAt),
        isNull(clientCompanies.deletedAt),
      ))
      .limit(1);
    if (!project) throw new Error("Project was not found");
    clientCompanyId = project.clientCompanyId;
  } else if (draft.clientCompanyId) {
    const [client] = await database.select({ id: clientCompanies.id }).from(clientCompanies)
      .where(and(
        eq(clientCompanies.id, draft.clientCompanyId),
        eq(clientCompanies.workspaceId, workspace.id),
        isNull(clientCompanies.deletedAt),
      ))
      .limit(1);
    if (!client) throw new Error("Client was not found");
    clientCompanyId = client.id;
  }

  const [created] = await database.insert(vaultDocuments).values({
    workspaceId: workspace.id,
    title: draft.title,
    kind: draft.kind,
    clientCompanyId,
    projectId: draft.projectId,
  }).returning({ id: vaultDocuments.id });

  const [version] = await database.insert(vaultDocumentVersions).values({
    workspaceId: workspace.id,
    documentId: created.id,
    versionNumber: 1,
    originalReference: draft.originalReference,
    note: draft.note,
  }).returning({ id: vaultDocumentVersions.id });

  const stored = await storeUploadedVersion({
    workspaceId: workspace.id,
    documentId: created.id,
    versionId: version.id,
    file: input.file,
  });

  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "vault_document.created",
    payload: {
      documentId: created.id,
      versionId: version.id,
      kind: draft.kind,
      storedFilename: stored?.filename ?? null,
    },
  });

  return { documentId: created.id };
}

export async function addFounderVaultDocumentVersion(input: {
  actorUserId: string;
  documentId: string;
  originalReference?: string;
  note?: string;
  file?: StoredDocumentUpload;
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "documents");
  const database = createDatabase();
  const [document] = await database.select({ id: vaultDocuments.id }).from(vaultDocuments)
    .where(and(
      eq(vaultDocuments.id, input.documentId),
      eq(vaultDocuments.workspaceId, workspace.id),
      isNull(vaultDocuments.deletedAt),
    ))
    .limit(1);
  if (!document) throw new Error("Document was not found");

  const [latest] = await database.select({ versionNumber: vaultDocumentVersions.versionNumber })
    .from(vaultDocumentVersions)
    .where(eq(vaultDocumentVersions.documentId, document.id))
    .orderBy(desc(vaultDocumentVersions.versionNumber))
    .limit(1);
  const version = normalizeVaultDocumentVersion({
    ...input,
    filename: input.file?.filename,
  });
  const [created] = await database.insert(vaultDocumentVersions).values({
    workspaceId: workspace.id,
    documentId: document.id,
    versionNumber: nextDocumentVersionNumber(latest?.versionNumber ?? 0),
    originalReference: version.originalReference,
    note: version.note,
  }).returning({ id: vaultDocumentVersions.id, versionNumber: vaultDocumentVersions.versionNumber });

  const stored = await storeUploadedVersion({
    workspaceId: workspace.id,
    documentId: document.id,
    versionId: created.id,
    file: input.file,
  });

  await database.update(vaultDocuments).set({ updatedAt: new Date() }).where(eq(vaultDocuments.id, document.id));
  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "vault_document.version_added",
    payload: {
      documentId: document.id,
      versionId: created.id,
      versionNumber: created.versionNumber,
      storedFilename: stored?.filename ?? null,
    },
  });

  return { documentId: document.id };
}

export async function getFounderVaultDocumentVersionFile(authUserId: string, documentId: string, versionId: string) {
  const detail = await getFounderVaultDocumentDetail(authUserId, documentId);
  const version = detail?.versions.find((candidate) => candidate.id === versionId);
  if (!detail || !version?.storageKey || !version.storedFilename || !version.contentType) return null;
  return {
    title: detail.document.title,
    versionNumber: version.versionNumber,
    storedFilename: version.storedFilename,
    contentType: version.contentType,
    storageKey: version.storageKey,
  };
}
