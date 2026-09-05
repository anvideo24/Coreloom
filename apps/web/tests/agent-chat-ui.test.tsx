// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AgentChat } from "@/components/agent-chat";

vi.mock("next/navigation", () => ({ usePathname: () => "/agents" }));
vi.mock("@/app/(private)/agents/actions", () => ({
  readAgentSettingsAction: vi.fn().mockResolvedValue({ workStyle: "", answerStyle: "", procedure: "", instructions: "이전 지침", modelProvider: "gpt_codex_subscription" }),
  saveAgentSettingsAction: vi.fn().mockResolvedValue({ saved: true }),
}));
import { saveAgentSettingsAction } from "@/app/(private)/agents/actions";
const agent = { id: "00000000-0000-4000-8000-000000000001", name: "테스트 에이전트", purpose: "초안 작성", modelProvider: "gpt_codex_subscription" as const };

beforeEach(() => {
  vi.clearAllMocks();
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
