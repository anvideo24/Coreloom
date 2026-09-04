"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";

import {
  AGENT_PANEL_OPEN_STORAGE_KEY,
  AGENT_PANEL_SELECTED_STORAGE_KEY,
  agentPanelContextTitle,
  isAgentPanelToggleHotkey,
  parseAgentPanelOpen,
  serializeAgentPanelOpen,
} from "@/lib/domain/agent-panel";
import { aiAgentModelProviderLabels, type AiAgentModelProvider } from "@/lib/domain/agents";
import { isEditableHotkeyTarget } from "@/lib/domain/private-navigation";

export type AgentPanelItem = {
  id: string;
  name: string;
  purpose: string;
  modelProvider: AiAgentModelProvider;
};

export function AgentPanel({ agents }: { agents: AgentPanelItem[] }) {
  const pathname = usePathname();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const contextTitle = agentPanelContextTitle(pathname);

  useEffect(() => {
    setOpen(parseAgentPanelOpen(window.localStorage.getItem(AGENT_PANEL_OPEN_STORAGE_KEY)));
    const stored = window.localStorage.getItem(AGENT_PANEL_SELECTED_STORAGE_KEY) ?? "";
    const exists = agents.some((agent) => agent.id === stored);
    setSelectedId(exists ? stored : agents[0]?.id ?? "");
    setReady(true);
  }, [agents]);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(AGENT_PANEL_OPEN_STORAGE_KEY, serializeAgentPanelOpen(open));
  }, [open, ready]);

  useEffect(() => {
    if (!selectedId) return;
    window.localStorage.setItem(AGENT_PANEL_SELECTED_STORAGE_KEY, selectedId);
  }, [selectedId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPickerOpen(false);
        setOpen(false);
        return;
      }
      if (!isAgentPanelToggleHotkey(event) || isEditableHotkeyTarget(event.target)) return;
      event.preventDefault();
      setOpen((value) => !value);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selected = useMemo(
    () => agents.find((agent) => agent.id === selectedId) ?? null,
    [agents, selectedId],
  );

  function toggle() {
    setOpen((value) => !value);
  }

  return (
    <>
      <button
        aria-controls="agent-panel"
        aria-expanded={open}
        aria-keyshortcuts="Control+J Meta+J"
        className="agent-panel-toggle"
        onClick={toggle}
        title="Ctrl+J 또는 ⌘J"
        type="button"
      >
        AI
      </button>

      <div className={open ? "agent-panel-layer is-open" : "agent-panel-layer"} inert={!open}>
        <aside aria-labelledby={titleId} className="agent-panel" id="agent-panel">
          <div className="agent-panel-head">
            <div className="agent-panel-picker">
              <button
                aria-expanded={pickerOpen}
                className="agent-panel-picker-button"
                id={titleId}
                onClick={() => setPickerOpen((value) => !value)}
                type="button"
              >
                {selected?.name ?? "에이전트 선택"}
                <span aria-hidden="true">▾</span>
              </button>
              {pickerOpen ? (
                <div className="agent-panel-picker-menu" role="listbox">
                  {agents.length === 0 ? (
                    <p className="agent-panel-empty">등록된 활성 에이전트가 없습니다.</p>
                  ) : (
                    agents.map((agent) => (
                      <button
                        className={agent.id === selectedId ? "is-selected" : undefined}
                        key={agent.id}
                        onClick={() => {
                          setSelectedId(agent.id);
                          setPickerOpen(false);
                        }}
                        role="option"
                        type="button"
                      >
                        <strong>{agent.name}</strong>
                        <span>{aiAgentModelProviderLabels[agent.modelProvider]}</span>
                      </button>
                    ))
                  )}
                  <Link className="agent-panel-create-link" href="/agents?new=1" onClick={() => setPickerOpen(false)}>
                    커스텀 에이전트 만들기
                  </Link>
                </div>
              ) : null}
            </div>
            <div className="agent-panel-head-actions">
              <button
                aria-label="새 대화"
                className="agent-panel-icon-button"
                onClick={() => setDraft("")}
                type="button"
              >
                +
              </button>
              <button
                aria-label="패널 닫기"
                className="agent-panel-icon-button"
                onClick={() => setOpen(false)}
                type="button"
              >
                »
              </button>
            </div>
          </div>

          <div className="agent-panel-body">
            <div className="agent-panel-hero">
              <div aria-hidden="true" className="agent-panel-avatar">AI</div>
              <h2>{selected ? `${selected.name}에게 무엇을 맡길까요?` : "어떤 도움이 필요하세요?"}</h2>
              <p>{selected?.purpose ?? "에이전트 페이지에서 시스템 계정을 만들면 여기에서 고를 수 있습니다."}</p>
            </div>
            <ul className="agent-panel-suggestions">
              <li>
                <Link href="/agents?new=1">커스텀 에이전트 만들기</Link>
              </li>
              <li>
                <button
                  onClick={() => setDraft(`${contextTitle} 화면을 기준으로 지금 할 일을 정리해 주세요.`)}
                  type="button"
                >
                  이 페이지 기준으로 할 일 정리
                </button>
              </li>
              {pathname.startsWith("/quotes") ? (
                <li>
                  <button
                    onClick={() => setDraft("프로젝트 배경을 듣고 견적 초안(항목·부가세·내부 원가 관점)을 제안해 주세요.")}
                    type="button"
                  >
                    견적 초안 문답 시작
                  </button>
                </li>
              ) : null}
            </ul>
          </div>

          <form
            className="agent-panel-composer"
            onSubmit={(event) => {
              event.preventDefault();
              setDraft("");
            }}
          >
            <div className="agent-panel-context-chip" title={pathname}>
              {contextTitle}
            </div>
            <textarea
              onChange={(event) => setDraft(event.target.value)}
              placeholder="AI로 무엇이든 시도해 보세요…"
              rows={3}
              value={draft}
            />
            <div className="agent-panel-composer-bar">
              <span className="agent-panel-model">
                {selected ? aiAgentModelProviderLabels[selected.modelProvider] : "모델 미선택"}
              </span>
              <button
                aria-label="보내기"
                className="agent-panel-send"
                disabled={!draft.trim() || !selected}
                type="submit"
              >
                ↑
              </button>
            </div>
          </form>
          <p className="agent-panel-footnote">
            구독 모델 연결·실행은 이어집니다. 지금은 에이전트 선택과 화면 컨텍스트만 연결합니다.
          </p>
        </aside>
      </div>
    </>
  );
}
