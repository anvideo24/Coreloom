"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { createTaskAction } from "@/app/(private)/tasks/actions";
import { CreateIconButton } from "@/components/create-icon-button";
import { CreatePanel } from "@/components/create-panel";
import { taskLinkLabel, taskStatusLabels, workKindLabels, workKinds, type TaskStatus, type WorkKind } from "@/lib/domain/tasks";

type Project = { id: string; name: string; clientName: string };
type Venture = { id: string; name: string; kind: "app" | "subscription" };
type Agent = {
  id: string;
  name: string;
  projectName: string | null;
  clientName: string | null;
};
type TaskRow = {
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
type ScheduleGroup = { dueDate: string; tasks: TaskRow[] };

export function TasksPageClient({
  projects,
  ventures,
  agents,
  tasks,
  schedule,
}: {
  projects: Project[];
  ventures: Venture[];
  agents: Agent[];
  tasks: TaskRow[];
  schedule: ScheduleGroup[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<WorkKind>("client");

  useEffect(() => {
    setOpen(searchParams.get("new") === "1");
  }, [searchParams]);

  const close = useCallback(() => {
    setOpen(false);
    if (searchParams.get("new") === "1") router.replace(pathname);
  }, [pathname, router, searchParams]);

  const openCreate = useCallback(() => {
    setKind("client");
    setOpen(true);
    router.replace(`${pathname}?new=1`);
  }, [pathname, router]);

  return (
    <>
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / TASKS</p>
          <h1>업무·일정</h1>
          <p>
            회사 운영·자체 사업·고객사 프로젝트 세 유형으로 업무를 담습니다. 활성 시스템 계정에 배정할 수 있습니다.
            완료는 대표가 조건을 확인한 뒤에만 처리하며, Recho 캘린더 연동은 포함하지 않습니다.
          </p>
        </div>
        <CreateIconButton label="새 업무" onClick={openCreate} />
      </header>

      <section aria-label="다가오는 일정" className="quote-list">
        <div className="list-heading">
          <div>
            <p className="setup-code">일정</p>
            <h2>기한별 할 일</h2>
          </div>
          <span>{schedule.length}일</span>
        </div>
        {schedule.length === 0 ? (
          <p className="empty-state">진행 중인 일정이 없습니다.</p>
        ) : (
          schedule.map((group) => (
            <article className="quote-list" key={group.dueDate}>
              <p className="setup-code">{group.dueDate}</p>
              {group.tasks.map((task) => (
                <a className="quote-row" href={`/tasks/${task.id}`} key={task.id}>
                  <div>
                    <p>
                      {taskLinkLabel(task)}
                      {task.assignedAgentName ? ` · ${task.assignedAgentName}` : ""}
                    </p>
                    <h3>{task.title}</h3>
                  </div>
                  <strong>{taskStatusLabels[task.status]}</strong>
                </a>
              ))}
            </article>
          ))
        )}
      </section>

      <section aria-label="업무 목록" className="quote-list">
        <div className="list-heading">
          <div>
            <p className="setup-code">등록된 업무</p>
            <h2>업무 이력</h2>
          </div>
          <span>{tasks.length}개</span>
        </div>
        {tasks.length === 0 ? (
          <div className="empty-state quote-empty-inline">
            <p>아직 등록된 업무가 없습니다.</p>
            <button className="auth-submit" onClick={openCreate} type="button">
              첫 업무 만들기
            </button>
          </div>
        ) : (
          tasks.map((task) => (
            <a className="quote-row" href={`/tasks/${task.id}`} key={task.id}>
              <div>
                <p>
                  {taskLinkLabel(task)} · 기한 {task.dueDate}
                  {task.assignedAgentName ? ` · ${task.assignedAgentName}` : ""}
                </p>
                <h3>{task.title}</h3>
              </div>
              <strong>{taskStatusLabels[task.status]}</strong>
            </a>
          ))
        )}
      </section>

      <CreatePanel onClose={close} open={open} size="wide" title="새 업무">
        <form action={createTaskAction} className="quote-form">
          <p className="setup-code quote-form-full">연결</p>
          <label className="quote-form-full">
            업무 유형
            <select
              name="kind"
              onChange={(event) => setKind(event.target.value as WorkKind)}
              value={kind}
            >
              {workKinds.map((option) => (
                <option key={option} value={option}>
                  {workKindLabels[option]}
                </option>
              ))}
            </select>
          </label>

          {kind === "client" ? (
            projects.length > 0 ? (
              <label className="quote-form-full">
                고객사 · 프로젝트
                <select defaultValue={projects[0]?.id} name="projectId" required>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.clientName} · {project.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="form-help quote-form-full">
                등록된 고객사 프로젝트가 없습니다. 먼저{" "}
                <a className="text-link" href="/clients">고객사</a>
                {" · "}
                <a className="text-link" href="/clients-projects">프로젝트</a>
                를 등록해 주세요.
              </p>
            )
          ) : null}

          {kind === "internal" ? (
            ventures.length > 0 ? (
              <label className="quote-form-full">
                자체 사업
                <select defaultValue={ventures[0]?.id} name="ventureId" required>
                  {ventures.map((venture) => (
                    <option key={venture.id} value={venture.id}>
                      {venture.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="form-help quote-form-full">
                등록된 자체 사업이 없습니다. 먼저{" "}
                <a className="text-link" href="/revenue?new=venture">사업 등록</a>
                을 해 주세요.
              </p>
            )
          ) : null}

          {kind === "company" ? (
            <p className="form-help quote-form-full">회사 운영 업무는 프로젝트·고객사·사업을 연결하지 않습니다.</p>
          ) : null}

          <p className="setup-code quote-form-full">업무</p>
          <label>
            기한
            <input name="dueDate" required type="date" />
          </label>
          <label className="quote-form-full">
            업무명
            <input name="title" placeholder="예: 초안 화면 전달" required />
          </label>
          <label className="quote-form-full">
            완료 조건
            <textarea name="completionCondition" placeholder="이 업무를 완료로 보려면 무엇이 확인돼야 하는지" required />
          </label>
          <label className="quote-form-full">
            AI 에이전트 (선택)
            <select defaultValue="" name="assignedAgentId">
              <option value="">배정 안 함</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                  {agent.projectName && agent.clientName
                    ? ` · ${agent.clientName} · ${agent.projectName}`
                    : " · 회사 공통"}
                </option>
              ))}
            </select>
          </label>
          <button
            className="auth-submit"
            disabled={(kind === "client" && projects.length === 0) || (kind === "internal" && ventures.length === 0)}
            type="submit"
          >
            업무 저장
          </button>
        </form>
      </CreatePanel>
    </>
  );
}
