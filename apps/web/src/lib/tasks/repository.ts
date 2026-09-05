import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { createDatabase } from "@/lib/db/client";
import { aiAgents, auditEvents, clientCompanies, projects, tasks, ventures } from "@/lib/db/schema";
import { assignTaskAgent } from "@/lib/domain/agents";
import { completeTask, groupOpenTasksByDueDate, normalizeTaskDraft, normalizeTaskLink } from "@/lib/domain/tasks";
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

  const ventureRows = await database.select({
    id: ventures.id,
    name: ventures.name,
    kind: ventures.kind,
  }).from(ventures)
    .where(and(eq(ventures.workspaceId, workspace.id), isNull(ventures.deletedAt)))
    .orderBy(asc(ventures.name));

  // 프로젝트·고객사·사업은 이제 전부 왼쪽 조인이다 — 회사 운영·자체 사업 업무는 그 칸이 비어 있다.
  // `isNull(projects.deletedAt)` 같은 조건은 조인이 안 붙어도(전부 NULL) 그대로 통과하니
  // "연결된 프로젝트가 지워졌을 때만" 걸러내는 원래 의도가 유지된다.
  const items = await database.select({
    id: tasks.id,
    kind: tasks.kind,
    projectId: tasks.projectId,
    ventureId: tasks.ventureId,
    title: tasks.title,
    dueDate: tasks.dueDate,
    completionCondition: tasks.completionCondition,
    status: tasks.status,
    assignedAgentId: tasks.assignedAgentId,
    assignedAgentName: aiAgents.name,
    clientName: clientCompanies.name,
    projectName: projects.name,
    ventureName: ventures.name,
  }).from(tasks)
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .leftJoin(clientCompanies, eq(tasks.clientCompanyId, clientCompanies.id))
    .leftJoin(ventures, eq(tasks.ventureId, ventures.id))
    .leftJoin(aiAgents, eq(tasks.assignedAgentId, aiAgents.id))
    .where(and(
      eq(tasks.workspaceId, workspace.id),
      isNull(tasks.deletedAt),
      isNull(projects.deletedAt),
      isNull(clientCompanies.deletedAt),
    ))
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
    ventures: ventureRows,
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
    kind: tasks.kind,
    projectId: tasks.projectId,
    ventureId: tasks.ventureId,
    title: tasks.title,
    dueDate: tasks.dueDate,
    completionCondition: tasks.completionCondition,
    status: tasks.status,
    assignedAgentId: tasks.assignedAgentId,
    assignedAgentName: aiAgents.name,
    completedAt: tasks.completedAt,
    clientName: clientCompanies.name,
    projectName: projects.name,
    ventureName: ventures.name,
  }).from(tasks)
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .leftJoin(clientCompanies, eq(tasks.clientCompanyId, clientCompanies.id))
    .leftJoin(ventures, eq(tasks.ventureId, ventures.id))
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
  kind: string;
  projectId?: string;
  ventureId?: string;
  title: string;
  dueDate: string;
  completionCondition: string;
  assignedAgentId?: string;
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "tasks");
  const database = createDatabase();
  const rawKind = input.kind.trim();

  // 고객사 프로젝트 업무는 clientCompanyId를 사람이 직접 고르지 않는다 — 고른 프로젝트에서 그대로
  // 끌어온다. 그래서 normalizeTaskLink를 부르기 전에 프로젝트(또는 사업)를 먼저 워크스페이스
  // 범위로 조회해 둔다. 다른 워크스페이스의 프로젝트·사업 id는 여기서 걸린다.
  let projectId: string | null = null;
  let clientCompanyId: string | null = null;
  let ventureId: string | null = null;

  if (rawKind === "client") {
    const rawProjectId = input.projectId?.trim() || "";
    const [project] = rawProjectId
      ? await database.select({
        id: projects.id,
        clientCompanyId: projects.clientCompanyId,
      }).from(projects)
        .innerJoin(clientCompanies, eq(projects.clientCompanyId, clientCompanies.id))
        .where(and(
          eq(projects.id, rawProjectId),
          eq(projects.workspaceId, workspace.id),
          isNull(projects.deletedAt),
          isNull(clientCompanies.deletedAt),
        ))
        .limit(1)
      : [];
    if (!project) throw new Error("Project was not found");
    projectId = project.id;
    clientCompanyId = project.clientCompanyId;
  } else if (rawKind === "internal") {
    const rawVentureId = input.ventureId?.trim() || "";
    const [venture] = rawVentureId
      ? await database.select({ id: ventures.id }).from(ventures)
        .where(and(
          eq(ventures.id, rawVentureId),
          eq(ventures.workspaceId, workspace.id),
          isNull(ventures.deletedAt),
        ))
        .limit(1)
      : [];
    if (!venture) throw new Error("Venture was not found");
    ventureId = venture.id;
  }

  // 저장할 모양은 여기 한 곳에서만 확정한다(normalizeTaskLink) — 위에서 구한 값을 다시 그 규칙으로
  // 대조해, 잘못된 유형·연결 조합은 어떤 경로로도 DB까지 가지 못한다.
  const link = normalizeTaskLink({ kind: rawKind, projectId, clientCompanyId, ventureId });

  const draft = normalizeTaskDraft(input);
  const assignment = await resolveTaskAssignment(database, workspace.id, {
    status: "open",
    assignedAgentId: input.assignedAgentId,
    taskProjectId: link.projectId,
  });
  const [created] = await database.insert(tasks).values({
    workspaceId: workspace.id,
    kind: link.kind,
    projectId: link.projectId,
    clientCompanyId: link.clientCompanyId,
    ventureId: link.ventureId,
    assignedAgentId: assignment.assignedAgentId,
    ...draft,
  }).returning({ id: tasks.id });
  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "task.created",
    payload: { taskId: created.id, kind: link.kind, projectId: link.projectId, ventureId: link.ventureId, assignedAgentId: assignment.assignedAgentId },
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
  input: { status: string; assignedAgentId?: string; taskProjectId: string | null },
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
