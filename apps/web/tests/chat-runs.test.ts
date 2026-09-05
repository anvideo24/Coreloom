import { describe, expect, it } from "vitest";
import { beginChatRun, chatRunActive, finishChatRun, stopChatRun } from "@/lib/agents/chat-runs";
describe("explicit chat stop", () => {
  it("only lets the initiating owner and agent stop a running request", () => {
    const requestId = "test-request";
    const controller = beginChatRun("owner", "agent", requestId);
    expect(stopChatRun("other", "agent", requestId)).toBe(false);
    expect(stopChatRun("owner", "other-agent", requestId)).toBe(false);
    expect(controller.signal.aborted).toBe(false);
    expect(stopChatRun("owner", "agent", requestId)).toBe(true);
    expect(controller.signal.reason).toBe("user-stop");
    finishChatRun(requestId);
    expect(chatRunActive("owner", "agent", requestId)).toBe(false);
  });
});
