import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ founderSession: vi.fn() }));
vi.mock("@/lib/agents/chat-repository", () => ({ chatAgent: vi.fn() }));
vi.mock("@/lib/agents/folder-browser", () => ({ browseAgentFolders: vi.fn() }));

import { founderSession } from "@/lib/auth/session";
import { chatAgent } from "@/lib/agents/chat-repository";
import { browseAgentFolders } from "@/lib/agents/folder-browser";
import { browseAgentFoldersAction } from "@/app/(private)/agents/folder-actions";

describe("browseAgentFoldersAction authorization boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not touch agent or filesystem before founder authorization", async () => {
    vi.mocked(founderSession).mockResolvedValue({ state: "signed-out" });
    await expect(browseAgentFoldersAction("not-an-id", null)).rejects.toThrow("Founder access is required");
    expect(chatAgent).not.toHaveBeenCalled();
    expect(browseAgentFolders).not.toHaveBeenCalled();
  });

  it("checks agent ownership before browsing", async () => {
    vi.mocked(founderSession).mockResolvedValue({ state: "authorized", founder: { id: "founder-1" } } as never);
    vi.mocked(chatAgent).mockRejectedValue(new Error("사용할 수 없는 에이전트입니다."));
    await expect(browseAgentFoldersAction("00000000-0000-4000-8000-000000000001", null)).rejects.toThrow("사용할 수 없는 에이전트입니다.");
    expect(browseAgentFolders).not.toHaveBeenCalled();
  });

  it("passes only the validated owner request to the browser", async () => {
    vi.mocked(founderSession).mockResolvedValue({ state: "authorized", founder: { id: "founder-1" } } as never);
    vi.mocked(chatAgent).mockResolvedValue({ agent: { id: "agent-1" } } as never);
    vi.mocked(browseAgentFolders).mockResolvedValue({ currentPath: null, label: "서버 PC", parentPath: null, canSelect: false, entries: [], truncated: false });
    await browseAgentFoldersAction("00000000-0000-4000-8000-000000000001", null);
    expect(chatAgent).toHaveBeenCalledWith("founder-1", "00000000-0000-4000-8000-000000000001");
    expect(browseAgentFolders).toHaveBeenCalledWith(null);
  });

  it("rejects malformed agent ids before filesystem access", async () => {
    vi.mocked(founderSession).mockResolvedValue({ state: "authorized", founder: { id: "founder-1" } } as never);
    await expect(browseAgentFoldersAction("invalid", null)).rejects.toThrow();
    expect(chatAgent).not.toHaveBeenCalled();
    expect(browseAgentFolders).not.toHaveBeenCalled();
  });

  it("does not return filesystem details in browser errors", async () => {
    vi.mocked(founderSession).mockResolvedValue({ state: "authorized", founder: { id: "founder-1" } } as never);
    vi.mocked(chatAgent).mockResolvedValue({ agent: { id: "agent-1" } } as never);
    vi.mocked(browseAgentFolders).mockRejectedValue(new Error("ENOENT: synthetic-private-path"));
    await expect(browseAgentFoldersAction("00000000-0000-4000-8000-000000000001", null)).rejects.toThrow("폴더를 탐색할 수 없습니다. 접근 가능한 서버 PC 폴더를 선택해 주세요.");
  });
});
