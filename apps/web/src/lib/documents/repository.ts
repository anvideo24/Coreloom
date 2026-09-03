import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { createDatabase } from "@/lib/db/client";
import { auditEvents, clientCompanies, projects, vaultDocumentVersions, vaultDocuments } from "@/lib/db/schema";
import { COMPANY_DOCUMENT_LABEL, nextDocumentVersionNumber, normalizeVaultDocumentDraft, normalizeVaultDocumentVersion } from "@/lib/domain/documents";
import { ensureFounderWorkspace } from "@/lib/workspace/founder-workspace";

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

  const versionRows = await database.select({
    documentId: vaultDocuments.id,
    versionId: vaultDocumentVersions.id,
    versionNumber: vaultDocumentVersions.versionNumber,
    title: vaultDocuments.title,
    kind: vaultDocuments.kind,
    originalReference: vaultDocumentVersions.originalReference,
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

  const latestByDocument = new Map<string, (typeof versionRows)[number] & { counterparty: string }>();
  for (const row of versionRows) {
    if (latestByDocument.has(row.documentId)) continue;
    latestByDocument.set(row.documentId, {
      ...row,
      counterparty: row.projectName && row.clientName
        ? `${row.clientName} · ${row.projectName}`
        : COMPANY_DOCUMENT_LABEL,
    });
  }

  return {
    projects: projectRows,
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

export async function createFounderVaultDocument(input: {
  actorUserId: string;
  title: string;
  kind: string;
  originalReference: string;
  projectId?: string;
  note?: string;
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "documents");
  const database = createDatabase();
  const draft = normalizeVaultDocumentDraft(input);

  let clientCompanyId: string | null = null;
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

  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "vault_document.created",
    payload: { documentId: created.id, versionId: version.id, kind: draft.kind },
  });

  return { documentId: created.id };
}

export async function addFounderVaultDocumentVersion(input: {
  actorUserId: string;
  documentId: string;
  originalReference: string;
  note?: string;
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
  const version = normalizeVaultDocumentVersion(input);
  const [created] = await database.insert(vaultDocumentVersions).values({
    workspaceId: workspace.id,
    documentId: document.id,
    versionNumber: nextDocumentVersionNumber(latest?.versionNumber ?? 0),
    originalReference: version.originalReference,
    note: version.note,
  }).returning({ id: vaultDocumentVersions.id, versionNumber: vaultDocumentVersions.versionNumber });

  await database.update(vaultDocuments).set({ updatedAt: new Date() }).where(eq(vaultDocuments.id, document.id));
  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "vault_document.version_added",
    payload: { documentId: document.id, versionId: created.id, versionNumber: created.versionNumber },
  });

  return { documentId: document.id };
}
