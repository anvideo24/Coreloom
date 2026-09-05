import "server-only";
import { and, asc, desc, eq, isNull, lt, or } from "drizzle-orm";
import { createDatabase } from "@/lib/db/client";
import { agentChatMessages, agentChatThreads, aiAgents, auditEvents } from "@/lib/db/schema";
import { ensureFounderWorkspace } from "@/lib/workspace/founder-workspace";
import { chatPrompt, requireChatModel } from "@/lib/domain/agent-chat";
import { agentPanelContextTitle } from "@/lib/domain/agent-panel";
import { generateSubscriptionReply } from "./subscription";
import { accessPolicy, runReadConversation } from "@/lib/domain/agent-access";
import { executeReadTool } from "./read-tools";
import { readChatImage } from "./chat-images";

export async function chatAgent(actor: string, agentId: string) {
  const workspace = await ensureFounderWorkspace(actor, "agents");
  const db = createDatabase();
  const [agent] = await db.select().from(aiAgents).where(and(eq(aiAgents.id, agentId), eq(aiAgents.workspaceId, workspace.id), isNull(aiAgents.deletedAt))).limit(1);
  if (!agent || agent.status !== "active") throw new Error("사용할 수 없는 에이전트입니다.");
  return { db, agent, workspace };
}

export async function readAgentChats(actor: string, agentId: string, threadId?: string, fresh = false) {
  const { db, workspace } = await chatAgent(actor, agentId);
  const threads = await db.select().from(agentChatThreads).where(and(eq(agentChatThreads.workspaceId, workspace.id), eq(agentChatThreads.agentId, agentId))).orderBy(desc(agentChatThreads.updatedAt)).limit(100);
  if (!threadId && !fresh) threadId = threads[0]?.id;
  if (!threadId) return { threads, messages: [] };
  const [thread] = await db.select().from(agentChatThreads).where(and(eq(agentChatThreads.id, threadId), eq(agentChatThreads.workspaceId, workspace.id), eq(agentChatThreads.agentId, agentId))).limit(1);
  if (!thread) throw new Error("대화를 찾을 수 없습니다.");
  const messages = await db.select().from(agentChatMessages).where(eq(agentChatMessages.threadId, threadId)).orderBy(asc(agentChatMessages.createdAt));
  return { threads, messages, threadId };
}

