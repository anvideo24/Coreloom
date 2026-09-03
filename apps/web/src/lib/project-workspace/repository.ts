import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { createDatabase } from "@/lib/db/client";
import {
  aiProposals,
  billings,
  clientCompanies,
  clientContacts,
  contracts,
  contractVersions,
  projects,
  quoteVersions,
  quotes,
  rechoEvidence,
  tasks,
  vaultDocumentVersions,
  vaultDocuments,
} from "@/lib/db/schema";
import { aiProposalKindLabels, aiProposalStatusLabels } from "@/lib/domain/ai-proposals";
import { billingKindLabels, billingStatusLabels } from "@/lib/domain/billings";
import { projectStatusLabels } from "@/lib/domain/clients-projects";
import { contractStatusLabels } from "@/lib/domain/contracts";
import { vaultDocumentKindLabels } from "@/lib/domain/documents";
import { buildProjectWorkspace } from "@/lib/domain/project-workspace";
import { rechoEvidenceKindLabels } from "@/lib/domain/recho-evidence";
import { taskStatusLabels } from "@/lib/domain/tasks";
import { ensureFounderWorkspace } from "@/lib/workspace/founder-workspace";

export async function getFounderProjectWorkspace(authUserId: string, projectId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "project-workspace");
  const database = createDatabase();
  const [project] = await database.select({
    id: projects.id,
    name: projects.name,
    status: projects.status,
    progressPercent: projects.progressPercent,
    clientCompanyId: projects.clientCompanyId,
    clientName: clientCompanies.name,
  }).from(projects)
    .innerJoin(clientCompanies, eq(projects.clientCompanyId, clientCompanies.id))
    .where(and(
      eq(projects.id, projectId),
      eq(projects.workspaceId, workspace.id),
      isNull(projects.deletedAt),
      isNull(clientCompanies.deletedAt),
    ))
    .limit(1);
  if (!project) return null;

  const [
    contactRows,
    taskRows,
    quoteRows,
    contractRows,
    billingRows,
    documentRows,
    evidenceRows,
    proposalRows,
  ] = await Promise.all([
    database.select({
      id: clientContacts.id,
      name: clientContacts.name,
      role: clientContacts.role,
      email: clientContacts.email,
      phone: clientContacts.phone,
    }).from(clientContacts)
      .where(and(
        eq(clientContacts.workspaceId, workspace.id),
        eq(clientContacts.clientCompanyId, project.clientCompanyId),
        isNull(clientContacts.deletedAt),
      ))
      .orderBy(asc(clientContacts.name)),
    database.select({
      id: tasks.id,
      title: tasks.title,
      dueDate: tasks.dueDate,
      status: tasks.status,
    }).from(tasks)
      .where(and(eq(tasks.workspaceId, workspace.id), eq(tasks.projectId, project.id), isNull(tasks.deletedAt))),
    database.select({
      quoteId: quotes.id,
      versionNumber: quoteVersions.versionNumber,
      title: quoteVersions.title,
      totalAmount: quoteVersions.totalAmount,
    }).from(quoteVersions)
      .innerJoin(quotes, eq(quoteVersions.quoteId, quotes.id))
      .where(and(
        eq(quotes.workspaceId, workspace.id),
        eq(quotes.projectId, project.id),
        isNull(quotes.deletedAt),
      ))
      .orderBy(desc(quoteVersions.versionNumber)),
    database.select({
      contractId: contracts.id,
      versionNumber: contractVersions.versionNumber,
      title: contractVersions.title,
      status: contractVersions.status,
      totalAmount: contractVersions.totalAmount,
    }).from(contractVersions)
      .innerJoin(contracts, eq(contractVersions.contractId, contracts.id))
      .where(and(
        eq(contracts.workspaceId, workspace.id),
        eq(contracts.projectId, project.id),
        isNull(contracts.deletedAt),
      ))
      .orderBy(desc(contractVersions.versionNumber)),
    database.select({
      id: billings.id,
      kind: billings.kind,
      amount: billings.amount,
      dueDate: billings.dueDate,
      status: billings.status,
    }).from(billings)
      .where(and(eq(billings.workspaceId, workspace.id), eq(billings.projectId, project.id), isNull(billings.deletedAt))),
    database.select({
      documentId: vaultDocuments.id,
      versionNumber: vaultDocumentVersions.versionNumber,
      title: vaultDocuments.title,
      kind: vaultDocuments.kind,
    }).from(vaultDocumentVersions)
      .innerJoin(vaultDocuments, eq(vaultDocumentVersions.documentId, vaultDocuments.id))
      .where(and(
        eq(vaultDocuments.workspaceId, workspace.id),
        eq(vaultDocuments.projectId, project.id),
        isNull(vaultDocuments.deletedAt),
      ))
      .orderBy(desc(vaultDocumentVersions.versionNumber)),
    database.select({
      id: rechoEvidence.id,
      title: rechoEvidence.title,
      kind: rechoEvidence.kind,
      occurredOn: rechoEvidence.occurredOn,
      occurredTime: rechoEvidence.occurredTime,
      originalUrl: rechoEvidence.originalUrl,
      linkReason: rechoEvidence.linkReason,
    }).from(rechoEvidence)
      .where(and(eq(rechoEvidence.workspaceId, workspace.id), eq(rechoEvidence.projectId, project.id), isNull(rechoEvidence.deletedAt))),
    database.select({
      id: aiProposals.id,
      evidenceId: aiProposals.evidenceId,
      kind: aiProposals.kind,
      body: aiProposals.body,
      status: aiProposals.status,
    }).from(aiProposals)
      .where(and(eq(aiProposals.workspaceId, workspace.id), eq(aiProposals.projectId, project.id), isNull(aiProposals.deletedAt)))
      .orderBy(desc(aiProposals.createdAt)),
  ]);

  return buildProjectWorkspace({
    project: {
      id: project.id,
      name: project.name,
      clientName: project.clientName,
      status: project.status,
      statusLabel: projectStatusLabels[project.status],
      progressPercent: project.progressPercent,
    },
    contacts: contactRows.map((item) => ({
      id: item.id,
      name: item.name,
      role: item.role,
      detail: item.email ?? item.phone ?? "연락처 없음",
    })),
    tasks: taskRows.map((item) => ({
      id: item.id,
      title: item.title,
      dueDate: item.dueDate,
      status: item.status,
      statusLabel: taskStatusLabels[item.status],
    })),
    quotes: quoteRows,
    contracts: contractRows.map((item) => ({
      contractId: item.contractId,
      versionNumber: item.versionNumber,
      title: item.title,
      statusLabel: contractStatusLabels[item.status],
      totalAmount: item.totalAmount,
    })),
    billings: billingRows.map((item) => ({
      id: item.id,
      kindLabel: billingKindLabels[item.kind],
      amount: item.amount,
      dueDate: item.dueDate,
      statusLabel: billingStatusLabels[item.status],
    })),
    documents: documentRows.map((item) => ({
      documentId: item.documentId,
      versionNumber: item.versionNumber,
      title: item.title,
      kindLabel: vaultDocumentKindLabels[item.kind],
    })),
    evidence: evidenceRows.map((item) => ({
      id: item.id,
      title: item.title,
      kindLabel: rechoEvidenceKindLabels[item.kind],
      occurredOn: item.occurredOn,
      occurredTime: item.occurredTime,
      originalUrl: item.originalUrl,
      linkReason: item.linkReason,
    })),
    proposals: proposalRows.map((item) => ({
      id: item.id,
      evidenceId: item.evidenceId,
      kindLabel: aiProposalKindLabels[item.kind],
      body: item.body,
      status: item.status,
      statusLabel: aiProposalStatusLabels[item.status],
    })),
  });
}
