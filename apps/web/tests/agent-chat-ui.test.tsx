// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AgentChat } from "@/components/agent-chat";

vi.mock("next/navigation", () => ({ usePathname: () => "/agents" }));
vi.mock("@/app/(private)/agents/actions", () => ({
  readAgentSettingsAction: vi.fn().mockResolvedValue({ workStyle: "", answerStyle: "", procedure: "", instructions: "이전 지침", modelProvider: "gpt_codex_subscription" }),
  saveAgentSettingsAction: vi.fn().mockResolvedValue({ saved: true }),
  readAgentAccessAction: vi.fn().mockResolvedValue({ permissions: { read_quotes: false, read_clients: false, read_projects: false, read_tasks: false, read_documents: false, read_pc: false }, roots: [], recent: [] }),
  saveAgentAccessAction: vi.fn().mockResolvedValue({ saved: true }),
}));
import { saveAgentSettingsAction, saveAgentAccessAction } from "@/app/(private)/agents/actions";
const agent = { id: "00000000-0000-4000-8000-000000000001", name: "테스트 에이전트", purpose: "초안 작성", modelProvider: "gpt_codex_subscription" as const };

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  Element.prototype.scrollTo = vi.fn();
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      const encoder = new TextEncoder();
      return new Response(new ReadableStream({ start(controller) {
        controller.enqueue(encoder.encode(JSON.stringify({ type: "thread", id: "thread-test" }) + "\n"));
        controller.enqueue(encoder.encode(JSON.stringify({ type: "message", message: { id: "reply", role: "assistant", body: "테스트 답변", model: "gpt-5.4-mini", status: "complete" } }) + "\n"));
        controller.close();
      } }));
    }
    if (url.includes("status=")) return Response.json({ gpt_codex_subscription: true, claude_subscription: true });
    return Response.json({ threads: [{ id: "thread-test", title: "지난 대화", model: "gpt-5.4-mini" }], messages: url.includes("threadId=") ? [{ id: "saved", role: "assistant", body: "저장된 답변", model: "gpt-5.4-mini", status: "complete" }] : [] });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("agent conversation interactions", () => {
  it("pastes multiple images and preserves attachments and draft when sending fails", async () => {
    render(<AgentChat agent={agent} />);
    await screen.findByText("무엇을 함께 할까요?");
    const originalFetch = vi.mocked(fetch).getMockImplementation()!;
    let count = 0;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (String(url).includes("/images")) return Response.json({ id: `image-${++count}` });
      if (init?.method === "POST") return new Response(null, { status: 503 });
      return originalFetch(url, init);
    });
    fireEvent.paste(screen.getByLabelText("메시지"), { clipboardData: { files: [new File(["a"], "a.png", { type: "image/png" }), new File(["b"], "b.png", { type: "image/png" })] } });
    await screen.findByAltText("첨부 이미지 2");
    fireEvent.change(screen.getByLabelText("메시지"), { target: { value: "두 장 확인" } });
    fireEvent.click(screen.getByLabelText("메시지 보내기"));
    await screen.findByRole("alert");
    expect((screen.getByLabelText("메시지") as HTMLTextAreaElement).value).toBe("두 장 확인");
    expect(screen.getByAltText("첨부 이미지 2")).toBeTruthy();
    expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === "POST" && typeof init.body === "string" && JSON.parse(init.body).attachments?.length === 2)).toBe(true);
    fireEvent.click(screen.getByLabelText("메시지 보내기"));
    await waitFor(() => expect(screen.getByLabelText("메시지 보내기")).toBeTruthy());
    const sends = vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST" && typeof init.body === "string").map(([, init]) => JSON.parse(String(init!.body)));
    expect(sends).toHaveLength(2);
    expect(sends[1].requestId).toBe(sends[0].requestId);
    fireEvent.click(screen.getByLabelText("이미지 1 제거"));
    expect(screen.queryByAltText("첨부 이미지 2")).toBeNull();
  });
  it("restores the chosen conversation, model and unsent draft after remount", async () => {
    const first = render(<AgentChat agent={agent} />);
    await screen.findByText("무엇을 함께 할까요?");
    fireEvent.click(screen.getByText("대화 이력"));
    fireEvent.click(screen.getByText("지난 대화"));
    await screen.findByText("저장된 답변");
    fireEvent.change(screen.getByLabelText("메시지"), { target: { value: "작성 중인 글" } });
    first.unmount();
    render(<AgentChat agent={agent} />);
    await screen.findByText("저장된 답변");
    expect((screen.getByLabelText("메시지") as HTMLTextAreaElement).value).toBe("작성 중인 글");
    expect((screen.getByLabelText("대화 모델") as HTMLSelectElement).value).toBe("gpt-5.4-mini");
  });
  it("saves selected read permissions separately from instructions", async () => {
    render(<AgentChat agent={agent} />);
    await screen.findByText("무엇을 함께 할까요?");
    fireEvent.click(screen.getByText("지침 설정"));
    const quotes = await screen.findByRole("checkbox", { name: "견적서" });
    expect((quotes as HTMLInputElement).checked).toBe(false);
    fireEvent.click(quotes);
    fireEvent.click(screen.getByRole("button", { name: "조회 권한 저장" }));
    await waitFor(() => expect(saveAgentAccessAction).toHaveBeenCalledWith(agent.id, expect.objectContaining({ permissions: expect.objectContaining({ read_quotes: true, read_pc: false }), roots: [] })));
    await screen.findByText("조회 권한을 저장했습니다. 다음 요청부터 적용됩니다.");
  });
  it("sends the selected model, displays the answer and opens stored history", async () => {
    render(<AgentChat agent={agent} />);
    await screen.findByText("무엇을 함께 할까요?");
    fireEvent.change(screen.getByLabelText("대화 모델"), { target: { value: "gpt-5.4-mini" } });
    fireEvent.change(screen.getByLabelText("메시지"), { target: { value: "테스트 요청" } });
    fireEvent.click(screen.getByLabelText("메시지 보내기"));
    await screen.findByText("테스트 답변");
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === "POST" && JSON.parse(String(options.body)).model === "gpt-5.4-mini")).toBe(true);
    fireEvent.click(screen.getByText("대화 이력"));
    fireEvent.click(screen.getByText("지난 대화"));
    await screen.findByText("저장된 답변");
  });
  it("edits the same server-stored instructions from chat settings", async () => {
    render(<AgentChat agent={agent} />);
    await screen.findByText("무엇을 함께 할까요?");
    fireEvent.click(screen.getByText("지침 설정"));
    const input = await screen.findByLabelText("추가 지침");
    fireEvent.change(input, { target: { value: "새 지침" } });
    fireEvent.click(screen.getByText("지침 저장"));
    await waitFor(() => expect(saveAgentSettingsAction).toHaveBeenCalledWith(agent.id, expect.objectContaining({ instructions: "새 지침" })));
    await screen.findByText("저장했습니다. 다음 답변에 적용됩니다.");
  });
});
