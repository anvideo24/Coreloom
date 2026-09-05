"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  approveFounderAgentWork,
  createFounderAgent,
  deactivateFounderAgent,
  invokeFounderAgentFromPanel,
  recordFounderAgentWork,
  rejectFounderAgentWork,
} from "@/lib/agents/repository";
import { founderSession } from "@/lib/auth/session";
import { chatAgent } from "@/lib/agents/chat-repository";
import { aiAgents, auditEvents } from "@/lib/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { accessLabels, accessPolicy } from "@/lib/domain/agent-access";
import { readAgentRoots, saveAgentRoots } from "@/lib/agents/access-store";

export async function readAgentAccessAction(agentId: string) {
  const founder = await requireFounder();
  const { db, agent, workspace } = await chatAgent(founder.id, z.string().uuid().parse(agentId));
  const recent = await db.select({ payload: auditEvents.payload, at: auditEvents.createdAt }).from(auditEvents).where(and(eq(auditEvents.workspaceId, workspace.id), eq(auditEvents.eventType, "ai_agent.read"), sql`${auditEvents.payload}->>'agentId' = ${agent.id}`)).orderBy(desc(auditEvents.createdAt)).limit(10);
  return { permissions: accessPolicy(agent.capabilities), roots: await readAgentRoots(workspace.id, agent.id), recent: recent.map((r) => ({ ...r, at: r.at.toISOString() })) };
}

export async function saveAgentAccessAction(agentId: string, input: { permissions: Record<string, boolean>; roots: string[] }) {
  const founder = await requireFounder();
  const data = z.object({ permissions: z.record(z.string(), z.boolean()).refine((p) => Object.keys(p).every((key) => key in accessLabels)), roots: z.array(z.string().trim().min(1).max(500)).max(8) }).strict().parse(input);
  const { db, agent, workspace } = await chatAgent(founder.id, z.string().uuid().parse(agentId));
  const permissions = accessPolicy(data.permissions);
  if (permissions.read_pc && !data.roots.length) throw new Error("PC 조회를 켜려면 허용 폴더를 지정하세요.");
  // Disable PC reads first: if filesystem validation or save fails, fail closed.
  await db.update(aiAgents).set({ capabilities: { ...agent.capabilities, read_pc: false }, updatedAt: new Date() }).where(eq(aiAgents.id, agent.id));
  await saveAgentRoots(workspace.id, agent.id, data.roots);
  await db.insert(auditEvents).values({ workspaceId: workspace.id, actorUserId: founder.id, eventType: "ai_agent.access_updated", payload: { agentId: agent.id, permissions, rootCount: data.roots.length } });
  await db.update(aiAgents).set({ capabilities: { ...agent.capabilities, ...permissions }, updatedAt: new Date() }).where(eq(aiAgents.id, agent.id));
  revalidatePath("/", "layout");
  return { saved: true };
}

export async function readAgentSettingsAction(agentId: string) {
  const founder = await requireFounder();
  const { agent } = await chatAgent(founder.id, z.string().uuid().parse(agentId));
  return { workStyle: agent.workStyle || "", answerStyle: agent.answerStyle || "", procedure: agent.procedure || "", instructions: agent.instructions || "", modelProvider: agent.modelProvider };
}

export async function saveAgentSettingsAction(agentId: string, input: { workStyle: string; answerStyle: string; procedure: string; instructions: string; modelProvider: string }) {
  const founder = await requireFounder();
  const data = z.object({ workStyle: z.string().trim().max(2000), answerStyle: z.string().trim().max(2000), procedure: z.string().trim().max(4000), instructions: z.string().trim().max(8000), modelProvider: z.enum(["gpt_codex_subscription", "claude_subscription", "cursor_agent"]) }).parse(input);
  const { db, agent, workspace } = await chatAgent(founder.id, z.string().uuid().parse(agentId));
  await db.update(aiAgents).set({ ...data, updatedAt: new Date() }).where(eq(aiAgents.id, agent.id));
  await db.insert(auditEvents).values({ workspaceId: workspace.id, actorUserId: founder.id, eventType: "ai_agent.settings_updated", payload: { agentId: agent.id } });
  revalidatePath("/", "layout");
  return { saved: true };
}

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item : "";
}

function values(formData: FormData, key: string) {
  return formData.getAll(key).filter((item): item is string => typeof item === "string");
}

async function requireFounder() {
  const session = await founderSession();
  if (session.state !== "authorized") throw new Error("Founder access is required");
  return session.founder;
}

export async function createAgentAction(formData: FormData) {
  const founder = await requireFounder();
  const result = await createFounderAgent({
    actorUserId: founder.id,
    name: value(formData, "name"),
    purpose: value(formData, "purpose"),
    allowedWork: values(formData, "allowedWork"),
    accessScope: value(formData, "accessScope"),
    projectId: value(formData, "projectId"),
    ventureId: value(formData, "ventureId"),
    workStyle: value(formData, "workStyle"),
    answerStyle: value(formData, "answerStyle"),
    procedure: value(formData, "procedure"),
    instructions: value(formData, "instructions"),
    modelProvider: value(formData, "modelProvider"),
    capabilities: values(formData, "capabilities"),
  });
  revalidatePath("/agents");
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  redirect(`/agents/${result.agentId}`);
}

export async function deactivateAgentAction(formData: FormData) {
  const founder = await requireFounder();
  const agentId = value(formData, "agentId");
  await deactivateFounderAgent({ actorUserId: founder.id, agentId });
  revalidatePath(`/agents/${agentId}`);
  revalidatePath("/agents");
  revalidatePath("/tasks");
  redirect(`/agents/${agentId}`);
}

export async function recordAgentWorkAction(formData: FormData) {
  const founder = await requireFounder();
  const agentId = value(formData, "agentId");
  await recordFounderAgentWork({
    actorUserId: founder.id,
    agentId,
    requestNote: value(formData, "requestNote"),
    inputNote: value(formData, "inputNote"),
    resultNote: value(formData, "resultNote"),
    taskId: value(formData, "taskId"),
  });
  revalidatePath(`/agents/${agentId}`);
  revalidatePath("/agents");
  redirect(`/agents/${agentId}`);
}

export async function invokeAgentFromPanelAction(input: {
  agentId: string;
  message: string;
  pathname: string;
  modelProvider?: string;
}) {
  const founder = await requireFounder();
  const result = await invokeFounderAgentFromPanel({
    actorUserId: founder.id,
    agentId: input.agentId,
    message: input.message,
    pathname: input.pathname,
    modelProvider: input.modelProvider,
  });
  revalidatePath(`/agents/${result.agentId}`);
  revalidatePath("/agents");
  revalidatePath("/approvals");
  revalidatePath("/dashboard");
  return result;
}

export async function approveAgentWorkAction(formData: FormData) {
  const founder = await requireFounder();
  const agentId = value(formData, "agentId");
  await approveFounderAgentWork({
    actorUserId: founder.id,
    workLogId: value(formData, "workLogId"),
    approved: value(formData, "approved") === "true",
    resultNote: value(formData, "resultNote"),
  });
  revalidatePath(`/agents/${agentId}`);
  redirect(`/agents/${agentId}`);
}

export async function rejectAgentWorkAction(formData: FormData) {
  const founder = await requireFounder();
  const agentId = value(formData, "agentId");
  await rejectFounderAgentWork({
    actorUserId: founder.id,
    workLogId: value(formData, "workLogId"),
    approved: value(formData, "approved") === "true",
    reason: value(formData, "reason"),
  });
  revalidatePath(`/agents/${agentId}`);
  redirect(`/agents/${agentId}`);
}
