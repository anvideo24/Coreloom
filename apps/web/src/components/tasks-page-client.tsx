"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { createTaskAction } from "@/app/(private)/tasks/actions";
import { CreateIconButton } from "@/components/create-icon-button";
import { CreatePanel } from "@/components/create-panel";
import { taskStatusLabels, type TaskStatus } from "@/lib/domain/tasks";

type Project = { id: string; name: string; clientName: string };
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
  clientName: string;
  projectName: string;
};
type ScheduleGroup = { dueDate: string; tasks: TaskRow[] };

export function TasksPageClient({
  projects,
  agents,
  tasks,
  schedule,
}: {
  projects: Project[];
  agents: Agent[];
  tasks: TaskRow[];
  schedule: ScheduleGroup[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(searchParams.get("new") === "1");
  }, [searchParams]);

  const close = useCallback(() => {
    setOpen(false);
    if (searchParams.get("new") === "1") router.replace(pathname);
  }, [pathname, router, searchParams]);

  const openCreate = useCallback(() => {
    setOpen(true);
    router.replace(`${pathname}?new=1`);
  }, [pathname, router]);

  const canCreate = projects.length > 0;

  return (
    <>
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / TASKS</p>
          <h1>업무·일정</h1>
          <p>
            프로젝트에 업무를 연결하고 기한과 완료 조건을 남깁니다. 활성 시스템 계정에 배정할 수 있습니다. 완료는 대표가
            조건을 확인한 뒤에만 처리하며, Recho 캘린더 연동은 포함하지 않습니다.
          </p>
        </div>
        <CreateIconButton disabled={!canCreate} label="새 업무" onClick={openCreate} />
      </header>

      {!canCreate ? (
        <section className="empty-state quote-empty">
          <h2>먼저 프로젝트를 등록해 주세요</h2>
          <p>업무는 고객사 프로젝트에 연결합니다. 연결할 프로젝트가 없으면 미분류로 두지 않습니다.</p>
          <a className="text-link" href="/clients">
            고객사
          </a>
          {" · "}
          <a className="text-link" href="/clients-projects">
            프로젝트
          </a>
          로 이동
        </section>
      ) : null}

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
                      {task.clientName} · {task.projectName}
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
            {canCreate ? (
              <button className="auth-submit" onClick={openCreate} type="button">
                첫 업무 만들기
              </button>
            ) : null}
          </div>
        ) : (
          tasks.map((task) => (
            <a className="quote-row" href={`/tasks/${task.id}`} key={task.id}>
              <div>
                <p>
                  {task.clientName} · {task.projectName} · 기한 {task.dueDate}
                  {task.assignedAgentName ? ` · ${task.assignedAgentName}` : ""}
                </p>
                <h3>{task.title}</h3>
              </div>
              <strong>{taskStatusLabels[task.status]}</strong>
            </a>
          ))
        )}
      </section>

      {canCreate ? (
        <CreatePanel onClose={close} open={open} size="wide" title="새 업무">
          <form action={createTaskAction} className="quote-form">
            <p className="setup-code quote-form-full">연결</p>
            <label className="quote-form-full">
              프로젝트
              <select defaultValue={projects[0]?.id} name="projectId" required>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.clientName} · {project.name}
                  </option>
                ))}
              </select>
            </label>

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
            <button className="auth-submit" type="submit">
              업무 저장
            </button>
          </form>
        </CreatePanel>
      ) : null}
    </>
  );
}
