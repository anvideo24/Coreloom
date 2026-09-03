import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { createDatabase } from "@/lib/db/client";
import { aiAgentWorkLogs, aiAgents, auditEvents, clientCompanies, projects, tasks, ventures } from "@/lib/db/schema";
import {
  agentAccessLabel,
  approveAiAgentWork,
  assertAgentCanRecordWork,
  deactivateAiAgent,
  normalizeAiAgentDraft,
  normalizeAiAgentWorkLog,
  partitionAgentWorkLogs,
  rejectAiAgentWork,
} from "@/lib/domain/agents";
import { ensureFounderWorkspace } from "@/lib/workspace/founder-workspace";

function asAllowedWork(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

async function requireProject(database: ReturnType<typeof createDatabase>, workspaceId: string, projectId: string) {
  const [project] = await database.select({
    id: projects.id,
    name: projects.name,
    clientName: clientCompanies.name,
  }).from(projects)
    .innerJoin(clientCompanies, eq(projects.clientCompanyId, clientCompanies.id))
    .where(and(
      eq(projects.id, projectId),
      eq(projects.workspaceId, workspaceId),
      isNull(projects.deletedAt),
      isNull(clientCompanies.deletedAt),
    ))
    .limit(1);
  if (!project) throw new Error("Project was not found");
  return project;
}

async function requireVenture(database: ReturnType<typeof createDatabase>, workspaceId: string, ventureId: string) {
  const [venture] = await database.select({ id: ventures.id, name: ventures.name }).from(ventures)
    .where(and(eq(ventures.id, ventureId), eq(ventures.workspaceId, workspaceId), isNull(ventures.deletedAt)))
    .limit(1);
  if (!venture) throw new Error("Venture was not found");
  return venture;
}

export async function listFounderAgents(authUserId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "agents");
  const database = createDatabase();
  const [projectRows, ventureRows, agentRows] = await Promise.all([
    database.select({
      id: projects.id,
      name: projects.name,
      clientName: clientCompanies.name,
    }).from(projects)
      .innerJoin(clientCompanies, eq(projects.clientCompanyId, clientCompanies.id))
      .where(and(eq(projects.workspaceId, workspace.id), isNull(projects.deletedAt), isNull(clientCompanies.deletedAt)))
      .orderBy(asc(clientCompanies.name), asc(projects.name)),
    database.select({
      id: ventures.id,
      name: ventures.name,
      kind: ventures.kind,
    }).from(ventures)
      .where(and(eq(ventures.workspaceId, workspace.id), isNull(ventures.deletedAt)))
      .orderBy(asc(ventures.name)),
    database.select({
      id: aiAgents.id,
      name: aiAgents.name,
      purpose: aiAgents.purpose,
      allowedWork: aiAgents.allowedWork,
      accessScope: aiAgents.accessScope,
      projectId: aiAgents.projectId,
      ventureId: aiAgents.ventureId,
      status: aiAgents.status,
      projectName: projects.name,
      clientName: clientCompanies.name,
      ventureName: ventures.name,
    }).from(aiAgents)
      .leftJoin(projects, eq(aiAgents.projectId, projects.id))
      .leftJoin(clientCompanies, eq(projects.clientCompanyId, clientCompanies.id))
      .leftJoin(ventures, eq(aiAgents.ventureId, ventures.id))
      .where(and(eq(aiAgents.workspaceId, workspace.id), isNull(aiAgents.deletedAt)))
      .orderBy(asc(aiAgents.status), asc(aiAgents.name)),
  ]);

  return {
    projects: projectRows,
    ventures: ventureRows,
    agents: agentRows.map((agent) => ({
      ...agent,
      allowedWork: asAllowedWork(agent.allowedWork),
      scopeLabel: agentAccessLabel({
        accessScope: agent.accessScope,
        projectName: agent.projectName,
        clientName: agent.clientName,
        ventureName: agent.ventureName,
      }),
    })),
  };
}

