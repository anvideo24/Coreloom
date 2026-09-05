import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { createDatabase } from "@/lib/db/client";
import { aiProposals, auditEvents, clientCompanies, projects, rechoEvidence } from "@/lib/db/schema";
import { confirmAiProposal, normalizeAiProposalDraft, partitionAiProposals, rejectAiProposal } from "@/lib/domain/ai-proposals";
import { ensureFounderWorkspace } from "@/lib/workspace/founder-workspace";

const proposalSelect = {
  id: aiProposals.id,
  kind: aiProposals.kind,
  body: aiProposals.body,
  status: aiProposals.status,
  projectId: aiProposals.projectId,
  decisionReason: aiProposals.decisionReason,
  decidedAt: aiProposals.decidedAt,
  createdAt: aiProposals.createdAt,
  evidenceId: aiProposals.evidenceId,
  evidenceTitle: rechoEvidence.title,
  evidenceKind: rechoEvidence.kind,
  originalIdentifier: rechoEvidence.originalIdentifier,
  originalUrl: rechoEvidence.originalUrl,
  occurredOn: rechoEvidence.occurredOn,
  occurredTime: rechoEvidence.occurredTime,
  clientName: clientCompanies.name,
  projectName: projects.name,
};

export async function listFounderAiProposals(authUserId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "proposals");
  const database = createDatabase();
  const evidenceRows = await database.select({
    id: rechoEvidence.id,
    title: rechoEvidence.title,
    occurredOn: rechoEvidence.occurredOn,
    clientName: clientCompanies.name,
    projectName: projects.name,
  }).from(rechoEvidence)
    .innerJoin(projects, eq(rechoEvidence.projectId, projects.id))
    .innerJoin(clientCompanies, eq(rechoEvidence.clientCompanyId, clientCompanies.id))
    .where(and(
      eq(rechoEvidence.workspaceId, workspace.id),
      isNull(rechoEvidence.deletedAt),
      isNull(projects.deletedAt),
      isNull(clientCompanies.deletedAt),
    ))
    .orderBy(desc(rechoEvidence.occurredOn), asc(clientCompanies.name), asc(projects.name));

  const items = await database.select(proposalSelect).from(aiProposals)
    .innerJoin(rechoEvidence, eq(aiProposals.evidenceId, rechoEvidence.id))
    .innerJoin(projects, eq(aiProposals.projectId, projects.id))
    .innerJoin(clientCompanies, eq(aiProposals.clientCompanyId, clientCompanies.id))
    .where(and(
      eq(aiProposals.workspaceId, workspace.id),
      isNull(aiProposals.deletedAt),
      isNull(rechoEvidence.deletedAt),
    ))
    .orderBy(desc(aiProposals.createdAt));

  return { evidence: evidenceRows, ...partitionAiProposals(items) };
}

export async function listFounderAiProposalsForEvidence(authUserId: string, evidenceId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "proposals");
  const database = createDatabase();
  return database.select(proposalSelect).from(aiProposals)
    .innerJoin(rechoEvidence, eq(aiProposals.evidenceId, rechoEvidence.id))
    .innerJoin(projects, eq(aiProposals.projectId, projects.id))
    .innerJoin(clientCompanies, eq(aiProposals.clientCompanyId, clientCompanies.id))
    .where(and(
      eq(aiProposals.workspaceId, workspace.id),
      eq(aiProposals.evidenceId, evidenceId),
      isNull(aiProposals.deletedAt),
      isNull(rechoEvidence.deletedAt),
    ))
    .orderBy(desc(aiProposals.createdAt));
}

export async function getFounderAiProposalDetail(authUserId: string, proposalId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "proposals");
  const database = createDatabase();
  const [proposal] = await database.select(proposalSelect).from(aiProposals)
    .innerJoin(rechoEvidence, eq(aiProposals.evidenceId, rechoEvidence.id))
    .innerJoin(projects, eq(aiProposals.projectId, projects.id))
    .innerJoin(clientCompanies, eq(aiProposals.clientCompanyId, clientCompanies.id))
    .where(and(
      eq(aiProposals.id, proposalId),
      eq(aiProposals.workspaceId, workspace.id),
      isNull(aiProposals.deletedAt),
    ))
    .limit(1);
  return proposal ?? null;
}

export async function createFounderAiProposal(input: {
  actorUserId: string;
  evidenceId: string;
  kind: string;
  body: string;
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "proposals");
  const database = createDatabase();
  const draft = normalizeAiProposalDraft(input);
  const [evidence] = await database.select({
    id: rechoEvidence.id,
    projectId: rechoEvidence.projectId,
    clientCompanyId: rechoEvidence.clientCompanyId,
  }).from(rechoEvidence)
    .innerJoin(projects, eq(rechoEvidence.projectId, projects.id))
    .innerJoin(clientCompanies, eq(rechoEvidence.clientCompanyId, clientCompanies.id))
    .where(and(
      eq(rechoEvidence.id, draft.evidenceId),
      eq(rechoEvidence.workspaceId, workspace.id),
      isNull(rechoEvidence.deletedAt),
      isNull(projects.deletedAt),
      isNull(clientCompanies.deletedAt),
    ))
    .limit(1);
  if (!evidence) throw new Error("Evidence was not found");

  const [created] = await database.insert(aiProposals).values({
    workspaceId: workspace.id,
    projectId: evidence.projectId,
    clientCompanyId: evidence.clientCompanyId,
    evidenceId: evidence.id,
    kind: draft.kind,
    body: draft.body,
  }).returning({ id: aiProposals.id });

  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "ai_proposal.created",
    payload: { aiProposalId: created.id, evidenceId: evidence.id, kind: draft.kind },
  });

  return { proposalId: created.id };
}

export async function confirmFounderAiProposal(input: { actorUserId: string; proposalId: string; approved: boolean }) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "proposals");
  const database = createDatabase();
  const [proposal] = await database.select().from(aiProposals)
    .where(and(eq(aiProposals.id, input.proposalId), eq(aiProposals.workspaceId, workspace.id), isNull(aiProposals.deletedAt)))
    .limit(1);
  if (!proposal) throw new Error("Proposal was not found");
  const update = confirmAiProposal({ status: proposal.status, approved: input.approved });
  await database.update(aiProposals).set({
    ...update,
    decidedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(aiProposals.id, proposal.id));
  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "ai_proposal.confirmed",
    payload: { aiProposalId: proposal.id, evidenceId: proposal.evidenceId },
  });
  return { proposalId: proposal.id, evidenceId: proposal.evidenceId };
}

export async function rejectFounderAiProposal(input: {
  actorUserId: string;
  proposalId: string;
  approved: boolean;
  reason: string;
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "proposals");
  const database = createDatabase();
  const [proposal] = await database.select().from(aiProposals)
    .where(and(eq(aiProposals.id, input.proposalId), eq(aiProposals.workspaceId, workspace.id), isNull(aiProposals.deletedAt)))
    .limit(1);
  if (!proposal) throw new Error("Proposal was not found");
  const update = rejectAiProposal({ status: proposal.status, approved: input.approved, reason: input.reason });
  await database.update(aiProposals).set({
    ...update,
    decidedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(aiProposals.id, proposal.id));
  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "ai_proposal.rejected",
    payload: { aiProposalId: proposal.id, evidenceId: proposal.evidenceId },
  });
  return { proposalId: proposal.id, evidenceId: proposal.evidenceId };
}
