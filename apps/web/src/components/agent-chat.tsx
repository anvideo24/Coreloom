"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { readAgentSettingsAction, saveAgentSettingsAction } from "@/app/(private)/agents/actions";
import { chatModels, type ChatMessage, type ChatThread } from "@/lib/domain/agent-chat";
import { agentPanelContextTitle } from "@/lib/domain/agent-panel";
import { type AiAgentModelProvider } from "@/lib/domain/agents";

export type ChatAgentItem = { id: string; name: string; purpose: string; modelProvider: AiAgentModelProvider };

export function AgentChat({ agent }: { agent: ChatAgentItem }) {
  const pathname = usePathname();
  const [model, setModel] = useState<string>(chatModels.find((item) => item.provider === agent.modelProvider)?.id || chatModels[0].id);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [threadId, setThreadId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"chat" | "history" | "settings">("chat");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof readAgentSettingsAction>>>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef(0);

  async function load(id?: string) {
    const serial = ++selectionRef.current;
    setLoading(true);
    try {
      const response = await fetch(`/api/agents/chat?agentId=${agent.id}${id ? `&threadId=${id}` : ""}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (serial !== selectionRef.current) return;
      setThreads(data.threads);
      setMessages(data.messages);
      setThreadId(id);
      if (id) setModel(data.threads.find((thread: ChatThread) => thread.id === id)?.model || model);
      setView("chat"); setError("");
    } catch { if (serial === selectionRef.current) setError("대화 이력을 불러오지 못했습니다. 다시 열어 주세요."); }
    finally { if (serial === selectionRef.current) setLoading(false); }
  }

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/agents/chat?agentId=${agent.id}`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((data) => { if (!controller.signal.aborted) { setThreads(data.threads); setMessages(data.messages); } })
      .catch(() => { if (!controller.signal.aborted) setError("대화 이력을 불러오지 못했습니다. 다시 열어 주세요."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    void fetch("/api/agents/chat?status=1", { signal: controller.signal }).then((r) => r.json()).then((data) => { if (!controller.signal.aborted) setStatus(data); }).catch(() => {});
    return () => { controller.abort(); abortRef.current?.abort(); };
    // AgentChat is keyed by agent id: conversations never cross agents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, pending]);

  async function openSettings() {
    setView("settings"); setSaved(false); setError("");
    try { setSettings(await readAgentSettingsAction(agent.id)); }
    catch { setError("지침을 불러오지 못했습니다."); }
  }

  async function send() {
    if (pending || loading || !draft.trim()) return;
    const text = draft.trim();
    const controller = new AbortController();
    abortRef.current = controller;
    setPending(true); setError(""); setDraft("");
    setMessages((rows) => [...rows, { id: crypto.randomUUID(), role: "user", body: text, model, status: "complete" }]);
    let received = false;
    try {
      const response = await fetch("/api/agents/chat", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ agentId: agent.id, threadId, message: text, model, pathname }) });
      if (!response.ok || !response.body) throw new Error("요청을 보낼 수 없습니다. 로그인 상태를 확인해 주세요.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n"); buffer = lines.pop() || "";
        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line);
          if (event.type === "thread") setThreadId(event.id);
          if (event.type === "message") { received = true; setMessages((rows) => [...rows, event.message]); }
          if (event.type === "error") throw new Error(event.error);
        }
        if (done) break;
      }
      if (!received) throw new Error("응답 연결이 끊겼습니다. 대화 이력을 다시 확인해 주세요.");
      const history = await fetch(`/api/agents/chat?agentId=${agent.id}`).then((r) => r.json());
      if (history.threads) setThreads(history.threads);
    } catch (caught) {
      setError(controller.signal.aborted ? "응답을 중지했습니다." : caught instanceof Error ? caught.message : "응답에 실패했습니다.");
      if (!received) setDraft(text);
    } finally { setPending(false); abortRef.current = null; }
  }

  return <div className="agent-chat">
    <nav className="agent-chat-toolbar" aria-label="대화 도구">
      <button type="button" onClick={() => { setView("chat"); setMessages([]); setThreadId(undefined); setDraft(""); setError(""); }} disabled={pending || loading}>＋ 새 대화</button>
      <button type="button" aria-pressed={view === "history"} onClick={() => setView(view === "history" ? "chat" : "history")} disabled={pending}>대화 이력</button>
      <button type="button" aria-pressed={view === "settings"} onClick={() => { if (view === "settings") setView("chat"); else void openSettings(); }} disabled={pending}>지침 설정</button>
    </nav>
    {view === "settings" ? <div className="agent-chat-scroll">
      <h3>에이전트 지침</h3><p className="form-help">저장하면 이 에이전트의 다음 답변부터 적용됩니다.</p>
      {settings ? <form className="agent-chat-settings" onSubmit={async (event) => {
        event.preventDefault(); setSaving(true); setSaved(false);
        try { await saveAgentSettingsAction(agent.id, settings); setModel(chatModels.find((item) => item.provider === settings.modelProvider)?.id || chatModels[0].id); setSaved(true); }
        catch { setError("지침을 저장하지 못했습니다. 글자 수와 로그인 상태를 확인해 주세요."); }
        finally { setSaving(false); }
      }}>
        {([ ["workStyle", "일하는 방식", 2000], ["answerStyle", "답변 방식", 2000], ["procedure", "진행 절차", 4000], ["instructions", "추가 지침", 8000] ] as const).map(([key, label, max]) => <label key={key}>{label}<textarea maxLength={max} rows={key === "instructions" ? 6 : 3} value={settings[key]} onChange={(e) => { setSettings({ ...settings, [key]: e.target.value }); setSaved(false); }} /></label>)}
        <label>기본 구독<select value={settings.modelProvider} onChange={(e) => setSettings({ ...settings, modelProvider: e.target.value as AiAgentModelProvider })}><option value="gpt_codex_subscription">GPT·Codex</option><option value="claude_subscription">Claude</option><option value="cursor_agent">Cursor · 직접 연결 준비 전</option></select></label>
        <button className="auth-submit" disabled={saving}>{saving ? "저장 중…" : "지침 저장"}</button>
        {saved ? <p role="status">저장했습니다. 다음 답변에 적용됩니다.</p> : null}
      </form> : <p role="status">지침을 불러오는 중…</p>}
    </div> : view === "history" ? <div className="agent-chat-scroll"><h3>이전 대화</h3>{threads.length ? threads.map((thread) => <button className="agent-chat-history-item" type="button" key={thread.id} onClick={() => void load(thread.id)}><strong>{thread.title}</strong><span>{chatModels.find((m) => m.id === thread.model)?.label || thread.model}</span></button>) : <p className="form-help">첫 메시지를 보내면 대화가 여기에 남습니다.</p>}</div> : <>
      <div className="agent-chat-scroll" ref={scrollRef} role="log" aria-label="대화 메시지" aria-live="polite" aria-busy={pending}>
        {loading ? <p role="status">대화를 불러오는 중…</p> : messages.length === 0 ? <div className="agent-chat-welcome"><span className="agent-chat-avatar" aria-hidden="true">✳</span><h2>무엇을 함께 할까요?</h2><p>{agent.purpose}</p><div className="agent-chat-prompts">{["생각을 정리하고 싶어요", "업무 초안을 같이 작성해요", "부족한 정보를 먼저 질문해 주세요"].map((text) => <button type="button" key={text} onClick={() => setDraft(text)}>{text}</button>)}</div></div> : messages.map((message) => <article className={`agent-chat-message is-${message.role}`} key={message.id}><span className="agent-chat-message-label">{message.role === "user" ? "나" : agent.name}</span><div>{message.body}</div>{message.role === "assistant" && message.status === "complete" ? <button type="button" className="agent-chat-copy" onClick={() => { void navigator.clipboard.writeText(message.body).then(() => setCopied(message.id)).catch(() => setError("복사하지 못했습니다.")); }}>{copied === message.id ? "복사됨" : "답변 복사"}</button> : null}</article>)}
        {pending ? <p className="agent-chat-waiting" role="status">답변을 생각하고 있어요…</p> : null}
      </div>
      <form className="agent-chat-composer" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <div className="agent-chat-input-shell"><textarea aria-label="메시지" maxLength={8000} rows={3} placeholder={`${agent.name}에게 메시지 보내기`} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
          <div className="agent-chat-input-tools"><select aria-label="대화 모델" value={model} disabled={pending} onChange={(e) => setModel(e.target.value)}>{chatModels.map((item) => <option key={item.id} value={item.id}>{item.label}{status[item.provider] === false ? " · 연결 필요" : ""}</option>)}</select>{pending ? <button type="button" aria-label="응답 중지" onClick={() => abortRef.current?.abort()}>■</button> : <button type="submit" aria-label="메시지 보내기" disabled={!draft.trim() || loading}>↑</button>}</div>
        </div>
        <p className="agent-chat-caption">{agentPanelContextTitle(pathname)} · 구독 한도 사용 · 화면 데이터는 자동 전송되지 않아요</p>
      </form>
    </>}
    {error ? <p className="agent-chat-error" role="alert">{error}</p> : null}
  </div>;
}
