import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { completeTaskAction } from "@/app/(private)/tasks/actions";
import { founderSession } from "@/lib/auth/session";
import { taskStatusLabels } from "@/lib/domain/tasks";
import { getFounderTaskDetail } from "@/lib/tasks/repository";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { taskId } = await params;
  const task = await getFounderTaskDetail(session.founder.id, taskId);
  if (!task) notFound();

  return (
    <main className="operations-shell">
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / TASK</p>
          <h1>{task.title}</h1>
          <p>{task.clientName} · {task.projectName} · {taskStatusLabels[task.status]} · 기한 {task.dueDate}</p>
        </div>
        <div className="quote-header-links">
          <Link className="text-link" href="/clients-projects">고객사·프로젝트</Link>
          <Link className="text-link" href="/tasks">업무 목록</Link>
        </div>
      </header>
      <section className="quote-editor-card">
        <p className="setup-code">완료 조건</p>
        <p className="form-help">{task.completionCondition}</p>
        {task.completedAt ? <p className="form-help">완료 확인 {task.completedAt.toLocaleDateString("ko-KR")}</p> : null}
      </section>
      {task.status === "open" ? (
        <section className="quote-editor-card">
          <p className="setup-code">완료 확인</p>
          <p className="form-help">완료 조건이 실제로 충족된 뒤에만 완료로 남깁니다. 완료된 업무는 덮어쓰지 않습니다.</p>
          <form action={completeTaskAction} className="quote-form">
            <input name="taskId" type="hidden" value={task.id} />
            <label className="quote-email-approval quote-form-full">
              <input name="approved" required type="checkbox" value="true" />
              완료 조건을 확인했고, 대표로서 이 업무를 완료로 처리합니다.
            </label>
            <button className="auth-submit" type="submit">업무 완료</button>
          </form>
        </section>
      ) : (
        <section className="quote-editor-card">
          <p className="setup-code">완료 확인</p>
          <p>이 업무는 완료되어 내용을 바꾸지 않습니다.</p>
        </section>
      )}
    </main>
  );
}
