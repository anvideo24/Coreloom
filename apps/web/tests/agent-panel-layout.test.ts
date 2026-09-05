import { describe, expect, test } from "vitest";

import { agentPanelLayout, agentPanelVisualFrame } from "@/lib/domain/agent-panel";

describe("agent panel layout", () => {
  test("uses a modal panel below the desktop dock boundary", () => {
    expect(agentPanelLayout(639)).toEqual({ mode: "modal", nav: "bottom" });
    expect(agentPanelLayout(640)).toEqual({ mode: "modal", nav: "rail" });
    expect(agentPanelLayout(1199)).toEqual({ mode: "modal", nav: "rail" });
  });

  test("temporarily uses the rail when a wide navigation would leave less than 640px for work", () => {
    expect(agentPanelLayout(1200, true)).toEqual({ mode: "dock", nav: "rail" });
    expect(agentPanelLayout(1200, false)).toEqual({ mode: "dock", nav: "rail" });
    expect(agentPanelLayout(1279, true)).toEqual({ mode: "dock", nav: "rail" });
    expect(agentPanelLayout(1280, true)).toEqual({ mode: "dock", nav: "sidebar" });
    expect(agentPanelLayout(1440, true)).toEqual({ mode: "dock", nav: "sidebar" });
  });

  test("uses the full visual viewport for the fullscreen modal", () => {
    expect(agentPanelVisualFrame({ layoutHeight: 800, visualHeight: 800, visualOffsetTop: 0, tabBarPx: 0, flushTop: true }))
      .toEqual({ keyboardOpen: false, topPx: 0, heightPx: 800 });
  });
});
