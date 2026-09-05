"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AgentChat, type ChatAgentItem } from "@/components/agent-chat";
import { AGENT_PANEL_OPEN_STORAGE_KEY, AGENT_PANEL_SELECTED_STORAGE_KEY, agentPanelVisualFrame, isAgentPanelToggleHotkey, parseAgentPanelOpen, serializeAgentPanelOpen } from "@/lib/domain/agent-panel";
import { isEditableHotkeyTarget } from "@/lib/domain/private-navigation";

export type AgentPanelItem = ChatAgentItem;

export function AgentPanel({ agents }: { agents: AgentPanelItem[] }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const layerRef = useRef<HTMLDivElement>(null);
  const selected = agents.find((agent) => agent.id === selectedId);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
    setOpen(parseAgentPanelOpen(localStorage.getItem(AGENT_PANEL_OPEN_STORAGE_KEY)));
    const stored = localStorage.getItem(AGENT_PANEL_SELECTED_STORAGE_KEY);
    setSelectedId(agents.some((agent) => agent.id === stored) ? stored! : agents[0]?.id || "");
    setReady(true);
    });
    return () => cancelAnimationFrame(frame);
    // Settings refreshes must not reset an active conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(AGENT_PANEL_OPEN_STORAGE_KEY, serializeAgentPanelOpen(open)); }, [open, ready]);
  useEffect(() => { if (selectedId) localStorage.setItem(AGENT_PANEL_SELECTED_STORAGE_KEY, selectedId); }, [selectedId]);
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
      if (isAgentPanelToggleHotkey(event) && !isEditableHotkeyTarget(event.target)) { event.preventDefault(); setOpen((value) => !value); }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!open) return;
    function sync() {
      const layer = layerRef.current;
      if (!layer) return;
      const visual = window.visualViewport;
      const frame = agentPanelVisualFrame({ layoutHeight: innerHeight, visualHeight: visual?.height ?? innerHeight, visualOffsetTop: visual?.offsetTop ?? 0 });
      layer.style.setProperty("--agent-vv-top", `${frame.topPx}px`);
      layer.style.setProperty("--agent-vv-height", `${frame.heightPx}px`);
      layer.dataset.keyboard = frame.keyboardOpen ? "1" : "0";
    }
    sync();
    visualViewport?.addEventListener("resize", sync);
    visualViewport?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    return () => { visualViewport?.removeEventListener("resize", sync); visualViewport?.removeEventListener("scroll", sync); window.removeEventListener("resize", sync); };
  }, [open]);

  return <>
    <button aria-controls="agent-panel" aria-expanded={open} aria-keyshortcuts="Control+J Meta+J" className="agent-panel-toggle" onClick={() => setOpen(!open)} title="Ctrl+J 또는 ⌘J" type="button">AI</button>
    <div className={open ? "agent-panel-layer is-open" : "agent-panel-layer"} inert={!open} ref={layerRef}>
      <button aria-label="에이전트 패널 닫기" className="agent-panel-backdrop" onClick={() => setOpen(false)} type="button" />
      <aside aria-label="AI 에이전트 대화" className="agent-panel" id="agent-panel">
        <header className="agent-panel-head">
          <select className="agent-panel-agent-select" aria-label="에이전트 선택" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            {!agents.length ? <option value="">에이전트 선택</option> : agents.map((agent) => <option value={agent.id} key={agent.id}>{agent.name}</option>)}
          </select>
          <div className="agent-panel-head-actions"><Link className="agent-panel-icon-button" href={selected ? `/agents/${selected.id}` : "/agents"} onClick={() => setOpen(false)} aria-label="에이전트 페이지 열기">↗</Link><button aria-label="패널 닫기" className="agent-panel-icon-button" onClick={() => setOpen(false)} type="button">×</button></div>
        </header>
        {selected ? <AgentChat key={selected.id} agent={selected} /> : <div className="agent-chat-welcome"><h2>함께 일할 에이전트</h2><p>목적과 지침을 정하면 여기서 바로 대화할 수 있어요.</p><Link className="auth-submit" href="/agents?new=1" onClick={() => setOpen(false)}>에이전트 만들기</Link></div>}
      </aside>
    </div>
  </>;
}
