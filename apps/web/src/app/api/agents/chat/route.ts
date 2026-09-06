import { z } from "zod";
import { founderSession } from "@/lib/auth/session";
import { readAgentChats, readAgentRequest, sendAgentChat } from "@/lib/agents/chat-repository";
import { beginChatRun, chatRunActive, finishChatRun, stopChatRun } from "@/lib/agents/chat-runs";
import { randomUUID } from "node:crypto";
import { chatFailureStatus, chatModels } from "@/lib/domain/agent-chat";
import { subscriptionStatus } from "@/lib/agents/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const requestSchema = z.object({ agentId: z.string().uuid(), requestId: z.string().uuid().optional(), threadId: z.string().uuid().optional(), message: z.string().trim().min(1).max(8000), attachments: z.array(z.string().uuid()).max(6).optional(), model: z.enum(chatModels.map((model) => model.id)), pathname: z.string().max(240).startsWith("/") });
const responseHeaders = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const session = await founderSession();
  if (session.state !== "authorized") return Response.json({ error: "로그인이 필요합니다." }, { status: 401, headers: responseHeaders });
  const params = new URL(request.url).searchParams;
  if (params.has("requestId")) {
    const selection = z.object({ agentId: z.string().uuid(), requestId: z.string().uuid() }).safeParse(Object.fromEntries(params));
    if (!selection.success) return Response.json({ error: "요청을 확인해 주세요." }, { status: 400 });
    const { agentId, requestId } = selection.data;
    try { return Response.json({ ...await readAgentRequest(session.founder.id, agentId, requestId), running: chatRunActive(session.founder.id, agentId, requestId) }, { headers: responseHeaders }); }
    catch { return Response.json({ error: "요청 상태를 확인하지 못했습니다." }, { status: 400, headers: responseHeaders }); }
  }
  if (params.get("status") === "1") {
    const [gpt, claude] = await Promise.all([subscriptionStatus("gpt_codex_subscription"), subscriptionStatus("claude_subscription")]);
    return Response.json({ gpt_codex_subscription: gpt, claude_subscription: claude, cursor_agent: false }, { headers: responseHeaders });
  }
  const parsed = z.object({ agentId: z.string().uuid(), threadId: z.string().uuid().optional() }).safeParse({ agentId: params.get("agentId"), threadId: params.get("threadId") || undefined });
  if (!parsed.success) return Response.json({ error: "대화 선택을 확인해 주세요." }, { status: 400 });
  try { return Response.json(await readAgentChats(session.founder.id, parsed.data.agentId, parsed.data.threadId, params.get("fresh") === "1"), { headers: responseHeaders }); }
  catch { return Response.json({ error: "대화를 불러오지 못했습니다." }, { status: 400, headers: responseHeaders }); }
}

export async function POST(request: Request) {
  const session = await founderSession();
  if (session.state !== "authorized") return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  // 브라우저가 보낸 동일 출처 요청만 받는다. 프록시 호스트를 로그에 남기지 않는다.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  let sameOrigin = false;
  try { sameOrigin = !!origin && new URL(origin).host === host; } catch { /* Invalid origins are rejected. */ }
  if (!sameOrigin) return Response.json({ error: "요청 출처를 확인해 주세요." }, { status: 403 });
  if (Number(request.headers.get("content-length") || 0) > 40_000) return Response.json({ error: "요청이 너무 큽니다." }, { status: 413 });
  const payload = await request.json().catch(() => null);
  if (payload?.action === "stop") {
    const selection = z.object({ agentId: z.string().uuid(), requestId: z.string().uuid() }).safeParse(payload);
    if (!selection.success) return Response.json({ error: "요청을 확인해 주세요." }, { status: 400 });
    return Response.json({ stopped: stopChatRun(session.founder.id, selection.data.agentId, selection.data.requestId) }, { headers: responseHeaders });
  }
  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: "메시지와 모델을 확인해 주세요." }, { status: 400 });
  const requestId = parsed.data.requestId || randomUUID();
  let abort: AbortController;
  try { abort = beginChatRun(session.founder.id, parsed.data.agentId, requestId); }
  catch { return Response.json({ error: "이미 진행 중인 요청입니다." }, { status: 409 }); }
  let connected = !request.signal.aborted;
  const disconnect = () => { connected = false; };
  request.signal.addEventListener("abort", disconnect, { once: true });
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function emit(event: unknown) { if (connected) { try { controller.enqueue(encoder.encode(JSON.stringify(event) + "\n")); } catch { connected = false; } } }
      const heartbeat = setInterval(() => emit({ type: "waiting" }), 15_000);
      try {
        const message = await sendAgentChat(session.founder.id, { ...parsed.data, requestId }, abort.signal, (id) => emit({ type: "thread", id }));
        emit({ type: "message", message });
      } catch { emit({ type: "error", error: chatFailureStatus(abort.signal) === "stopped" ? "사용자가 응답을 중지했습니다." : "응답을 완료하지 못했습니다. 구독 연결·사용 한도를 확인하고 다시 보내 주세요." }); }
      finally { clearInterval(heartbeat); finishChatRun(requestId); request.signal.removeEventListener("abort", disconnect); try { controller.close(); } catch { /* The browser may already have closed its stream. */ } }
    },
    cancel() { connected = false; },
  });
  return new Response(stream, { headers: { ...responseHeaders, "Content-Type": "application/x-ndjson; charset=utf-8", "X-Accel-Buffering": "no" } });
}
