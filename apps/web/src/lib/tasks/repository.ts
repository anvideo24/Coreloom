import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { createDatabase } from "@/lib/db/client";
import { auditEvents, clientCompanies, projects, tasks } from "@/lib/db/schema";
import { completeTask, groupOpenTasksByDueDate, normalizeTaskDraft } from "@/lib/domain/tasks";
import { ensureFounderWorkspace } from "@/lib/workspace/founder-workspace";

export async function listFounderTasks(authUserId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "tasks");
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
    id: tasks.id,
    projectId: tasks.projectId,
    title: tasks.title,
    dueDate: tasks.dueDate,
    completionCondition: tasks.completionCondition,
    status: tasks.status,
    clientName: clientCompanies.name,
    projectName: projects.name,
  }).from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .innerJoin(clientCompanies, eq(tasks.clientCompanyId, clientCompanies.id))
    .where(and(eq(tasks.workspaceId, workspace.id), isNull(tasks.deletedAt), isNull(projects.deletedAt), isNull(clientCompanies.deletedAt)))
    .orderBy(asc(tasks.dueDate), desc(tasks.createdAt));

  return { projects: projectRows, tasks: items, schedule: groupOpenTasksByDueDate(items) };
}

export async function getFounderTaskDetail(authUserId: string, taskId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "tasks");
  const database = createDatabase();
  const [task] = await database.select({
    id: tasks.id,
    projectId: tasks.projectId,
    title: tasks.title,
    dueDate: tasks.dueDate,
    completionCondition: tasks.completionCondition,
    status: tasks.status,
    completedAt: tasks.completedAt,
    clientName: clientCompanies.name,
    projectName: projects.name,
  }).from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .innerJoin(clientCompanies, eq(tasks.clientCompanyId, clientCompanies.id))
    .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, workspace.id), isNull(tasks.deletedAt)))
    .limit(1);
  return task ?? null;
}

export async function createFounderTask(input: {
  actorUserId: string;
  projectId: string;
  title: string;
  dueDate: string;
  completionCondition: string;
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "tasks");
  const database = createDatabase();
  const [project] = await database.select({
    id: projects.id,
    clientCompanyId: projects.clientCompanyId,
  }).from(projects)
    .innerJoin(clientCompanies, eq(projects.clientCompanyId, clientCompanies.id))
    .where(and(
      eq(projects.id, input.projectId),
      eq(projects.workspaceId, workspace.id),
      isNull(projects.deletedAt),
      isNull(clientCompanies.deletedAt),
    ))
    .limit(1);
  if (!project) throw new Error("Project was not found");
  const draft = normalizeTaskDraft(input);
  const [created] = await database.insert(tasks).values({
    workspaceId: workspace.id,
    projectId: project.id,
    clientCompanyId: project.clientCompanyId,
    ...draft,
  }).returning({ id: tasks.id });
  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "task.created",
    payload: { taskId: created.id, projectId: project.id },
  });
  return { taskId: created.id };
}

export async function completeFounderTask(input: { actorUserId: string; taskId: string; approved: boolean }) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "tasks");
  const database = createDatabase();
  const [task] = await database.select().from(tasks)
    .where(and(eq(tasks.id, input.taskId), eq(tasks.workspaceId, workspace.id), isNull(tasks.deletedAt)))
    .limit(1);
  if (!task) throw new Error("Task was not found");
  const update = completeTask({ status: task.status, approved: input.approved });
  await database.update(tasks).set({ ...update, completedAt: new Date(), updatedAt: new Date() }).where(eq(tasks.id, task.id));
  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "task.completed",
    payload: { taskId: task.id, projectId: task.projectId },
  });
  return { taskId: task.id };
}
