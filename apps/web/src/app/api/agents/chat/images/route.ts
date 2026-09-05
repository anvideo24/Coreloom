import { z } from "zod";
import { founderSession } from "@/lib/auth/session";
import { chatAgent } from "@/lib/agents/chat-repository";
import { readChatImage, storeChatImage } from "@/lib/agents/chat-images";
import { boundedImageBody } from "@/lib/agents/chat-image-codec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
async function authorize(request: Request) {
  const session = await founderSession();
  if (session.state !== "authorized") throw new Error("unauthorized");
  const agentId = z.string().uuid().parse(new URL(request.url).searchParams.get("agentId"));
  await chatAgent(session.founder.id, agentId);
  return { actor: session.founder.id, agentId };
}
export async function GET(request: Request) {
  try {
    const { actor, agentId } = await authorize(request);
    const id = z.string().uuid().parse(new URL(request.url).searchParams.get("id"));
    const bytes = await readChatImage(actor, agentId, id);
    return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": "image/webp" } });
  } catch { return Response.json({ error: "이미지를 열 수 없습니다." }, { status: 404, headers }); }
}
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).host !== request.headers.get("host")) return Response.json({ error: "잘못된 출처입니다." }, { status: 403, headers });
    const { actor, agentId } = await authorize(request);
    const result = await storeChatImage(actor, agentId, await boundedImageBody(request));
    return Response.json(result, { headers });
  } catch { return Response.json({ error: "이미지를 저장하지 못했습니다. PNG·JPG·WebP, 8MB 이하인지 또는 보관 한도를 확인해 주세요." }, { status: 400, headers }); }
}
