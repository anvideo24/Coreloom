import { describe, expect, it, vi, beforeEach } from "vitest";
import { chatPrompt, requireChatModel } from "@/lib/domain/agent-chat";
import { subscriptionEnvironment } from "@/lib/agents/subscription";

describe("subscription chat boundary", () => {
  it("rejects arbitrary model names and Cursor until connected", () => {
    expect(() => requireChatModel("--dangerously-skip-permissions")).toThrow();
    expect(() => requireChatModel("cursor_agent")).toThrow();
    expect(requireChatModel("sonnet").provider).toBe("claude_subscription");
  });
  it("does not pass database, API or mail credentials into CLI", () => {
    const env = subscriptionEnvironment({ NODE_ENV: "test", PATH: "bin", DATABASE_URL: "private", OPENAI_API_KEY: "private", ANTHROPIC_API_KEY: "private", RESEND_API_KEY: "private" });
    expect(env.PATH).toBe("bin");
    expect(env).not.toHaveProperty("DATABASE_URL");
    expect(env).not.toHaveProperty("OPENAI_API_KEY");
    expect(env).not.toHaveProperty("ANTHROPIC_API_KEY");
    expect(env).not.toHaveProperty("RESEND_API_KEY");
  });
  it("includes current instructions and previous turns for follow-up conversations", () => {
    const prompt = chatPrompt({ name: "테스트", purpose: "초안", instructions: "한 문장", workStyle: null, answerStyle: null, procedure: null, accessScope: "제공된 대화", allowedWork: ["draft"] }, [{ role: "user", body: "앞 질문" }, { role: "assistant", body: "앞 답변" }, { role: "user", body: "이어서" }], "견적서");
    for (const text of ["한 문장", "앞 질문", "앞 답변", "이어서", "데이터는 제공되지 않음"]) expect(prompt).toContain(text);
  });
});

vi.mock("@/lib/auth/session", () => ({ founderSession: vi.fn() }));
vi.mock("@/lib/agents/chat-repository", () => ({ readAgentChats: vi.fn(), sendAgentChat: vi.fn() }));
import { founderSession } from "@/lib/auth/session";
import { sendAgentChat } from "@/lib/agents/chat-repository";
import { GET, POST } from "@/app/api/agents/chat/route";

describe("chat route authorization", () => {
  beforeEach(() => vi.clearAllMocks());
  it("does not cancel generation when the browser connection disappears", async () => {
    vi.mocked(founderSession).mockResolvedValue({ state: "authorized", founder: { id: "test", email: "" } });
    let signal: AbortSignal | undefined;
    let finish!: () => void;
    vi.mocked(sendAgentChat).mockImplementation(async (_actor, _input, currentSignal) => {
      signal = currentSignal;
      await new Promise<void>((resolve) => { finish = resolve; });
      return { id: "reply", role: "assistant", body: "ok", model: "gpt-5.4-mini", status: "complete" } as Awaited<ReturnType<typeof sendAgentChat>>;
    });
    const connection = new AbortController();
    const response = await POST(new Request("http://localhost/api/agents/chat", { method: "POST", signal: connection.signal, headers: { host: "localhost", origin: "http://localhost", "content-type": "application/json" }, body: JSON.stringify({ agentId: "00000000-0000-4000-8000-000000000001", requestId: "00000000-0000-4000-8000-000000000002", message: "test", model: "gpt-5.4-mini", pathname: "/agents" }) }));
    connection.abort();
    const aborted = signal?.aborted;
    finish();
    await response.body?.cancel();
    expect(aborted).toBe(false);
  });
  it("blocks logged-out users before querying conversations", async () => {
    vi.mocked(founderSession).mockResolvedValue({ state: "signed-out" });
    expect((await GET(new Request("http://localhost/api/agents/chat"))).status).toBe(401);
    expect((await POST(new Request("http://localhost/api/agents/chat", { method: "POST" }))).status).toBe(401);
    expect(sendAgentChat).not.toHaveBeenCalled();
  });
  it("blocks cross-origin generation even when logged in", async () => {
    vi.mocked(founderSession).mockResolvedValue({ state: "authorized", founder: { id: "test", email: "" } });
    const response = await POST(new Request("http://localhost/api/agents/chat", { method: "POST", headers: { host: "localhost", origin: "https://example.com" } }));
    expect(response.status).toBe(403);
    expect(sendAgentChat).not.toHaveBeenCalled();
  });
});
