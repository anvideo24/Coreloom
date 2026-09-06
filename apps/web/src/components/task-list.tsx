"use client";

import { useMemo, useState } from "react";

import { taskLinkLabel, taskStatusLabels, workKindLabels, workKinds, type TaskStatus, type WorkKind } from "@/lib/domain/tasks";
import styles from "./task-list.module.css";

export type TaskListTask = {
  id: string;
  title: string;
  dueDate: string;
  status: TaskStatus;
  assignedAgentName: string | null;
  kind: WorkKind;
  clientName: string | null;
  projectName: string | null;
  ventureName: string | null;
};

export function TaskList({ tasks, onCreate }: { tasks: TaskListTask[]; onCreate: () => void }) {
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [kind, setKind] = useState<WorkKind | "">("");
  const normalizedTitle = title.trim().toLocaleLowerCase();
  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const matchesTitle = !normalizedTitle || task.title.toLocaleLowerCase().includes(normalizedTitle);
    return matchesTitle && (!status || task.status === status) && (!kind || task.kind === kind);
  }), [kind, normalizedTitle, status, tasks]);
  const hasFilters = Boolean(title || status || kind);

  return (
    <section aria-label="업무 목록" className="quote-list">
      <div className="list-heading">
        <div>
          <p className="setup-code">등록된 업무</p>
          <h2>업무 이력</h2>
        </div>
        <span aria-live="polite">표시 {filteredTasks.length}개 / 전체 {tasks.length}개</span>
      </div>
      {tasks.length > 0 ? (
        <>
          <p className={styles.help}>아래 업무 이력에만 적용됩니다.</p>
          <div className={styles.filters} aria-label="업무 필터">
          <label>
            업무명 검색
            <input aria-label="업무명 검색" type="search" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label>
            업무 상태
            <select aria-label="업무 상태" value={status} onChange={(event) => setStatus(event.target.value as TaskStatus | "")}>
              <option value="">전체 상태</option>
              <option value="open">{taskStatusLabels.open}</option>
              <option value="done">{taskStatusLabels.done}</option>
            </select>
          </label>
          <label>
            업무 유형
            <select aria-label="업무 유형" value={kind} onChange={(event) => setKind(event.target.value as WorkKind | "")}>
              <option value="">전체 유형</option>
              {workKinds.map((value) => <option key={value} value={value}>{workKindLabels[value]}</option>)}
            </select>
          </label>
          {hasFilters ? <button type="button" onClick={() => { setTitle(""); setStatus(""); setKind(""); }} aria-label="필터 초기화">필터 초기화</button> : null}
          </div>
        </>
      ) : null}
      {tasks.length === 0 ? (
        <div className="empty-state quote-empty-inline">
          <p>아직 등록된 업무가 없습니다.</p>
          <button className="auth-submit" onClick={onCreate} type="button">첫 업무 만들기</button>
        </div>
      ) : filteredTasks.length === 0 ? (
        <p className="empty-state">조건에 맞는 업무가 없습니다.</p>
      ) : (
        filteredTasks.map((task) => (
          <a className="quote-row" href={`/tasks/${task.id}`} key={task.id}>
            <div>
              <p>{taskLinkLabel(task)} · 기한 {task.dueDate}{task.assignedAgentName ? ` · ${task.assignedAgentName}` : ""}</p>
              <h3>{task.title}</h3>
            </div>
            <strong>{taskStatusLabels[task.status]}</strong>
          </a>
        ))
      )}
    </section>
  );
}
