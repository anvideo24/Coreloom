import { redirect } from "next/navigation";

import { createTaskAction } from "@/app/(private)/tasks/actions";
import { founderSession } from "@/lib/auth/session";
import { taskStatusLabels } from "@/lib/domain/tasks";
import { listFounderTasks } from "@/lib/tasks/repository";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { projects, agents, tasks, schedule } = await listFounderTasks(session.founder.id);

  return (
    <main className="operations-shell">
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / TASKS</p>
          <h1>업무·일정</h1>
          <p>프로젝트에 업무를 연결하고 기한과 완료 조건을 남깁니다. 활성 시스템 계정에 배정할 수 있습니다. 완료는 대표가 조건을 확인한 뒤에만 처리하며, Recho 캘린더 연동은 포함하지 않습니다.</p>
        </div>
      </header>
      {projects.length === 0 ? (
        <section className="empty-state quote-empty">
          <h2>먼저 프로젝트를 등록해 주세요</h2>
          <p>업무는 고객사 프로젝트에 연결합니다. 연결할 프로젝트가 없으면 미분류로 두지 않습니다.</p>
          <a className="text-link" href="/clients-projects">고객사·프로젝트로 이동</a>
        </section>
      ) : (
        <section className="quote-editor-card">
          <p className="setup-code">새 업무</p>
          <form action={createTaskAction} className="quote-form">
            <label>프로젝트
              <select name="projectId" required>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.clientName} · {project.name}</option>
                ))}
              </select>
            </label>
            <label>기한<input name="dueDate" required type="date" /></label>
            <label className="quote-form-full">업무명<input name="title" placeholder="예: 초안 화면 전달" required /></label>
            <label className="quote-form-full">완료 조건<textarea name="completionCondition" placeholder="이 업무를 완료로 보려면 무엇이 확인돼야 하는지" required /></label>
            <label className="quote-form-full">AI 에이전트 (선택)
              <select defaultValue="" name="assignedAgentId">
                <option value="">배정 안 함</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}{agent.projectName && agent.clientName ? ` · ${agent.clientName} · ${agent.projectName}` : " · 회사 공통"}
                  </option>
                ))}
              </select>
            </label>
            <button className="auth-submit" type="submit">업무 저장</button>
          </form>
        </section>
      )}
      <section className="quote-list" aria-label="다가오는 일정">
        <div className="list-heading">
          <div>
            <p className="setup-code">일정</p>
            <h2>기한별 할 일</h2>
          </div>
          <span>{schedule.length}일</span>
        </div>
        {schedule.length === 0 ? <p className="empty-state">진행 중인 일정이 없습니다.</p> : schedule.map((group) => (
          <article className="quote-list" key={group.dueDate}>
            <p className="setup-code">{group.dueDate}</p>
            {group.tasks.map((task) => (
              <a className="quote-row" href={`/tasks/${task.id}`} key={task.id}>
                <div>
                  <p>{task.clientName} · {task.projectName}{task.assignedAgentName ? ` · ${task.assignedAgentName}` : ""}</p>
                  <h3>{task.title}</h3>
                </div>
                <strong>{taskStatusLabels[task.status]}</strong>
              </a>
            ))}
          </article>
        ))}
      </section>
      <section className="quote-list" aria-label="업무 목록">
        <div className="list-heading">
          <div>
            <p className="setup-code">등록된 업무</p>
            <h2>업무 이력</h2>
          </div>
          <span>{tasks.length}개</span>
        </div>
        {tasks.length === 0 ? <p className="empty-state">아직 등록된 업무가 없습니다.</p> : tasks.map((task) => (
          <a className="quote-row" href={`/tasks/${task.id}`} key={task.id}>
            <div>
              <p>{task.clientName} · {task.projectName} · 기한 {task.dueDate}{task.assignedAgentName ? ` · ${task.assignedAgentName}` : ""}</p>
              <h3>{task.title}</h3>
            </div>
            <strong>{taskStatusLabels[task.status]}</strong>
          </a>
        ))}
      </section>
    </main>
  );
}
