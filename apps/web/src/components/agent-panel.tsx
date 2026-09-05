"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AgentChat, type AgentChatGuardHandle, type ChatAgentItem } from "@/components/agent-chat";
import { AGENT_PANEL_OPEN_STORAGE_KEY, AGENT_PANEL_SELECTED_STORAGE_KEY, agentPanelLayout, agentPanelVisualFrame, isAgentPanelToggleHotkey, parseAgentPanelOpen, serializeAgentPanelOpen } from "@/lib/domain/agent-panel";
import { isEditableHotkeyTarget } from "@/lib/domain/private-navigation";

export type AgentPanelItem = ChatAgentItem;
type AgentPanelLayout = ReturnType<typeof agentPanelLayout>;

export function AgentPanel({ agents }: { agents: AgentPanelItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [layout, setLayout] = useState<AgentPanelLayout>(() => ({ mode: "modal", nav: "bottom" }));
  const layerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const chatRef = useRef<AgentChatGuardHandle>(null);
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
    const navigation = document.querySelector(".private-drawer-layer");
    const sync = () => setLayout(agentPanelLayout(document.documentElement.clientWidth, navigation ? navigation.getAttribute("data-preferred-open") === "true" : localStorage.getItem("coreloom.wide-nav-open") !== "0"));
    sync();
    const observer = navigation ? new MutationObserver(sync) : undefined;
    if (navigation) observer?.observe(navigation, { attributes: true, attributeFilter: ["data-preferred-open"] });
    window.addEventListener("resize", sync);
    return () => { observer?.disconnect(); window.removeEventListener("resize", sync); };
  }, []);
  useEffect(() => {
    if (open && layout.mode === "dock" && layout.nav === "rail") document.documentElement.dataset.agentDockNav = "rail";
    else delete document.documentElement.dataset.agentDockNav;
    return () => { delete document.documentElement.dataset.agentDockNav; };
  }, [layout.mode, layout.nav, open]);
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (document.querySelector(".agent-unsaved-settings-guard[open]")) return;
      if (event.key === "Escape" && (document.querySelector('.private-drawer-layer.is-overlay-mode.is-open, .private-drawer-layer.is-peek') || document.documentElement.dataset.createPanelOpen === "true")) return;
      if (event.key === "Escape" && open && !event.defaultPrevented) { event.preventDefault(); event.stopImmediatePropagation(); setOpen(false); }
      if (isAgentPanelToggleHotkey(event) && !isEditableHotkeyTarget(event.target)) { event.preventDefault(); setOpen((value) => !value); }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [layout.mode, open]);
  useEffect(() => {
    if (!open || layout.mode !== "modal") return;
    const background = [document.querySelector(".private-app-content"), document.querySelector(".private-tabbar"), document.querySelector(".private-drawer-layer"), document.querySelector(".private-menu-button.is-rail")].filter((element): element is Element => Boolean(element));
    const inertBefore = background.map((element) => element.hasAttribute("inert"));
    background.forEach((element) => element.setAttribute("inert", ""));
    const frame = requestAnimationFrame(() => layerRef.current?.querySelector<HTMLElement>(".agent-panel select, .agent-panel button, .agent-panel a, .agent-panel textarea, .agent-panel input")?.focus());
    return () => {
      cancelAnimationFrame(frame);
      background.forEach((element, index) => { if (!inertBefore[index]) element.removeAttribute("inert"); });
      toggleRef.current?.focus();
    };
  }, [layout.mode, open]);
  useEffect(() => {
    if (!open) return;
    function sync() {
      const layer = layerRef.current;
      if (!layer) return;
      const visual = window.visualViewport;
      const frame = agentPanelVisualFrame({ layoutHeight: innerHeight, visualHeight: visual?.height ?? innerHeight, visualOffsetTop: visual?.offsetTop ?? 0, tabBarPx: layout.mode === "modal" ? 0 : undefined, flushTop: layout.mode === "modal" });
      layer.style.setProperty("--agent-vv-top", `${frame.topPx}px`);
      layer.style.setProperty("--agent-vv-height", `${frame.heightPx}px`);
      layer.dataset.keyboard = frame.keyboardOpen ? "1" : "0";
    }
    sync();
    visualViewport?.addEventListener("resize", sync);
    visualViewport?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    return () => { visualViewport?.removeEventListener("resize", sync); visualViewport?.removeEventListener("scroll", sync); window.removeEventListener("resize", sync); };
  }, [layout.mode, open]);

  const modal = layout.mode === "modal";
  return <>
    <button ref={toggleRef} aria-controls="agent-panel" aria-expanded={open} aria-keyshortcuts="Control+J Meta+J" className="agent-panel-toggle" onClick={() => setOpen(!open)} title="Ctrl+J 또는 ⌘J" type="button">AI</button>
    <div className={open ? "agent-panel-layer is-open" : "agent-panel-layer"} data-mode={layout.mode} data-nav={layout.nav} inert={!open} ref={layerRef} onKeyDown={(event) => {
      if ((event.target as Element).closest("dialog[open]") || !modal || event.key !== "Tab") return;
      const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(".agent-panel button:not([disabled]), .agent-panel a[href], .agent-panel select:not([disabled]), .agent-panel textarea:not([disabled]), .agent-panel input:not([disabled]), .agent-panel summary, .agent-panel [tabindex]:not([tabindex='-1'])")).filter((item) => item.offsetParent !== null);
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
      <button aria-label="에이전트 패널 닫기" className="agent-panel-backdrop" onClick={() => setOpen(false)} type="button" />
      <aside aria-label="AI 에이전트 대화" aria-modal={modal || undefined} className="agent-panel" id="agent-panel" role={modal ? "dialog" : undefined}>
        <header className="agent-panel-head">
          <select className="agent-panel-agent-select" aria-label="에이전트 선택" value={selectedId} onChange={(e) => { const nextId = e.target.value; const change = () => { setSettingsDirty(false); setSelectedId(nextId); }; if (chatRef.current) chatRef.current.requestSettingsNavigation(change); else change(); }}>
            {!agents.length ? <option value="">에이전트 선택</option> : agents.map((agent) => <option value={agent.id} key={agent.id}>{agent.name}</option>)}
          </select>
          <div className="agent-panel-head-actions"><Link className="agent-panel-icon-button" href={selected ? `/agents/${selected.id}` : "/agents"} onClick={(event) => { const href = event.currentTarget.getAttribute("href") || "/agents"; if (!chatRef.current) { setOpen(false); return; } event.preventDefault(); chatRef.current.requestSettingsNavigation(() => router.push(href)); }} aria-label="에이전트 페이지 열기">↗</Link><button aria-label="패널 닫기" className="agent-panel-icon-button" onClick={() => setOpen(false)} type="button">×</button></div>
        </header>
        {selected ? <AgentChat key={selected.id} ref={chatRef} agent={selected} active={open} onSettingsDirtyChange={setSettingsDirty} /> : <div className="agent-chat-welcome"><h2>함께 일할 에이전트</h2><p>목적과 지침을 정하면 여기서 바로 대화할 수 있어요.</p><Link className="auth-submit" href="/agents?new=1" onClick={() => setOpen(false)}>에이전트 만들기</Link></div>}
      </aside>
    </div>
  </>;
}
