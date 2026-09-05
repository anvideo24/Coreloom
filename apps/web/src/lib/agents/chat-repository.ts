import "server-only";
import { and, asc, desc, eq, isNull, lt, or } from "drizzle-orm";
import { createDatabase } from "@/lib/db/client";
import { agentChatMessages, agentChatThreads, aiAgents, auditEvents } from "@/lib/db/schema";
import { ensureFounderWorkspace } from "@/lib/workspace/founder-workspace";
import { chatPrompt, requireChatModel } from "@/lib/domain/agent-chat";
import { agentPanelContextTitle } from "@/lib/domain/agent-panel";
import { generateSubscriptionReply } from "./subscription";

export async function chatAgent(actor: string, agentId: string) {
  const workspace = await ensureFounderWorkspace(actor, "agents");
  const db = createDatabase();
  const [agent] = await db.select().from(aiAgents).where(and(eq(aiAgents.id, agentId), eq(aiAgents.workspaceId, workspace.id), isNull(aiAgents.deletedAt))).limit(1);
  if (!agent || agent.status !== "active") throw new Error("사용할 수 없는 에이전트입니다.");
  return { db, agent, workspace };
}

export async function readAgentChats(actor: string, agentId: string, threadId?: string) {
  const { db, workspace } = await chatAgent(actor, agentId);
  const threads = await db.select().from(agentChatThreads).where(and(eq(agentChatThreads.workspaceId, workspace.id), eq(agentChatThreads.agentId, agentId))).orderBy(desc(agentChatThreads.updatedAt)).limit(100);
  if (!threadId) return { threads, messages: [] };
  const [thread] = await db.select().from(agentChatThreads).where(and(eq(agentChatThreads.id, threadId), eq(agentChatThreads.workspaceId, workspace.id), eq(agentChatThreads.agentId, agentId))).limit(1);
  if (!thread) throw new Error("대화를 찾을 수 없습니다.");
  const messages = await db.select().from(agentChatMessages).where(eq(agentChatMessages.threadId, threadId)).orderBy(asc(agentChatMessages.createdAt));
  return { threads, messages };
}

export async function sendAgentChat(actor: string, input: { agentId: string; threadId?: string; message: string; model: string; pathname: string }, signal: AbortSignal, onThread: (id: string) => void) {
  const model = requireChatModel(input.model);
  const { db, agent, workspace } = await chatAgent(actor, input.agentId);
  let threadId = input.threadId;
  if (!threadId) {
    const [created] = await db.insert(agentChatThreads).values({ workspaceId: workspace.id, agentId: agent.id, title: input.message.slice(0, 64), model: model.id }).returning();
    threadId = created.id;
  }
  const [locked] = await db.update(agentChatThreads).set({ busyUntil: new Date(Date.now() + 240_000), model: model.id, updatedAt: new Date() }).where(and(eq(agentChatThreads.id, threadId), eq(agentChatThreads.workspaceId, workspace.id), eq(agentChatThreads.agentId, agent.id), or(isNull(agentChatThreads.busyUntil), lt(agentChatThreads.busyUntil, new Date())))).returning();
  if (!locked) throw new Error("이미 응답 중이거나 접근할 수 없는 대화입니다.");
  onThread(threadId);
  try {
    await db.insert(agentChatMessages).values({ threadId, role: "user", body: input.message, model: model.id });
    const previous = await db.select().from(agentChatMessages).where(eq(agentChatMessages.threadId, threadId)).orderBy(desc(agentChatMessages.createdAt)).limit(40);
    const history = previous.reverse().filter((row) => row.status === "complete");
    // 상세 저장 행 전체를 보내지 않는다. 지침과 해당 대화만 전달한다.
    const prompt = chatPrompt({ name: agent.name, purpose: agent.purpose, instructions: agent.instructions, workStyle: agent.workStyle, answerStyle: agent.answerStyle, procedure: agent.procedure, accessScope: agent.accessScope, allowedWork: agent.allowedWork }, history.map(({ role, body }) => ({ role, body })), agentPanelContextTitle(input.pathname));
    if (prompt.length > 100_000) throw new Error("대화가 길어졌습니다. 새 대화를 시작해 주세요.");
    const body = await generateSubscriptionReply(model.id, prompt, signal);
    const [message] = await db.insert(agentChatMessages).values({ threadId, role: "assistant", body, model: model.id }).returning();
    await db.insert(auditEvents).values({ workspaceId: workspace.id, actorUserId: actor, eventType: "ai_agent.chat_completed", payload: { agentId: agent.id, threadId, model: model.id } });
    return message;
  } catch (error) {
    const body = signal.aborted ? "응답을 중지했습니다." : "응답을 완료하지 못했습니다. 구독 연결·사용 한도를 확인한 뒤 다시 보내 주세요.";
    await db.insert(agentChatMessages).values({ threadId, role: "assistant", body, model: model.id, status: "failed" });
    throw error;
  } finally {
    await db.update(agentChatThreads).set({ busyUntil: null, updatedAt: new Date() }).where(eq(agentChatThreads.id, threadId));
  }
}
