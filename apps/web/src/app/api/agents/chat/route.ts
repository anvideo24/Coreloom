import { z } from "zod";
import { founderSession } from "@/lib/auth/session";
import { readAgentChats, sendAgentChat } from "@/lib/agents/chat-repository";
import { chatModels } from "@/lib/domain/agent-chat";
import { subscriptionStatus } from "@/lib/agents/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const requestSchema = z.object({ agentId: z.string().uuid(), requestId: z.string().uuid().optional(), threadId: z.string().uuid().optional(), message: z.string().trim().min(1).max(8000), attachments: z.array(z.string().uuid()).max(6).optional(), model: z.enum(chatModels.map((model) => model.id)), pathname: z.string().max(240).startsWith("/") });
const responseHeaders = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const session = await founderSession();
  if (session.state !== "authorized") return Response.json({ error: "로그인이 필요합니다." }, { status: 401, headers: responseHeaders });
  const params = new URL(request.url).searchParams;
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
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "메시지와 모델을 확인해 주세요." }, { status: 400 });
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort(), { once: true });
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function emit(event: unknown) { if (!abort.signal.aborted) controller.enqueue(encoder.encode(JSON.stringify(event) + "\n")); }
      const heartbeat = setInterval(() => emit({ type: "waiting" }), 15_000);
      try {
        const message = await sendAgentChat(session.founder.id, parsed.data, abort.signal, (id) => emit({ type: "thread", id }));
        emit({ type: "message", message });
      } catch { emit({ type: "error", error: "응답을 완료하지 못했습니다. 구독 연결·사용 한도를 확인하고 다시 보내 주세요." }); }
      finally { clearInterval(heartbeat); if (!abort.signal.aborted) controller.close(); }
    },
    cancel() { abort.abort(); },
  });
  return new Response(stream, { headers: { ...responseHeaders, "Content-Type": "application/x-ndjson; charset=utf-8", "X-Accel-Buffering": "no" } });
}
