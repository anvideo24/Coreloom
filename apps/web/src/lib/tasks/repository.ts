import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { createDatabase } from "@/lib/db/client";
import { aiAgents, auditEvents, clientCompanies, projects, tasks } from "@/lib/db/schema";
import { assignTaskAgent } from "@/lib/domain/agents";
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
    assignedAgentId: tasks.assignedAgentId,
    assignedAgentName: aiAgents.name,
    clientName: clientCompanies.name,
    projectName: projects.name,
  }).from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .innerJoin(clientCompanies, eq(tasks.clientCompanyId, clientCompanies.id))
    .leftJoin(aiAgents, eq(tasks.assignedAgentId, aiAgents.id))
    .where(and(eq(tasks.workspaceId, workspace.id), isNull(tasks.deletedAt), isNull(projects.deletedAt), isNull(clientCompanies.deletedAt)))
    .orderBy(asc(tasks.dueDate), desc(tasks.createdAt));

  const agentRows = await database.select({
    id: aiAgents.id,
    name: aiAgents.name,
    status: aiAgents.status,
    projectId: aiAgents.projectId,
    ventureId: aiAgents.ventureId,
    projectName: projects.name,
    clientName: clientCompanies.name,
  }).from(aiAgents)
    .leftJoin(projects, eq(aiAgents.projectId, projects.id))
    .leftJoin(clientCompanies, eq(projects.clientCompanyId, clientCompanies.id))
    .where(and(eq(aiAgents.workspaceId, workspace.id), isNull(aiAgents.deletedAt)))
    .orderBy(asc(aiAgents.name));

  return {
    projects: projectRows,
    agents: agentRows.filter((agent) => agent.status === "active" && !agent.ventureId),
    tasks: items,
    schedule: groupOpenTasksByDueDate(items),
  };
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
    assignedAgentId: tasks.assignedAgentId,
    assignedAgentName: aiAgents.name,
    completedAt: tasks.completedAt,
    clientName: clientCompanies.name,
    projectName: projects.name,
  }).from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .innerJoin(clientCompanies, eq(tasks.clientCompanyId, clientCompanies.id))
    .leftJoin(aiAgents, eq(tasks.assignedAgentId, aiAgents.id))
    .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, workspace.id), isNull(tasks.deletedAt)))
    .limit(1);
  if (!task) return null;

  const agentRows = await database.select({
    id: aiAgents.id,
    name: aiAgents.name,
    status: aiAgents.status,
    projectId: aiAgents.projectId,
    ventureId: aiAgents.ventureId,
    projectName: projects.name,
    clientName: clientCompanies.name,
  }).from(aiAgents)
    .leftJoin(projects, eq(aiAgents.projectId, projects.id))
    .leftJoin(clientCompanies, eq(projects.clientCompanyId, clientCompanies.id))
    .where(and(
      eq(aiAgents.workspaceId, workspace.id),
      eq(aiAgents.status, "active"),
      isNull(aiAgents.deletedAt),
    ))
    .orderBy(asc(aiAgents.name));

  return {
    ...task,
    assignableAgents: agentRows.filter((agent) => !agent.ventureId && (!agent.projectId || agent.projectId === task.projectId)),
  };
}

export async function createFounderTask(input: {
  actorUserId: string;
  projectId: string;
  title: string;
  dueDate: string;
  completionCondition: string;
  assignedAgentId?: string;
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
  const assignment = await resolveTaskAssignment(database, workspace.id, {
    status: "open",
    assignedAgentId: input.assignedAgentId,
    taskProjectId: project.id,
  });
  const [created] = await database.insert(tasks).values({
    workspaceId: workspace.id,
    projectId: project.id,
    clientCompanyId: project.clientCompanyId,
    assignedAgentId: assignment.assignedAgentId,
    ...draft,
  }).returning({ id: tasks.id });
  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "task.created",
    payload: { taskId: created.id, projectId: project.id, assignedAgentId: assignment.assignedAgentId },
  });
  if (assignment.assignedAgentId) {
    await database.insert(auditEvents).values({
      workspaceId: workspace.id,
      actorUserId: input.actorUserId,
      eventType: "task.assigned",
      payload: { taskId: created.id, agentId: assignment.assignedAgentId },
    });
  }
  return { taskId: created.id };
}

export async function assignFounderTaskAgent(input: {
  actorUserId: string;
  taskId: string;
  assignedAgentId?: string;
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "tasks");
  const database = createDatabase();
  const [task] = await database.select().from(tasks)
    .where(and(eq(tasks.id, input.taskId), eq(tasks.workspaceId, workspace.id), isNull(tasks.deletedAt)))
    .limit(1);
  if (!task) throw new Error("Task was not found");
  const assignment = await resolveTaskAssignment(database, workspace.id, {
    status: task.status,
    assignedAgentId: input.assignedAgentId,
    taskProjectId: task.projectId,
  });
  await database.update(tasks).set({
    assignedAgentId: assignment.assignedAgentId,
    updatedAt: new Date(),
  }).where(eq(tasks.id, task.id));
  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "task.assigned",
    payload: { taskId: task.id, agentId: assignment.assignedAgentId },
  });
  return { taskId: task.id };
}

async function resolveTaskAssignment(
  database: ReturnType<typeof createDatabase>,
  workspaceId: string,
  input: { status: string; assignedAgentId?: string; taskProjectId: string },
) {
  const assignedAgentId = input.assignedAgentId?.trim() || null;
  if (!assignedAgentId) {
    return assignTaskAgent({ status: input.status, assignedAgentId: null, taskProjectId: input.taskProjectId });
  }
  const [agent] = await database.select({
    id: aiAgents.id,
    status: aiAgents.status,
    projectId: aiAgents.projectId,
    ventureId: aiAgents.ventureId,
  }).from(aiAgents)
    .where(and(eq(aiAgents.id, assignedAgentId), eq(aiAgents.workspaceId, workspaceId), isNull(aiAgents.deletedAt)))
    .limit(1);
  if (!agent) throw new Error("Agent was not found");
  return assignTaskAgent({
    status: input.status,
    assignedAgentId: agent.id,
    agentStatus: agent.status,
    agentProjectId: agent.projectId,
    agentVentureId: agent.ventureId,
    taskProjectId: input.taskProjectId,
  });
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
