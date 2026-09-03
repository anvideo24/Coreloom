import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { createDatabase } from "@/lib/db/client";
import { auditEvents, clientCompanies, projects } from "@/lib/db/schema";
import { normalizeClientName, normalizeProjectProgressUpdate, normalizeProjectRegistration } from "@/lib/domain/clients-projects";
import { ensureFounderWorkspace } from "@/lib/workspace/founder-workspace";

export async function listFounderClientsAndProjects(authUserId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "clients-projects");
  const database = createDatabase();
  const clients = await database
    .select({ id: clientCompanies.id, name: clientCompanies.name })
    .from(clientCompanies)
    .where(and(eq(clientCompanies.workspaceId, workspace.id), isNull(clientCompanies.deletedAt)))
    .orderBy(asc(clientCompanies.name));
  const projectRows = await database
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      progressPercent: projects.progressPercent,
      clientName: clientCompanies.name,
    })
    .from(projects)
    .innerJoin(clientCompanies, eq(projects.clientCompanyId, clientCompanies.id))
    .where(and(
      eq(projects.workspaceId, workspace.id),
      isNull(projects.deletedAt),
      isNull(clientCompanies.deletedAt),
    ))
    .orderBy(desc(projects.updatedAt));

  return { clients, projects: projectRows };
}

export async function createFounderClient(input: { actorUserId: string; name: string }) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "clients-projects");
  const database = createDatabase();
  const name = normalizeClientName(input.name);
  const [created] = await database
    .insert(clientCompanies)
    .values({ workspaceId: workspace.id, name })
    .onConflictDoNothing()
    .returning({ id: clientCompanies.id });

  if (created) {
    await database.insert(auditEvents).values({
      workspaceId: workspace.id,
      actorUserId: input.actorUserId,
      eventType: "client_company.created",
      payload: { clientCompanyId: created.id },
    });
  }
}

export async function createFounderProject(input: {
  actorUserId: string;
  clientId: string;
  name: string;
  status: string;
  progressPercent: string;
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "clients-projects");
  const database = createDatabase();
  const project = normalizeProjectRegistration(input);
  const [client] = await database
    .select({ id: clientCompanies.id })
    .from(clientCompanies)
    .where(and(
      eq(clientCompanies.id, project.clientId),
      eq(clientCompanies.workspaceId, workspace.id),
      isNull(clientCompanies.deletedAt),
    ))
    .limit(1);

  if (!client) throw new Error("Client was not found");

  const [created] = await database
    .insert(projects)
    .values({
      workspaceId: workspace.id,
      clientCompanyId: client.id,
      name: project.name,
      status: project.status,
      progressPercent: project.progressPercent,
    })
    .returning({ id: projects.id });

  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "project.created",
    payload: { projectId: created.id, clientCompanyId: client.id },
  });
}

export async function updateFounderProjectProgress(input: {
  actorUserId: string;
  projectId: string;
  status: string;
  progressPercent: string;
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "clients-projects");
  const database = createDatabase();
  const update = normalizeProjectProgressUpdate(input);
  const [project] = await database
    .select({ id: projects.id })
    .from(projects)
    .where(and(
      eq(projects.id, update.projectId),
      eq(projects.workspaceId, workspace.id),
      isNull(projects.deletedAt),
    ))
    .limit(1);

  if (!project) throw new Error("Project was not found");

  const [saved] = await database
    .update(projects)
    .set({ status: update.status, progressPercent: update.progressPercent, updatedAt: new Date() })
    .where(eq(projects.id, project.id))
    .returning();

  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "project.progress_updated",
    payload: { projectId: project.id, status: update.status, progressPercent: update.progressPercent },
  });

  return saved;
}
