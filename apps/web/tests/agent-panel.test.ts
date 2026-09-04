import { describe, expect, it } from "vitest";

import {
  agentPanelContextTitle,
  isAgentPanelToggleHotkey,
  parseAgentPanelOpen,
  serializeAgentPanelOpen,
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
    expect(agentPanelContextTitle("/unknown")).toBe("운영 화면");
  });

  it("toggles with Ctrl/Cmd+J outside editable fields", () => {
    expect(isAgentPanelToggleHotkey({ ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: "j" } as KeyboardEvent)).toBe(true);
    expect(isAgentPanelToggleHotkey({ ctrlKey: false, metaKey: true, altKey: false, shiftKey: false, key: "J" } as KeyboardEvent)).toBe(true);
    expect(isAgentPanelToggleHotkey({ ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: "b" } as KeyboardEvent)).toBe(false);
  });
});
