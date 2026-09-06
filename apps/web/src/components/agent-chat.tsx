"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { readAgentSettingsAction, saveAgentSettingsAction } from "@/app/(private)/agents/actions";
import { agentMessageStatusLabel, chatModels, type ChatMessage, type ChatThread } from "@/lib/domain/agent-chat";
import { agentPanelContextTitle } from "@/lib/domain/agent-panel";
import { type AiAgentModelProvider } from "@/lib/domain/agents";
import { AgentAccessSettings, type AgentAccessGuardHandlers } from "@/components/agent-access-settings";

export type ChatAgentItem = { id: string; name: string; purpose: string; modelProvider: AiAgentModelProvider };
type PendingInput = { draft: string; attachments: string[]; requestId: string };
export type AgentChatGuardHandle = { requestSettingsNavigation: (continueTo: () => void) => void };

export const AgentChat = forwardRef<AgentChatGuardHandle, { agent: ChatAgentItem; active?: boolean; onSettingsDirtyChange?: (dirty: boolean) => void }>(function AgentChat({ agent, active = true, onSettingsDirtyChange }, ref) {
  const pathname = usePathname();
  const router = useRouter();
  const [model, setModel] = useState<string>(chatModels.find((item) => item.provider === agent.modelProvider)?.id || chatModels[0].id);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [threadId, setThreadId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [newReply, setNewReply] = useState(false);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"chat" | "history" | "settings">("chat");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof readAgentSettingsAction>>>();
  const [savedSettings, setSavedSettings] = useState<Awaited<ReturnType<typeof readAgentSettingsAction>>>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"conversation" | "access">("conversation");
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [accessDirty, setAccessDirty] = useState(false);
  const [guardSaving, setGuardSaving] = useState(false);
  const [guardContinue, setGuardContinue] = useState<(() => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef(0);
  const readyRef = useRef(false);
  const uploadRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const followRef = useRef(true);
  const requestRef = useRef<string | undefined>(undefined);
  const inFlightRef = useRef<PendingInput | undefined>(undefined);
  const accessGuardRef = useRef<AgentAccessGuardHandlers | undefined>(undefined);
  const guardDialogRef = useRef<HTMLDialogElement>(null);
  const guardSaveLockRef = useRef(false);
  const conversationSaveLockRef = useRef(false);
  const [guardMessage, setGuardMessage] = useState("");
  const storageKey = `coreloom-chat:${agent.id}`;
  const anySettingsDirty = settingsDirty || accessDirty;

  useEffect(() => {
    onSettingsDirtyChange?.(anySettingsDirty);
    if (!anySettingsDirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const linkGuard = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.origin !== window.location.origin || link.target || link.hasAttribute("download") || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const next = `${link.pathname}${link.search}${link.hash}`;
      event.preventDefault(); event.stopPropagation(); requestSettingsNavigation(() => router.push(next));
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", linkGuard, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", linkGuard, true); };
  }, [anySettingsDirty, onSettingsDirtyChange]);

  async function recover(input: PendingInput, signal: AbortSignal) {
    const deadline = Date.now() + 540_000;
    while (Date.now() < deadline) {
      signal.throwIfAborted();
      const response = await fetch(`/api/agents/chat?agentId=${agent.id}&requestId=${input.requestId}`, { signal });
      if (!response.ok) throw new Error("연결 상태를 확인하지 못했습니다. 다시 열어 결과를 확인해 주세요.");
      const data = await response.json();
      if (data.threadId) { setThreadId(data.threadId); setThreads(data.threads); setMessages(data.messages); }
      const reply = data.messages?.find((row: ChatMessage & { clientRequestId?: string }) => row.role === "assistant" && row.clientRequestId === input.requestId);
      if (!data.running) {
        if (reply?.status === "complete") { requestRef.current = undefined; inFlightRef.current = undefined; setError(""); return; }
        throw new Error(reply?.body || "요청이 완료되지 않았습니다. 입력을 복원했으니 다시 보내 주세요.");
      }
      setError("연결을 복구하며 진행 중인 답변을 확인하고 있습니다.");
      await new Promise<void>((resolve, reject) => {
        const stop = () => { clearTimeout(timer); reject(new Error("연결 확인 종료")); };
        const timer = setTimeout(() => { signal.removeEventListener("abort", stop); resolve(); }, 2000);
        signal.addEventListener("abort", stop, { once: true });
      });
    }
    throw new Error("응답 확인 시간이 초과됐습니다. 대화 이력을 확인해 주세요.");
  }
  async function resume(input: PendingInput) {
    const controller = new AbortController(); abortRef.current = controller; setPending(true);
    try { await recover(input, controller.signal); }
    catch (caught) {
      if (!controller.signal.aborted) { inFlightRef.current = undefined; setDraft(input.draft); setAttachments(input.attachments); setError(caught instanceof Error ? caught.message : "대화 복구에 실패했습니다."); }
    } finally { setPending(false); abortRef.current = null; }
  }

  async function load(id?: string, resetDraft = false) {
    const serial = ++selectionRef.current;
    setLoading(true);
    try {
      const response = await fetch(`/api/agents/chat?agentId=${agent.id}${id ? `&threadId=${id}` : "&fresh=1"}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (serial !== selectionRef.current) return;
      setThreads(data.threads);
      setMessages(data.messages);
      setThreadId(id);
      if (resetDraft) { requestRef.current = undefined; setDraft(""); setAttachments([]); }
      if (id) setModel(data.threads.find((thread: ChatThread) => thread.id === id)?.model || model);
      setView("chat"); setError("");
    } catch { if (serial === selectionRef.current) setError("대화 이력을 불러오지 못했습니다. 다시 열어 주세요."); }
    finally { if (serial === selectionRef.current) setLoading(false); }
  }

  useEffect(() => {
    const controller = new AbortController();
    let restored: { threadId?: string; model?: string; draft?: string; attachments?: string[]; requestId?: string; inFlight?: PendingInput } = {};
    let stored = false;
    try { const raw = sessionStorage.getItem(storageKey); stored = !!raw; restored = JSON.parse(raw || "{}"); } catch { /* Storage is optional. */ }
    void fetch(`/api/agents/chat?agentId=${agent.id}${restored.threadId ? `&threadId=${encodeURIComponent(restored.threadId)}` : stored ? "&fresh=1" : ""}`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((data) => { if (!controller.signal.aborted) {
        setThreads(data.threads); setMessages(data.messages); setThreadId(restored.threadId || data.threadId);
        requestRef.current = restored.requestId;
        if (chatModels.some((item) => item.id === restored.model)) setModel(restored.model!);
        else if (data.threadId) setModel(data.threads.find((item: ChatThread) => item.id === data.threadId)?.model || chatModels[0].id);
        if (typeof restored.draft === "string") setDraft(restored.draft.slice(0, 8000));
        if (Array.isArray(restored.attachments)) setAttachments(restored.attachments.filter((id) => typeof id === "string").slice(0, 6));
        readyRef.current = true;
        if (restored.inFlight?.requestId) {
          inFlightRef.current = restored.inFlight;
          requestRef.current = restored.inFlight.requestId;
          setDraft(""); setAttachments([]);
          void resume(restored.inFlight);
        }
      } })
      .catch(() => { if (!controller.signal.aborted) setError("대화 이력을 불러오지 못했습니다. 다시 열어 주세요."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    void fetch("/api/agents/chat?status=1", { signal: controller.signal }).then((r) => r.json()).then((data) => { if (!controller.signal.aborted) setStatus(data); }).catch(() => {});
    return () => { controller.abort(); abortRef.current?.abort(); };
    // AgentChat is keyed by agent id: conversations never cross agents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!readyRef.current || loading) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify({ threadId, model, draft, attachments, requestId: requestRef.current, inFlight: inFlightRef.current })); } catch { /* Private browsing may disable storage. */ }
  }, [storageKey, threadId, model, draft, attachments, loading, pending]);
  useEffect(() => {
    if (!active || !readyRef.current || abortRef.current) return;
    const frame = requestAnimationFrame(() => {
    try {
      const cached = JSON.parse(sessionStorage.getItem(storageKey) || "null");
      if (!cached) return;
      if (cached.threadId !== threadId) void load(cached.threadId);
      setDraft(typeof cached.draft === "string" ? cached.draft : "");
      setAttachments(Array.isArray(cached.attachments) ? cached.attachments : []);
      if (chatModels.some((item) => item.id === cached.model)) setModel(cached.model);
      requestRef.current = cached.requestId;
    } catch { /* Invalid cached state never grants access. */ }
    });
    return () => cancelAnimationFrame(frame);
    // Only reconcile when the panel becomes visible; edits stay local until persisted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  useEffect(() => {
    if (followRef.current) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  function imageUrl(id: string) { return `/api/agents/chat/images?agentId=${agent.id}&id=${encodeURIComponent(id)}`; }
  async function stopResponse() {
    if (!requestRef.current) return;
    try {
      const response = await fetch("/api/agents/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "stop", agentId: agent.id, requestId: requestRef.current }) });
      if (!response.ok) throw new Error();
      setError("중지 요청을 보냈습니다. 서버 처리 결과를 확인합니다.");
    } catch { setError("중지 요청이 전달되지 않았습니다. 연결을 확인해 주세요."); }
  }
  async function addImages(files: File[]) {
    if (uploadRef.current || abortRef.current || loading) return;
    if (files.length + attachments.length > 6) { setError("이미지는 한 번에 최대 6장입니다."); return; }
    if (files.some((file) => !["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024)) { setError("PNG·JPG·WebP 이미지(장당 8MB 이하)를 선택해 주세요."); return; }
    uploadRef.current = true; setUploading(true); setError("");
    requestRef.current = undefined;
    try {
      for (const file of files) {
        const response = await fetch(`/api/agents/chat/images?agentId=${agent.id}`, { method: "POST", headers: { "Content-Type": file.type }, body: file });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setAttachments((current) => [...current, result.id]);
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "이미지를 올리지 못했습니다. 다시 선택해 주세요."); }
    finally { uploadRef.current = false; setUploading(false); }
  }

  async function openSettings() {
    setView("settings"); setSaved(false); setError("");
    try { const loaded = await readAgentSettingsAction(agent.id); setSettings(loaded); setSavedSettings(loaded); setSettingsDirty(false); }
    catch { setError("지침을 불러오지 못했습니다."); }
  }
  async function saveConversation() {
    if (!settingsDirty || !settings) return true;
    if (conversationSaveLockRef.current) return false;
    conversationSaveLockRef.current = true;
    setSaving(true); setSaved(false);
    try { await saveAgentSettingsAction(agent.id, settings); setModel(chatModels.find((item) => item.provider === settings.modelProvider)?.id || chatModels[0].id); setSavedSettings(settings); setSettingsDirty(false); setSaved(true); return true; }
    catch { setError("지침을 저장하지 못했습니다. 글자 수와 로그인 상태를 확인해 주세요."); return false; }
    finally { conversationSaveLockRef.current = false; setSaving(false); }
  }
  function discardConversation() { if (savedSettings) setSettings(savedSettings); setSettingsDirty(false); setSaved(false); }
  function requestSettingsNavigation(continueTo: () => void) {
    if (!anySettingsDirty) { continueTo(); return; }
    setGuardMessage("");
    setGuardContinue(() => continueTo);
    requestAnimationFrame(() => guardDialogRef.current?.showModal());
  }
  async function saveAndContinue() {
    if (guardSaveLockRef.current) return;
    guardSaveLockRef.current = true;
    setGuardSaving(true);
    const conversationSaved = await saveConversation();
    const accessSaved = conversationSaved && (accessDirty ? await accessGuardRef.current?.save() : true);
    guardSaveLockRef.current = false;
    setGuardSaving(false);
    if (!conversationSaved || !accessSaved) { setGuardMessage("저장하지 못했거나 권한 변경 확인이 취소되었습니다. 초안은 그대로 유지됩니다."); return; }
    guardDialogRef.current?.close(); const continueTo = guardContinue; setGuardContinue(null); continueTo?.();
  }
  function discardAndContinue() {
    if (guardSaveLockRef.current) return;
    discardConversation(); accessGuardRef.current?.discard();
    guardDialogRef.current?.close(); const continueTo = guardContinue; setGuardContinue(null); continueTo?.();
  }
  useImperativeHandle(ref, () => ({ requestSettingsNavigation }), [anySettingsDirty]);

  async function send() {
    if (abortRef.current || uploadRef.current || pending || loading || (!draft.trim() && !attachments.length)) return;
    const text = draft.trim() || "첨부 이미지를 확인해 주세요.";
    const requestId = requestRef.current ||= crypto.randomUUID();
    const input = { draft, attachments, requestId };
    inFlightRef.current = input;
    try { sessionStorage.setItem(storageKey, JSON.stringify({ threadId, model, draft: "", attachments: [], requestId, inFlight: input })); } catch { /* Optional cache. */ }
    const controller = new AbortController();
    abortRef.current = controller;
    setPending(true); setError(""); setDraft(""); setAttachments([]); followRef.current = true;
    const optimisticId = crypto.randomUUID();
    setMessages((rows) => [...rows, { id: optimisticId, role: "user", body: text, model, status: "complete", attachments }]);
    let received = false;
    let receivedMessageId: string | undefined;
    let currentThread = threadId;
    try {
      const response = await fetch("/api/agents/chat", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ agentId: agent.id, threadId, message: text, model, pathname, attachments, requestId }) });
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
          if (event.type === "thread") { currentThread = event.id; setThreadId(event.id); }
          if (event.type === "message") { received = true; receivedMessageId = event.message.id; if (!followRef.current) setNewReply(true); requestRef.current = undefined; inFlightRef.current = undefined; setDraft(""); setAttachments([]); setMessages((rows) => rows.some((row) => row.id === event.message.id) ? rows : [...rows, event.message]); }
          if (event.type === "error") throw new Error(event.error);
        }
        if (done) break;
      }
      if (!received) throw new Error("응답 연결이 끊겼습니다. 대화 이력을 다시 확인해 주세요.");
      const history = await fetch(`/api/agents/chat?agentId=${agent.id}${currentThread ? `&threadId=${currentThread}` : ""}`).then((r) => r.json());
      if (history.threads) setThreads(history.threads);
      if (history.messages?.some((row: ChatMessage) => row.id === receivedMessageId)) setMessages(history.messages);
    } catch (caught) {
      if (!received && !controller.signal.aborted) {
        try { await recover(input, controller.signal); received = true; }
        catch {
          if (!controller.signal.aborted) {
            inFlightRef.current = undefined; setDraft(input.draft); setAttachments(input.attachments);
            setError(caught instanceof Error ? caught.message : "연결이 끊겨 입력을 복원했습니다.");
            setMessages((rows) => rows.filter((row) => row.id !== optimisticId));
          }
        }
      }
    } finally { setPending(false); abortRef.current = null; }
  }

  return <div className="agent-chat" onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); void addImages(Array.from(event.dataTransfer.files)); }}>
    <nav className="agent-chat-toolbar" aria-label="대화 도구">
      <button type="button" onClick={() => requestSettingsNavigation(() => { requestRef.current = undefined; setMessages([]); setThreadId(undefined); setDraft(""); setAttachments([]); setNewReply(false); setError(""); setView("chat"); })} disabled={pending || loading || uploading || guardSaving}>＋ 새 대화</button>
      <button type="button" aria-pressed={view === "history"} onClick={() => requestSettingsNavigation(() => setView(view === "history" ? "chat" : "history"))} disabled={pending || guardSaving}>대화 이력</button>
      <button type="button" aria-pressed={view === "settings"} onClick={() => { if (view === "settings") requestSettingsNavigation(() => setView("chat")); else void openSettings(); }} disabled={pending || guardSaving}>지침 설정</button>
    </nav>
    {view === "settings" ? <div className="agent-chat-scroll">
      <h3>에이전트 설정</h3><p className="form-help">저장하면 이 에이전트의 다음 답변부터 적용됩니다.</p>
      <div className="agent-settings-tabs" role="tablist" aria-label="에이전트 설정"><button aria-selected={settingsTab === "conversation"} onClick={() => setSettingsTab("conversation")} role="tab" type="button">대화 방식</button><button aria-selected={settingsTab === "access"} onClick={() => setSettingsTab("access")} role="tab" type="button">자료 접근</button></div>
      {settingsTab === "conversation" && settings ? <form className="agent-chat-settings" onSubmit={(event) => { event.preventDefault(); void saveConversation(); }}>
        {([ ["workStyle", "일하는 방식", 2000], ["answerStyle", "답변 방식", 2000] ] as const).map(([key, label, max]) => <label key={key}>{label}<textarea disabled={saving || guardSaving} maxLength={max} rows={3} value={settings[key]} onChange={(e) => { setSettings({ ...settings, [key]: e.target.value }); setSettingsDirty(true); setSaved(false); }} /></label>)}
        <details className="agent-settings-advanced"><summary>고급 설정</summary>{([ ["procedure", "진행 절차", 4000], ["instructions", "추가 지침", 8000] ] as const).map(([key, label, max]) => <label key={key}>{label}<textarea disabled={saving || guardSaving} maxLength={max} rows={key === "instructions" ? 6 : 3} value={settings[key]} onChange={(e) => { setSettings({ ...settings, [key]: e.target.value }); setSettingsDirty(true); setSaved(false); }} /></label>)}</details>
        <label>기본 구독<select disabled={saving || guardSaving} value={settings.modelProvider} onChange={(e) => { setSettings({ ...settings, modelProvider: e.target.value as AiAgentModelProvider }); setSettingsDirty(true); }}><option value="gpt_codex_subscription">GPT·Codex</option><option value="claude_subscription">Claude</option><option value="cursor_agent">Cursor · 직접 연결 준비 전</option></select></label>
        <button className="auth-submit" disabled={saving}>{saving ? "저장 중…" : "지침 저장"}</button>
        {saved ? <p role="status">저장했습니다. 다음 답변에 적용됩니다.</p> : null}
      </form> : settingsTab === "conversation" ? <p role="status">지침을 불러오는 중…</p> : null}
      <div hidden={settingsTab !== "access"}><AgentAccessSettings agentId={agent.id} onDirty={setAccessDirty} onGuardHandlers={(handlers) => { accessGuardRef.current = handlers; }} /></div>
    </div> : view === "history" ? <div className="agent-chat-scroll"><h3>이전 대화</h3>{threads.length ? threads.map((thread) => <button className="agent-chat-history-item" type="button" key={thread.id} onClick={() => void load(thread.id, true)}><strong>{thread.title}</strong><span>{chatModels.find((m) => m.id === thread.model)?.label || thread.model}</span></button>) : <p className="form-help">첫 메시지를 보내면 대화가 여기에 남습니다.</p>}</div> : <>
      <div className="agent-chat-scroll" ref={scrollRef} onScroll={(event) => { const node = event.currentTarget; followRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80; if (followRef.current) setNewReply(false); }} role="log" aria-label="대화 메시지" aria-live="polite" aria-busy={pending}>
        {loading ? <p role="status">대화를 불러오는 중…</p> : messages.length === 0 ? <div className="agent-chat-welcome"><span className="agent-chat-avatar" aria-hidden="true">✳</span><h2>무엇을 함께 할까요?</h2><p>{agent.purpose}</p><div className="agent-chat-prompts">{["생각을 정리하고 싶어요", "업무 초안을 같이 작성해요", "부족한 정보를 먼저 질문해 주세요"].map((text) => <button type="button" key={text} onClick={() => { requestRef.current = undefined; inFlightRef.current = undefined; setDraft(text); }}>{text}</button>)}</div></div> : messages.map((message) => { const messageStatus = agentMessageStatusLabel(message); return <article className={`agent-chat-message is-${message.role}`} key={message.id}><span className="agent-chat-message-label">{message.role === "user" ? "나" : agent.name}</span><div>{message.body}</div>{messageStatus ? <p className={`agent-chat-message-status is-${messageStatus.tone}`}>{messageStatus.label}</p> : null}<div className="agent-chat-attachments">{message.attachments?.map((id, index) => <a key={id} href={imageUrl(id)} target="_blank" rel="noreferrer"><Image unoptimized width={96} height={96} src={imageUrl(id)} alt={`보낸 이미지 ${index + 1}`} /></a>)}</div>{message.body ? <button type="button" className="agent-chat-copy" onClick={() => { void navigator.clipboard.writeText(message.body).then(() => setCopied(message.id)).catch(() => setError("복사하지 못했습니다.")); }}>{copied === message.id ? "복사됨" : message.role === "user" ? "메시지 복사" : "답변 복사"}</button> : null}</article>; })}
        {pending ? <p className="agent-chat-waiting" role="status">답변을 생각하고 있어요…</p> : null}
      </div>
      {newReply ? <button type="button" className="agent-chat-latest" onClick={() => { followRef.current = true; setNewReply(false); scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }}>새 답변 보기 ↓</button> : null}
      <form className="agent-chat-composer" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <input ref={fileRef} type="file" aria-label="이미지 선택" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(event) => { void addImages(Array.from(event.target.files || [])); event.target.value = ""; }} />
        <div className="agent-chat-attachments">{attachments.map((id, index) => <div key={id}><Image unoptimized width={96} height={96} src={imageUrl(id)} alt={`첨부 이미지 ${index + 1}`} /><button type="button" aria-label={`이미지 ${index + 1} 제거`} disabled={pending || uploading} onClick={() => { requestRef.current = undefined; setAttachments((current) => current.filter((item) => item !== id)); }}>제거</button></div>)}</div>
        {uploading ? <p role="status">이미지를 올리는 중…</p> : null}
        <div className="agent-chat-input-shell"><textarea aria-label="메시지" disabled={pending || loading} maxLength={8000} rows={2} placeholder={`${agent.name}에게 메시지 보내기`} value={draft} onChange={(e) => { requestRef.current = undefined; setDraft(e.target.value); }} onPaste={(event) => { const files = Array.from(event.clipboardData.files); if (files.length) { event.preventDefault(); void addImages(files); } }} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !window.matchMedia?.("(pointer: coarse)").matches) { e.preventDefault(); void send(); } }} />
          <div className="agent-chat-input-tools"><button type="button" aria-label="이미지 추가" className="agent-chat-attach" disabled={pending || loading || uploading || attachments.length >= 6} onClick={() => fileRef.current?.click()}>＋ 이미지</button><select aria-label="대화 모델" value={model} disabled={pending} onChange={(e) => setModel(e.target.value)}>{chatModels.map((item) => <option key={item.id} value={item.id}>{item.label}{status[item.provider] === false ? " · 연결 필요" : ""}</option>)}</select>{pending ? <button type="button" aria-label="응답 중지" onClick={() => void stopResponse()}>■</button> : <button type="submit" aria-label="메시지 보내기" disabled={(!draft.trim() && !attachments.length) || loading || uploading}>↑</button>}</div>
        </div>
        <p className="agent-chat-caption">{agentPanelContextTitle(pathname)} · 구독 한도 사용 · 지침 설정에서 허용한 자료만 조회</p>
      </form>
    </>}
    {error ? <p className="agent-chat-error" role="alert">{error}</p> : null}
    {guardContinue && typeof document !== "undefined" ? createPortal(<dialog aria-label="저장하지 않은 설정" className="agent-unsaved-settings-guard" onCancel={(event) => { event.preventDefault(); if (!guardSaving) { guardDialogRef.current?.close(); setGuardContinue(null); } }} ref={guardDialogRef}>
      <h2>저장하지 않은 설정</h2><p>변경한 대화 방식이나 자료 접근 설정이 있습니다.</p>
      {guardMessage ? <p role="alert">{guardMessage}</p> : null}
      <div className="agent-unsaved-settings-guard-actions"><button disabled={guardSaving} onClick={() => void saveAndContinue()} type="button">{guardSaving ? "저장 중…" : "저장하고 계속"}</button><button disabled={guardSaving} onClick={discardAndContinue} type="button">버리고 계속</button><button disabled={guardSaving} onClick={() => { guardDialogRef.current?.close(); setGuardContinue(null); }} type="button">계속 편집</button></div>
    </dialog>, document.body) : null}
  </div>;
});
