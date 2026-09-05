import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/session", () => ({ founderSession: vi.fn() }));
vi.mock("@/lib/agents/chat-repository", () => ({ chatAgent: vi.fn() }));
vi.mock("@/lib/agents/chat-images", () => ({ readChatImage: vi.fn(), storeChatImage: vi.fn() }));
import { founderSession } from "@/lib/auth/session";
import { chatAgent } from "@/lib/agents/chat-repository";
import { readChatImage, storeChatImage } from "@/lib/agents/chat-images";
import { GET, POST } from "@/app/api/agents/chat/images/route";
const url = "http://localhost:3000/api/agents/chat/images?agentId=00000000-0000-4000-8000-000000000001&id=00000000-0000-4000-8000-000000000002";
beforeEach(() => vi.resetAllMocks());
describe("private chat images", () => {
  it("never reads an image without an authorized session", async () => {
    vi.mocked(founderSession).mockResolvedValue({ state: "signed-out" });
    expect((await GET(new Request(url))).status).toBe(404);
    expect(readChatImage).not.toHaveBeenCalled();
  });
  it("checks agent ownership before reading a guessed image id", async () => {
    vi.mocked(founderSession).mockResolvedValue({ state: "authorized", founder: { id: "test-actor" } } as Awaited<ReturnType<typeof founderSession>>);
    vi.mocked(chatAgent).mockRejectedValue(new Error("denied"));
    expect((await GET(new Request(url))).status).toBe(404);
    expect(readChatImage).not.toHaveBeenCalled();
  });
  it("rejects cross-origin uploads before storing anything", async () => {
    expect((await POST(new Request(url, { method: "POST", headers: { host: "localhost:3000", origin: "https://example.org" }, body: "x" }))).status).toBe(403);
    expect(storeChatImage).not.toHaveBeenCalled();
  });
});
