"use client";

import { useEffect, useRef, useState } from "react";

import { browseAgentFoldersAction } from "@/app/(private)/agents/folder-actions";
import styles from "./agent-folder-picker.module.css";

type FolderView = Awaited<ReturnType<typeof browseAgentFoldersAction>>;

function folderName(path: string) {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) || path;
}

export function folderSelectionKey(path: string) {
  const trimmed = path.trim();
  if (!/^[a-z]:[\\/]/i.test(trimmed)) return trimmed;
  const normalized = trimmed.replace(/\//g, "\\").replace(/\\+$/g, "");
  return normalized.toLowerCase();
}

export function normalizeFolderSelections(roots: string[]) {
  const seen = new Set<string>();
  return roots.map((root) => root.trim()).filter((root) => {
    if (!root) return false;
    const key = folderSelectionKey(root);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

type FolderPickerProps = {
  agentId: string;
  roots: string[];
  onRootsChange: (roots: string[]) => void;
  disabled?: boolean;
};

export function AgentFolderPicker(props: FolderPickerProps) {
  return <FolderPicker key={props.agentId} {...props} />;
}

function FolderPicker({ agentId, roots, onRootsChange, disabled = false }: FolderPickerProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<FolderView>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(0);
  const busyRef = useRef(false);
  const failedFolderRef = useRef<string | null>(null);
  const selectedRoots = normalizeFolderSelections(roots);

  useEffect(() => {
    return () => { requestRef.current += 1; };
  }, []);

  async function browse(folder: string | null) {
    if (disabled || busyRef.current) return;
    const request = ++requestRef.current;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const next = await browseAgentFoldersAction(agentId, folder);
      if (request === requestRef.current) { setView(next); failedFolderRef.current = null; }
    } catch {
      if (request === requestRef.current) { failedFolderRef.current = folder; setError("폴더를 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요."); }
    } finally {
      if (request === requestRef.current) { busyRef.current = false; setBusy(false); }
    }
  }

  function close() {
    requestRef.current += 1;
    busyRef.current = false; setOpen(false); setBusy(false); setError("");
  }

  return <section className={styles.picker} aria-label="서버 PC 업무 폴더 선택">
    <div className={styles.heading}>
      <div><strong>허용할 업무 폴더</strong><p>지금 사용 중인 기기가 아니라 Coreloom이 실행되는 서버 PC에서 고릅니다.</p></div>
      <button className={styles.button} type="button" disabled={disabled || busy} onClick={() => { setOpen(true); void browse(null); }}>폴더 선택</button>
    </div>

    {selectedRoots.length ? <ul className={styles.selected} aria-label="추가할 업무 폴더">
      {selectedRoots.map((root) => <li key={folderSelectionKey(root)}><span><strong>{folderName(root)}</strong><small title={root}>{root}</small></span><button type="button" disabled={disabled || busy} onClick={() => { if (!disabled && !busy) onRootsChange(selectedRoots.filter((item) => folderSelectionKey(item) !== folderSelectionKey(root))); }}>제거</button></li>)}
    </ul> : <p className={styles.empty}>추가할 폴더가 없습니다.</p>}

    {open ? <div className={styles.browser}>
      <div className={styles.browserHead}><strong>{view?.label || "시작 위치"}</strong><button type="button" onClick={close}>닫기</button></div>
      {busy ? <p role="status">폴더를 불러오는 중…</p> : null}
      {error ? <div role="alert" className={styles.error}><p>{error}</p><button type="button" disabled={disabled || busy} onClick={() => void browse(failedFolderRef.current)}>다시 시도</button></div> : null}
      {!busy && !error && view ? <>
        <div className={styles.actions}>
          <button type="button" disabled={disabled || busy || (view.currentPath === null && view.parentPath === null)} onClick={() => void browse(view.parentPath)}>상위 폴더</button>
          <button type="button" disabled={disabled || busy || !view.canSelect || !view.currentPath || selectedRoots.some((root) => folderSelectionKey(root) === folderSelectionKey(view.currentPath!)) || selectedRoots.length >= 8} onClick={() => {
            if (disabled || busy || !view.currentPath || selectedRoots.some((root) => folderSelectionKey(root) === folderSelectionKey(view.currentPath!)) || selectedRoots.length >= 8) return;
            onRootsChange([...selectedRoots, view.currentPath]);
          }}>이 폴더 추가</button>
        </div>
        {view.entries.length ? <ul className={styles.entries}>{view.entries.map((entry) => <li key={entry.path}><button type="button" disabled={disabled || busy} title={entry.name} onClick={() => void browse(entry.path)}>{entry.name}</button></li>)}</ul> : <p className={styles.empty}>열 수 있는 하위 폴더가 없습니다.</p>}
        {view.truncated ? <p className={styles.note}>일부 폴더만 표시했습니다. 하위 폴더로 이동해 범위를 좁혀 주세요.</p> : null}
        {selectedRoots.length >= 8 ? <p role="status" className={styles.note}>업무 폴더는 최대 8개까지 추가할 수 있습니다.</p> : null}
      </> : null}
    </div> : null}
  </section>;
}
