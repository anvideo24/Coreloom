"use client";
import { useEffect, useRef, useState } from "react";
import { readAgentAccessAction, saveAgentAccessAction } from "@/app/(private)/agents/actions";
import { accessLabels } from "@/lib/domain/agent-access";
import { AgentFolderPicker, normalizeFolderSelections } from "@/components/agent-folder-picker";

export type AgentAccessGuardHandlers = { save: () => Promise<boolean>; discard: () => void };

export function AgentAccessSettings({ agentId, onDirty, onGuardHandlers }: { agentId: string; onDirty?: (dirty: boolean) => void; onGuardHandlers?: (handlers: AgentAccessGuardHandlers) => void }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof readAgentAccessAction>>>();
  const [savedPermissions, setSavedPermissions] = useState<Record<string, boolean>>({});
  const [savedRoots, setSavedRoots] = useState<string[]>([]);
  const [roots, setRoots] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const saveLockRef = useRef(false);
  useEffect(() => {
    let active = true;
    void readAgentAccessAction(agentId).then((result) => { if (active) { setData(result); setSavedPermissions(result.permissions); setSavedRoots(result.roots); setRoots(result.roots.join("\n")); } }).catch(() => { if (active) setNotice("권한 설정을 읽지 못했습니다."); });
    return () => { active = false; };
  }, [agentId]);
  const save = async () => {
    if (!data) return true;
    if (saveLockRef.current) return false;
    saveLockRef.current = true;
    const newlyEnabled = Object.entries(data.permissions).filter(([key, enabled]) => enabled && !savedPermissions[key]).map(([key]) => accessLabels[key as keyof typeof accessLabels]);
    const nextRoots = normalizeFolderSelections(roots.split(/\r?\n/));
    const newlyAddedRootCount = data.permissions.read_pc ? nextRoots.filter((root) => !savedRoots.includes(root)).length : 0;
    const expansion = [newlyEnabled.length ? `새로 허용할 자료: ${newlyEnabled.join(", ")}` : "", newlyAddedRootCount ? `새로 허용할 업무 폴더: ${newlyAddedRootCount}개` : ""].filter(Boolean);
    if (expansion.length && !window.confirm(`${expansion.join("\n")}\n이 범위만 다음 요청부터 조회할 수 있습니다. 저장할까요?`)) { saveLockRef.current = false; return false; }
    setBusy(true); setNotice("");
    try { await saveAgentAccessAction(agentId, { permissions: data.permissions, roots: nextRoots }); setSavedPermissions(data.permissions); setSavedRoots(nextRoots); onDirty?.(false); setNotice("조회 권한을 저장했습니다. 다음 요청부터 적용됩니다."); return true; }
    catch { setNotice("저장하지 못했습니다. 경로·로그인을 확인하세요. PC 조회는 안전을 위해 꺼졌을 수 있습니다."); return false; }
    finally { saveLockRef.current = false; setBusy(false); }
  };
  const discard = () => { if (data) setData({ ...data, permissions: savedPermissions as typeof data.permissions }); setRoots(savedRoots.join("\n")); onDirty?.(false); };
  useEffect(() => { onGuardHandlers?.({ save, discard }); }, [data, onGuardHandlers, roots, savedPermissions, savedRoots]);
  return <section className="agent-access-settings" aria-label="에이전트 조회 권한">
    <h3>자료 조회 권한</h3>
    <p className="form-help">켜 둔 항목만 읽습니다. 조회한 자료는 선택한 구독 모델에 전달되며, 답변과 출처가 대화에 저장됩니다. 권한을 꺼도 이미 저장한 대화는 지워지지 않습니다.</p>
    {data ? <form className="agent-chat-settings" onSubmit={async (event) => {
      event.preventDefault(); await save();
    }}>
      <fieldset disabled={busy}><legend>허용할 자료</legend>{Object.entries(accessLabels).map(([key, label]) => <label className="agent-access-option" key={key}><input type="checkbox" checked={data.permissions[key as keyof typeof data.permissions]} onChange={(event) => { setData({ ...data, permissions: { ...data.permissions, [key]: event.target.checked } }); onDirty?.(true); }} />{label}</label>)}</fieldset>
      <AgentFolderPicker agentId={agentId} roots={normalizeFolderSelections(roots.split(/\r?\n/))} disabled={busy} onRootsChange={(next) => { setRoots(next.join("\n")); onDirty?.(true); }} />
      <details><summary>직접 경로 입력 (고급)</summary><label>서버 PC의 허용 폴더<textarea rows={3} value={roots} onChange={(e) => { setRoots(e.target.value); onDirty?.(true); }} placeholder="서버 PC 폴더의 절대 경로를 한 줄에 하나씩 입력" disabled={busy} /></label></details>
      <p className="form-help">최대 8개 폴더. TXT·MD·CSV·JSON, 64KB 이하. 파일명으로 검색합니다. PDF·이미지 해석, 드라이브 전체·홈 전체·비밀 폴더·링크 경로는 지원하지 않습니다. 폴더 경로는 이 PC에만 저장됩니다.</p>
      <p className="form-help">프로젝트가 지정된 에이전트는 해당 프로젝트만 조회합니다. 앱·구독 사업 전용 에이전트의 고객사 ERP 조회는 차단됩니다. 수정·삭제·외부 발송은 이 대화에서 실행할 수 없습니다.</p>
      <button className="auth-submit" disabled={busy}>{busy ? "저장 중…" : "조회 권한 저장"}</button>
    </form> : <p>설정을 불러오는 중…</p>}
    {notice ? <p role="status">{notice}</p> : null}
    {data?.recent.length ? <details><summary>최근 자료 조회 기록</summary><ul>{data.recent.map((entry, i) => <li key={i}>{entry.at} · {String((entry.payload as Record<string, unknown>).tool)} · {String((entry.payload as Record<string, unknown>).status)}</li>)}</ul></details> : null}
  </section>;
}