export async function sendAgentChat(actor: string, input: { agentId: string; threadId?: string; message: string; model: string; pathname: string; attachments?: string[]; requestId?: string }, signal: AbortSignal, onThread: (id: string) => void) {
  const model = requireChatModel(input.model);
  const { db, agent, workspace } = await chatAgent(actor, input.agentId);
  const attachments = input.attachments || [];
  if (attachments.length > 6) throw new Error("이미지는 최대 6장입니다.");
  await Promise.all(attachments.map((id) => readChatImage(actor, agent.id, id)));
  let threadId = input.threadId;
  const [existing] = input.requestId ? await db.select({ message: agentChatMessages }).from(agentChatMessages).innerJoin(agentChatThreads, eq(agentChatThreads.id, agentChatMessages.threadId)).where(and(eq(agentChatMessages.clientRequestId, input.requestId), eq(agentChatMessages.role, "user"), eq(agentChatThreads.workspaceId, workspace.id), eq(agentChatThreads.agentId, agent.id))).limit(1) : [];
  if (existing) {
    if (existing.message.body !== input.message || JSON.stringify(existing.message.attachments) !== JSON.stringify(attachments)) throw new Error("재시도 내용이 달라졌습니다.");
    threadId = existing.message.threadId;
    const [completed] = await db.select().from(agentChatMessages).where(and(eq(agentChatMessages.threadId, threadId), eq(agentChatMessages.clientRequestId, input.requestId!), eq(agentChatMessages.role, "assistant"), eq(agentChatMessages.status, "complete"))).limit(1);
    if (completed) { onThread(threadId); return completed; }
  }
  if (!threadId) {
    const [created] = await db.insert(agentChatThreads).values({ workspaceId: workspace.id, agentId: agent.id, title: input.message.slice(0, 64), model: model.id }).returning();
    threadId = created.id;
  }
  const [locked] = await db.update(agentChatThreads).set({ busyUntil: new Date(Date.now() + 600_000), model: model.id, updatedAt: new Date() }).where(and(eq(agentChatThreads.id, threadId), eq(agentChatThreads.workspaceId, workspace.id), eq(agentChatThreads.agentId, agent.id), or(isNull(agentChatThreads.busyUntil), lt(agentChatThreads.busyUntil, new Date())))).returning();
  if (!locked) throw new Error("이미 응답 중이거나 접근할 수 없는 대화입니다.");
  onThread(threadId);
  try {
    if (!existing) await db.insert(agentChatMessages).values({ threadId, role: "user", body: input.message, model: model.id, attachments, clientRequestId: input.requestId });
    const previous = await db.select().from(agentChatMessages).where(eq(agentChatMessages.threadId, threadId)).orderBy(desc(agentChatMessages.createdAt)).limit(40);
    const history = previous.reverse().filter((row) => row.status === "complete");
    // 상세 저장 행 전체를 보내지 않는다. 지침과 해당 대화만 전달한다.
    const imageIds = history.flatMap((row) => row.attachments).slice(-6);
    const images = await Promise.all(imageIds.map((id) => readChatImage(actor, agent.id, id)));
    const prompt = chatPrompt({ name: agent.name, purpose: agent.purpose, instructions: agent.instructions, workStyle: agent.workStyle, answerStyle: agent.answerStyle, procedure: agent.procedure, accessScope: agent.accessScope, allowedWork: agent.allowedWork }, history.map(({ role, body, attachments: ids }) => ({ role, body: body + (ids.length ? `\n첨부 이미지: ${ids.map((id) => imageIds.includes(id) ? `이미지 ${imageIds.indexOf(id) + 1}` : "이전 이미지(현재 입력에서 제외)").join(", ")}` : "") })), agentPanelContextTitle(input.pathname));
    if (prompt.length > 100_000) throw new Error("대화가 길어졌습니다. 새 대화를 시작해 주세요.");
    const policy = accessPolicy(agent.capabilities);
    const readSignal = AbortSignal.any([signal, AbortSignal.timeout(480_000)]);
    const body = Object.values(policy).some(Boolean)
      ? await runReadConversation(`${prompt}\n서버 조회 정책: ${JSON.stringify(policy)}\n읽을 때 선택한 구독 제공자에 자료가 전달됩니다. 현재 서버가 연결된 DB만 조회하며 이전 DB를 조회하지 않습니다.`, (context) => generateSubscriptionReply(model.id, context, readSignal, images), (tool) => { readSignal.throwIfAborted(); return executeReadTool(actor, agent.id, threadId!, tool); })
      : await generateSubscriptionReply(model.id, prompt, signal, images);
    const [message] = await db.insert(agentChatMessages).values({ threadId, role: "assistant", body, model: model.id, clientRequestId: input.requestId }).onConflictDoUpdate({ target: [agentChatMessages.clientRequestId, agentChatMessages.role], set: { body, model: model.id, status: "complete" } }).returning();
    await db.insert(auditEvents).values({ workspaceId: workspace.id, actorUserId: actor, eventType: "ai_agent.chat_completed", payload: { agentId: agent.id, threadId, model: model.id } });
    return message;
  } catch (error) {
    const body = signal.aborted ? "응답을 중지했습니다." : "응답을 완료하지 못했습니다. 구독 연결·사용 한도를 확인한 뒤 다시 보내 주세요.";
    await db.insert(agentChatMessages).values({ threadId, role: "assistant", body, model: model.id, status: "failed", clientRequestId: input.requestId }).onConflictDoNothing();
    throw error;
  } finally {
    await db.update(agentChatThreads).set({ busyUntil: null, updatedAt: new Date() }).where(eq(agentChatThreads.id, threadId));
  }
}
