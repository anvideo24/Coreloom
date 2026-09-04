import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  approveAgentWorkAction,
  deactivateAgentAction,
  recordAgentWorkAction,
  rejectAgentWorkAction,
} from "@/app/(private)/agents/actions";
import { getFounderAgentDetail } from "@/lib/agents/repository";
import { founderSession } from "@/lib/auth/session";
import {
  aiAgentCapabilityKinds,
  aiAgentCapabilityLabels,
  aiAgentModelProviderLabels,
  aiAgentStatusLabels,
  aiAgentWorkLogStatusLabels,
  formatAllowedWork,
} from "@/lib/domain/agents";
import { taskStatusLabels } from "@/lib/domain/tasks";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({ params }: { params: Promise<{ agentId: string }> }) {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { agentId } = await params;
  const agent = await getFounderAgentDetail(session.founder.id, agentId);
  if (!agent) notFound();

  return (
    <main className="operations-shell">
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / AGENT</p>
          <h1>{agent.name}</h1>
          <p>{aiAgentStatusLabels[agent.status]} · {agent.scopeLabel}</p>
        </div>
        <div className="quote-header-links">
          <Link className="text-link" href="/tasks">업무</Link>
          <Link className="text-link" href="/agents">에이전트 목록</Link>
        </div>
      </header>
      <section className="quote-editor-card">
        <p className="setup-code">계정</p>
        <p>{agent.purpose}</p>
        <p className="form-help">허용 업무 {formatAllowedWork(agent.allowedWork)}</p>
        <p className="form-help">모델 {aiAgentModelProviderLabels[agent.modelProvider]} · 구독 채널 (API 키 아님)</p>
        {agent.workStyle ? <p className="form-help">일하는 방식 {agent.workStyle}</p> : null}
        {agent.answerStyle ? <p className="form-help">답변 방식 {agent.answerStyle}</p> : null}
        {agent.procedure ? <p className="form-help">절차 {agent.procedure}</p> : null}
        {agent.instructions ? <p className="form-help">지침 {agent.instructions}</p> : null}
        <p className="form-help">
          능력
          {" "}
          {aiAgentCapabilityKinds
            .filter((kind) => agent.capabilities[kind])
            .map((kind) => aiAgentCapabilityLabels[kind])
            .join(" · ") || "없음 (기본)"}
        </p>
        <p className="form-help">사람 계정과 다른 시스템 계정입니다. 능력에 켠 항목만 실행할 수 있으며, 기본은 저장·발송·확정이 꺼져 있습니다.</p>
      </section>
      {agent.status === "active" ? (
        <section className="quote-editor-card">
          <p className="setup-code">작업 이력 남기기</p>
          <p className="form-help">대표가 에이전트 대신 요청·입력·결과를 남깁니다. 에이전트는 로그인하거나 혼자 승인하지 않습니다.</p>
          <form action={recordAgentWorkAction} className="quote-form">
            <input name="agentId" type="hidden" value={agent.id} />
            <label>연결 업무 (선택)
              <select defaultValue="" name="taskId">
                <option value="">업무 없음</option>
                {agent.openTasks.map((task) => (
                  <option key={task.id} value={task.id}>{task.clientName} · {task.projectName} · {task.title}</option>
                ))}
              </select>
            </label>
            <label className="quote-form-full">요청<textarea name="requestNote" required /></label>
            <label className="quote-form-full">입력 자료<textarea name="inputNote" required /></label>
            <label className="quote-form-full">결과 (선택)<textarea name="resultNote" /></label>
            <button className="auth-submit" type="submit">이력 저장</button>
          </form>
        </section>
      ) : (
        <section className="quote-editor-card">
          <p className="setup-code">작업 이력</p>
          <p>중지된 에이전트에는 새 이력을 남기지 않습니다. 이미 남긴 기록은 덮어쓰지 않습니다.</p>
        </section>
      )}
      <section className="quote-list" aria-label="배정된 업무">
        <div className="list-heading">
          <div>
            <p className="setup-code">배정</p>
            <h2>맡은 업무</h2>
          </div>
          <span>{agent.assignedTasks.length}개</span>
        </div>
        {agent.assignedTasks.length === 0 ? (
          <p className="empty-state">배정된 업무가 없습니다.</p>
        ) : agent.assignedTasks.map((task) => (
          <a className="quote-row" href={`/tasks/${task.id}`} key={task.id}>
            <div>
              <p>기한 {task.dueDate}</p>
              <h3>{task.title}</h3>
            </div>
            <strong>{taskStatusLabels[task.status]}</strong>
          </a>
        ))}
      </section>
      <section className="quote-list" aria-label="대기 중인 작업">
        <div className="list-heading">
          <div>
            <p className="setup-code">대기</p>
            <h2>승인 전 이력</h2>
          </div>
          <span>{agent.work.pending.length}건</span>
        </div>
        {agent.work.pending.length === 0 ? (
          <p className="empty-state">대기 중인 이력이 없습니다.</p>
        ) : agent.work.pending.map((work) => (
          <article className="quote-editor-card" key={work.id}>
            <p className="setup-code">{aiAgentWorkLogStatusLabels[work.status]}{work.taskTitle ? ` · ${work.taskTitle}` : ""}</p>
            <p>요청 {work.requestNote}</p>
            <p className="form-help">입력 {work.inputNote}</p>
            {work.resultNote ? <p className="form-help">결과 {work.resultNote}</p> : <p className="form-help">결과가 아직 없습니다. 승인 전에 결과를 적습니다.</p>}
            <form action={approveAgentWorkAction} className="quote-form">
              <input name="agentId" type="hidden" value={agent.id} />
              <input name="workLogId" type="hidden" value={work.id} />
              {work.resultNote ? null : (
                <label className="quote-form-full">결과<textarea name="resultNote" required /></label>
              )}
              <label className="quote-email-approval quote-form-full">
                <input name="approved" required type="checkbox" value="true" />
                결과를 확인했고, 대표로서 이 이력을 승인합니다. 승인된 기록은 덮어쓰지 않습니다.
              </label>
              <button className="auth-submit" type="submit">이력 승인</button>
            </form>
            <form action={rejectAgentWorkAction} className="quote-form">
              <input name="agentId" type="hidden" value={agent.id} />
              <input name="workLogId" type="hidden" value={work.id} />
              <label className="quote-form-full">반려 사유<textarea name="reason" required /></label>
              <label className="quote-email-approval quote-form-full">
                <input name="approved" required type="checkbox" value="true" />
                대표로서 이 이력을 반려합니다. 결과는 없어도 됩니다.
              </label>
              <button className="auth-submit" type="submit">이력 반려</button>
            </form>
          </article>
        ))}
      </section>
      <section className="quote-list" aria-label="결정된 작업">
        <div className="list-heading">
          <div>
            <p className="setup-code">이력</p>
            <h2>결정된 작업</h2>
          </div>
          <span>{agent.work.decided.length}건</span>
        </div>
        {agent.work.decided.length === 0 ? (
          <p className="empty-state">결정된 이력이 없습니다.</p>
        ) : agent.work.decided.map((work) => (
          <article className="quote-row" key={work.id}>
            <div>
              <p>{aiAgentWorkLogStatusLabels[work.status]}{work.taskTitle ? ` · ${work.taskTitle}` : ""}{work.decidedAt ? ` · ${work.decidedAt.toLocaleString("ko-KR")}` : ""}</p>
              <h3>{work.requestNote}</h3>
              <p className="form-help">입력 {work.inputNote}</p>
              {work.resultNote ? <p className="form-help">결과 {work.resultNote}</p> : null}
              {work.decisionReason ? <p className="form-help">사유 {work.decisionReason}</p> : null}
            </div>
            <strong>{aiAgentWorkLogStatusLabels[work.status]}</strong>
          </article>
        ))}
      </section>
      {agent.status === "active" ? (
        <section className="quote-editor-card">
          <p className="setup-code">중지</p>
          <p className="form-help">중지하면 새 배정과 새 이력을 남기지 않습니다. 이미 남긴 기록은 지우지 않습니다.</p>
          <form action={deactivateAgentAction} className="quote-form">
            <input name="agentId" type="hidden" value={agent.id} />
            <button className="auth-submit" type="submit">에이전트 중지</button>
          </form>
        </section>
      ) : null}
    </main>
  );
}
