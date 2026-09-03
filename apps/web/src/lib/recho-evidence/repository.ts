import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { createDatabase } from "@/lib/db/client";
import { auditEvents, clientCompanies, projects, rechoEvidence } from "@/lib/db/schema";
import { groupEvidenceByOccurredDate, normalizeRechoEvidenceLink } from "@/lib/domain/recho-evidence";
import { ensureFounderWorkspace } from "@/lib/workspace/founder-workspace";

export async function listFounderRechoEvidence(authUserId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "timeline");
  const database = createDatabase();
  const projectRows = await database.select({
    id: projects.id,
    name: projects.name,
    clientName: clientCompanies.name,
  }).from(projects)
    .innerJoin(clientCompanies, eq(projects.clientCompanyId, clientCompanies.id))
    .where(and(eq(projects.workspaceId, workspace.id), isNull(projects.deletedAt), isNull(clientCompanies.deletedAt)))
    .orderBy(asc(clientCompanies.name), asc(projects.name));

  const items = await database.select({
    id: rechoEvidence.id,
    kind: rechoEvidence.kind,
    title: rechoEvidence.title,
    originalIdentifier: rechoEvidence.originalIdentifier,
    originalUrl: rechoEvidence.originalUrl,
    occurredOn: rechoEvidence.occurredOn,
    occurredTime: rechoEvidence.occurredTime,
    linkReason: rechoEvidence.linkReason,
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
    .orderBy(desc(rechoEvidence.occurredOn), desc(rechoEvidence.occurredTime), desc(rechoEvidence.createdAt));

  return { projects: projectRows, records: items, timeline: groupEvidenceByOccurredDate(items) };
}

export async function getFounderRechoEvidenceDetail(authUserId: string, recordId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "timeline");
  const database = createDatabase();
  const [record] = await database.select({
    id: rechoEvidence.id,
    kind: rechoEvidence.kind,
    title: rechoEvidence.title,
    originalIdentifier: rechoEvidence.originalIdentifier,
    originalUrl: rechoEvidence.originalUrl,
    occurredOn: rechoEvidence.occurredOn,
    occurredTime: rechoEvidence.occurredTime,
    linkReason: rechoEvidence.linkReason,
    clientName: clientCompanies.name,
    projectName: projects.name,
  }).from(rechoEvidence)
    .innerJoin(projects, eq(rechoEvidence.projectId, projects.id))
    .innerJoin(clientCompanies, eq(rechoEvidence.clientCompanyId, clientCompanies.id))
    .where(and(
      eq(rechoEvidence.id, recordId),
      eq(rechoEvidence.workspaceId, workspace.id),
      isNull(rechoEvidence.deletedAt),
    ))
    .limit(1);
  return record ?? null;
}

export async function linkFounderRechoEvidence(input: {
  actorUserId: string;
  projectId: string;
  kind: string;
  title: string;
  originalIdentifier: string;
  originalUrl?: string;
  occurredOn: string;
  occurredTime: string;
  linkReason: string;
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "timeline");
  const database = createDatabase();
  const evidence = normalizeRechoEvidenceLink(input);
  const [project] = await database.select({
    id: projects.id,
    clientCompanyId: projects.clientCompanyId,
  }).from(projects)
    .innerJoin(clientCompanies, eq(projects.clientCompanyId, clientCompanies.id))
    .where(and(
      eq(projects.id, evidence.projectId),
      eq(projects.workspaceId, workspace.id),
      isNull(projects.deletedAt),
      isNull(clientCompanies.deletedAt),
    ))
    .limit(1);
  if (!project) throw new Error("Project was not found");

  const [existing] = await database.select({ id: rechoEvidence.id }).from(rechoEvidence)
    .where(and(
      eq(rechoEvidence.workspaceId, workspace.id),
      eq(rechoEvidence.projectId, project.id),
      eq(rechoEvidence.originalIdentifier, evidence.originalIdentifier),
      isNull(rechoEvidence.deletedAt),
    ))
    .limit(1);
  if (existing) throw new Error("This Recho record is already linked to the project");

  const [created] = await database.insert(rechoEvidence).values({
    workspaceId: workspace.id,
    projectId: project.id,
    clientCompanyId: project.clientCompanyId,
    kind: evidence.kind,
    title: evidence.title,
    originalIdentifier: evidence.originalIdentifier,
    originalUrl: evidence.originalUrl,
    occurredOn: evidence.occurredOn,
    occurredTime: evidence.occurredTime,
    linkReason: evidence.linkReason,
  }).returning({ id: rechoEvidence.id });

  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "recho_evidence.linked",
    payload: {
      rechoEvidenceId: created.id,
      projectId: project.id,
      originalIdentifier: evidence.originalIdentifier,
    },
  });

  return { recordId: created.id };
}
