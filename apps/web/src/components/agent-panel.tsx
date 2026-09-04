"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useMemo, useState, useTransition } from "react";

import { invokeAgentFromPanelAction } from "@/app/(private)/agents/actions";
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

type PanelMessage = {
  id: string;
  role: "user" | "assistant";
  body: string;
  packageText?: string;
  handoffHint?: string;
  workLogHref?: string;
};

export function AgentPanel({ agents }: { agents: AgentPanelItem[] }) {
  const pathname = usePathname();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<PanelMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
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

  function clearThread() {
    setDraft("");
    setMessages([]);
    setError(null);
  }

  function copyPackage(text: string) {
    void navigator.clipboard.writeText(text);
  }

  function send() {
    if (!selected || !draft.trim() || pending) return;
    const message = draft.trim();
    setDraft("");
    setError(null);
    setMessages((rows) => [
      ...rows,
      { id: `user-${Date.now()}`, role: "user", body: message },
    ]);
    startTransition(async () => {
      try {
        const result = await invokeAgentFromPanelAction({
          agentId: selected.id,
          message,
          pathname,
        });
        setMessages((rows) => [
          ...rows,
          {
            id: result.workLogId,
            role: "assistant",
            body: `${result.handoffHint}\n\n작업 이력이 승인 대기로 남았습니다.`,
            packageText: result.packageText,
            handoffHint: result.handoffLabel,
            workLogHref: `/agents/${result.agentId}`,
          },
        ]);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "요청을 남기지 못했습니다.");
      }
    });
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
                onClick={clearThread}
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
            {messages.length === 0 ? (
              <>
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
              </>
            ) : (
              <div className="agent-panel-thread" aria-live="polite">
                {messages.map((message) => (
                  <article className={`agent-panel-message is-${message.role}`} key={message.id}>
                    <p>{message.body}</p>
                    {message.packageText ? (
                      <div className="agent-panel-package">
                        <pre>{message.packageText}</pre>
                        <div className="agent-panel-package-actions">
                          <button onClick={() => copyPackage(message.packageText ?? "")} type="button">
                            구독 패키지 복사
                          </button>
                          {message.workLogHref ? (
                            <Link href={message.workLogHref}>이력 보기</Link>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </article>
                ))}
                {pending ? <p className="form-help">구독 패키지를 준비하는 중…</p> : null}
              </div>
            )}
            {error ? <p className="form-help agent-panel-error">{error}</p> : null}
          </div>

          <form
            className="agent-panel-composer"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <div className="agent-panel-context-chip" title={pathname}>
              {contextTitle}
            </div>
            <textarea
              onChange={(event) => setDraft(event.target.value)}
              placeholder="요청을 적고 구독 패키지를 만드세요…"
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
                disabled={!draft.trim() || !selected || pending}
                type="submit"
              >
                ↑
              </button>
            </div>
          </form>
          <p className="agent-panel-footnote">
            보내면 구독 자리에 붙일 패키지를 만들고 작업 이력을 남깁니다. API 키 호출·자동 실행은 하지 않습니다.
          </p>
        </aside>
      </div>
    </>
  );
}
