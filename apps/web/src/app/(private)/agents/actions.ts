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
import { eq } from "drizzle-orm";
import { z } from "zod";

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
