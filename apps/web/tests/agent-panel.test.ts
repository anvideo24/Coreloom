import { describe, expect, it } from "vitest";

import {
  agentPanelContextTitle,
  buildAgentPanelWorkNotes,
  buildAgentSubscriptionPackage,
  isAgentPanelToggleHotkey,
  normalizeAgentPanelMessage,
  parseAgentPanelOpen,
  serializeAgentPanelOpen,
  agentPanelVisualFrame,
} from "@/lib/domain/agent-panel";

describe("agent panel shell helpers", () => {
  it("defaults the panel to closed and remembers open state", () => {
    expect(parseAgentPanelOpen(null)).toBe(false);
    expect(parseAgentPanelOpen("0")).toBe(false);
    expect(parseAgentPanelOpen("1")).toBe(true);
    expect(serializeAgentPanelOpen(true)).toBe("1");
    expect(serializeAgentPanelOpen(false)).toBe("0");
  });

  it("maps the current path to a short context title", () => {
    expect(agentPanelContextTitle("/quotes")).toBe("견적서");
    expect(agentPanelContextTitle("/quotes/abc")).toBe("견적서");
    expect(agentPanelContextTitle("/clients")).toBe("고객사");
    expect(agentPanelContextTitle("/clients/c1")).toBe("고객사");
    expect(agentPanelContextTitle("/clients-projects")).toBe("프로젝트");
    expect(agentPanelContextTitle("/clients-projects/p1")).toBe("프로젝트");
    expect(agentPanelContextTitle("/approvals")).toBe("승인함");
    expect(agentPanelContextTitle("/accounts")).toBe("계정과목");
    expect(agentPanelContextTitle("/unknown")).toBe("운영 화면");
  });

  it("toggles with Ctrl/Cmd+J outside editable fields", () => {
    expect(isAgentPanelToggleHotkey({ ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: "j" } as KeyboardEvent)).toBe(true);
    expect(isAgentPanelToggleHotkey({ ctrlKey: false, metaKey: true, altKey: false, shiftKey: false, key: "J" } as KeyboardEvent)).toBe(true);
    expect(isAgentPanelToggleHotkey({ ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: "b" } as KeyboardEvent)).toBe(false);
  });
});

describe("agent subscription handoff", () => {
  it("builds a copy package for the subscription seat without an API call", () => {
    const packed = buildAgentSubscriptionPackage({
      agentName: "조사",
      purpose: "자료 조사",
      workStyle: "근거 먼저",
      answerStyle: "짧게",
      procedure: "1. 확인\n2. 정리",
      instructions: "추정하지 말 것",
      allowedWork: ["research", "draft"],
      modelProvider: "claude_subscription",
      pathname: "/quotes",
      contextTitle: "견적서",
      message: " 견적 초안을 도와 주세요 ",
    });
    expect(packed.message).toBe("견적 초안을 도와 주세요");
    expect(packed.handoffLabel).toBe("Claude 구독");
    expect(packed.packageText).toContain("에이전트: 조사");
    expect(packed.packageText).toContain("화면: 견적서 (/quotes)");
    expect(packed.packageText).toContain("허용 업무: 자료 조사 · 초안 작성");
    expect(packed.packageText).toContain("견적 초안을 도와 주세요");
    expect(packed.handoffHint).toContain("API 키");
    expect(buildAgentPanelWorkNotes({
      message: packed.message,
      contextTitle: packed.contextTitle,
      pathname: packed.pathname,
      modelLabel: packed.modelLabel,
      packageText: packed.packageText,
    }).inputNote).toContain("구독 패키지");
  });

  it("uses the panel-selected subscription model in the package", () => {
    const packed = buildAgentSubscriptionPackage({
      agentName: "조사",
      purpose: "자료 조사",
      workStyle: "근거 먼저",
      answerStyle: "짧게",
      procedure: "1. 확인",
      instructions: "추정하지 말 것",
      allowedWork: ["research"],
      modelProvider: "gpt_codex_subscription",
      pathname: "/agents",
      contextTitle: "에이전트",
      message: "초안을 도와 주세요",
    });
    expect(packed.handoffLabel).toBe("GPT·Codex 구독");
    expect(packed.modelLabel).toBe("GPT·Codex 구독");
    expect(packed.packageText).toContain("모델: GPT·Codex 구독");
  });

  it("rejects an empty panel message", () => {
    expect(() => normalizeAgentPanelMessage(" ")).toThrow("Panel message is required");
  });
});


describe("agent panel visual frame", () => {
  it("fills the visual viewport when the keyboard obscures the layout", () => {
    expect(
      agentPanelVisualFrame({
        layoutHeight: 800,
        visualHeight: 420,
        visualOffsetTop: 0,
      }),
    ).toEqual({ keyboardOpen: true, topPx: 0, heightPx: 420 });
  });

  it("keeps the tab bar reserved when the keyboard is closed", () => {
    expect(
      agentPanelVisualFrame({
        layoutHeight: 800,
        visualHeight: 800,
        visualOffsetTop: 0,
        topInsetPx: 0,
        tabBarPx: 56,
      }),
    ).toEqual({ keyboardOpen: false, topPx: 6, heightPx: 738 });
  });
});