export async function getFounderAgentDetail(authUserId: string, agentId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "agents");
  const database = createDatabase();
  const [agent] = await database.select({
    id: aiAgents.id,
    name: aiAgents.name,
    purpose: aiAgents.purpose,
    allowedWork: aiAgents.allowedWork,
    accessScope: aiAgents.accessScope,
    projectId: aiAgents.projectId,
    ventureId: aiAgents.ventureId,
    status: aiAgents.status,
    projectName: projects.name,
    clientName: clientCompanies.name,
    ventureName: ventures.name,
  }).from(aiAgents)
    .leftJoin(projects, eq(aiAgents.projectId, projects.id))
    .leftJoin(clientCompanies, eq(projects.clientCompanyId, clientCompanies.id))
    .leftJoin(ventures, eq(aiAgents.ventureId, ventures.id))
    .where(and(eq(aiAgents.id, agentId), eq(aiAgents.workspaceId, workspace.id), isNull(aiAgents.deletedAt)))
    .limit(1);
  if (!agent) return null;

  const [workRows, assignedTaskRows, openTaskRows] = await Promise.all([
    database.select({
      id: aiAgentWorkLogs.id,
      taskId: aiAgentWorkLogs.taskId,
      requestNote: aiAgentWorkLogs.requestNote,
      inputNote: aiAgentWorkLogs.inputNote,
      resultNote: aiAgentWorkLogs.resultNote,
      status: aiAgentWorkLogs.status,
      decisionReason: aiAgentWorkLogs.decisionReason,
      decidedAt: aiAgentWorkLogs.decidedAt,
      createdAt: aiAgentWorkLogs.createdAt,
      taskTitle: tasks.title,
    }).from(aiAgentWorkLogs)
      .leftJoin(tasks, eq(aiAgentWorkLogs.taskId, tasks.id))
      .where(and(eq(aiAgentWorkLogs.agentId, agent.id), eq(aiAgentWorkLogs.workspaceId, workspace.id)))
      .orderBy(desc(aiAgentWorkLogs.createdAt)),
    database.select({
      id: tasks.id,
      title: tasks.title,
      dueDate: tasks.dueDate,
      status: tasks.status,
    }).from(tasks)
      .where(and(
        eq(tasks.workspaceId, workspace.id),
        eq(tasks.assignedAgentId, agent.id),
        isNull(tasks.deletedAt),
      ))
      .orderBy(asc(tasks.dueDate)),
    database.select({
      id: tasks.id,
      title: tasks.title,
      projectId: tasks.projectId,
      projectName: projects.name,
      clientName: clientCompanies.name,
    }).from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .innerJoin(clientCompanies, eq(tasks.clientCompanyId, clientCompanies.id))
      .where(and(
        eq(tasks.workspaceId, workspace.id),
        eq(tasks.status, "open"),
        isNull(tasks.deletedAt),
        isNull(projects.deletedAt),
      ))
      .orderBy(asc(clientCompanies.name), asc(projects.name), asc(tasks.title)),
  ]);

  const allowedWork = asAllowedWork(agent.allowedWork);
  return {
    ...agent,
    allowedWork,
    scopeLabel: agentAccessLabel({
      accessScope: agent.accessScope,
      projectName: agent.projectName,
      clientName: agent.clientName,
      ventureName: agent.ventureName,
    }),
    assignedTasks: assignedTaskRows,
    openTasks: openTaskRows.filter((task) => {
      if (agent.ventureId) return false;
      if (agent.projectId && agent.projectId !== task.projectId) return false;
      return true;
    }),
    work: partitionAgentWorkLogs(workRows),
  };
}

export async function createFounderAgent(input: {
  actorUserId: string;
  name: string;
  purpose: string;
  allowedWork: string[];
  accessScope: string;
  projectId?: string;
  ventureId?: string;
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "agents");
  const database = createDatabase();
  const draft = normalizeAiAgentDraft(input);
  if (draft.projectId) await requireProject(database, workspace.id, draft.projectId);
  if (draft.ventureId) await requireVenture(database, workspace.id, draft.ventureId);

  const [duplicate] = await database.select({ id: aiAgents.id }).from(aiAgents)
    .where(and(eq(aiAgents.workspaceId, workspace.id), eq(aiAgents.name, draft.name), isNull(aiAgents.deletedAt)))
    .limit(1);
  if (duplicate) throw new Error("Agent name is already used");

  const [created] = await database.insert(aiAgents).values({
    workspaceId: workspace.id,
    ...draft,
  }).returning({ id: aiAgents.id });
  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "ai_agent.created",
    payload: { agentId: created.id, projectId: draft.projectId, ventureId: draft.ventureId },
  });
  return { agentId: created.id };
}

export async function deactivateFounderAgent(input: { actorUserId: string; agentId: string }) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "agents");
  const database = createDatabase();
  const [agent] = await database.select().from(aiAgents)
    .where(and(eq(aiAgents.id, input.agentId), eq(aiAgents.workspaceId, workspace.id), isNull(aiAgents.deletedAt)))
    .limit(1);
  if (!agent) throw new Error("Agent was not found");
  const update = deactivateAiAgent({ status: agent.status });
  await database.update(aiAgents).set({ ...update, updatedAt: new Date() }).where(eq(aiAgents.id, agent.id));
  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "ai_agent.deactivated",
    payload: { agentId: agent.id },
  });
  return { agentId: agent.id };
}

export async function recordFounderAgentWork(input: {
  actorUserId: string;
  agentId: string;
  requestNote: string;
  inputNote: string;
  resultNote?: string;
  taskId?: string;
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "agents");
  const database = createDatabase();
  const [agent] = await database.select().from(aiAgents)
    .where(and(eq(aiAgents.id, input.agentId), eq(aiAgents.workspaceId, workspace.id), isNull(aiAgents.deletedAt)))
    .limit(1);
  if (!agent) throw new Error("Agent was not found");
  const draft = normalizeAiAgentWorkLog(input);

  let taskProjectId: string | null = null;
  if (draft.taskId) {
    const [task] = await database.select({
      id: tasks.id,
      projectId: tasks.projectId,
    }).from(tasks)
      .where(and(eq(tasks.id, draft.taskId), eq(tasks.workspaceId, workspace.id), isNull(tasks.deletedAt)))
      .limit(1);
    if (!task) throw new Error("Task was not found");
    taskProjectId = task.projectId;
  }

  assertAgentCanRecordWork({
    agentStatus: agent.status,
    agentProjectId: agent.projectId,
    agentVentureId: agent.ventureId,
    taskProjectId,
  });

  const [created] = await database.insert(aiAgentWorkLogs).values({
    workspaceId: workspace.id,
    agentId: agent.id,
    recordedByUserId: input.actorUserId,
    ...draft,
  }).returning({ id: aiAgentWorkLogs.id });
  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "ai_agent.work_recorded",
    payload: { workLogId: created.id, agentId: agent.id, taskId: draft.taskId },
  });
  return { workLogId: created.id, agentId: agent.id };
}

export async function approveFounderAgentWork(input: {
  actorUserId: string;
  workLogId: string;
  approved: boolean;
  resultNote?: string;
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "agents");
  const database = createDatabase();
  const [work] = await database.select().from(aiAgentWorkLogs)
    .where(and(eq(aiAgentWorkLogs.id, input.workLogId), eq(aiAgentWorkLogs.workspaceId, workspace.id)))
    .limit(1);
  if (!work) throw new Error("Agent work was not found");
  const update = approveAiAgentWork({
    status: work.status,
    approved: input.approved,
    resultNote: input.resultNote || work.resultNote,
  });
  await database.update(aiAgentWorkLogs).set({
    ...update,
    decidedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(aiAgentWorkLogs.id, work.id));
  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "ai_agent.work_decided",
    payload: { workLogId: work.id, agentId: work.agentId, status: update.status },
  });
  return { workLogId: work.id, agentId: work.agentId };
}

export async function rejectFounderAgentWork(input: {
  actorUserId: string;
  workLogId: string;
  approved: boolean;
  reason: string;
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "agents");
  const database = createDatabase();
  const [work] = await database.select().from(aiAgentWorkLogs)
    .where(and(eq(aiAgentWorkLogs.id, input.workLogId), eq(aiAgentWorkLogs.workspaceId, workspace.id)))
    .limit(1);
  if (!work) throw new Error("Agent work was not found");
  const update = rejectAiAgentWork({
    status: work.status,
    approved: input.approved,
    reason: input.reason,
  });
  await database.update(aiAgentWorkLogs).set({
    ...update,
    decidedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(aiAgentWorkLogs.id, work.id));
  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "ai_agent.work_decided",
    payload: { workLogId: work.id, agentId: work.agentId, status: update.status },
  });
  return { workLogId: work.id, agentId: work.agentId };
}
