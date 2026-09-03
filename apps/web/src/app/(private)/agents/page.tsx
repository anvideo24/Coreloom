import { redirect } from "next/navigation";

import { createAgentAction } from "@/app/(private)/agents/actions";
import { listFounderAgents } from "@/lib/agents/repository";
import { founderSession } from "@/lib/auth/session";
import {
  aiAgentAllowedWorkKinds,
  aiAgentAllowedWorkLabels,
  aiAgentStatusLabels,
  formatAllowedWork,
} from "@/lib/domain/agents";
import { ventureKindLabels } from "@/lib/domain/revenue";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { projects, ventures, agents } = await listFounderAgents(session.founder.id);

  return (
    <main className="operations-shell">
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / AGENTS</p>
          <h1>AI 에이전트</h1>
          <p>사람 Neon 계정과 다른 시스템 계정으로 이름·목적·허용 업무·접근 범위를 등록합니다. 에이전트는 지출 확정, 계약 체결, 매출 확정, 환불, 권한 변경, 외부 공개를 혼자 실행하지 않습니다. 로그인과 자동 실행은 포함하지 않습니다.</p>
        </div>
      </header>
      <section className="quote-editor-card">
        <p className="setup-code">시스템 계정 등록</p>
        <p className="form-help">프로젝트와 사업을 동시에 고르지 마세요. 둘 다 비우면 회사 공통입니다. 접근 범위 문구는 꼭 적습니다. 허용 업무는 조사·초안·업무 업데이트·승인 요청 초안만 고를 수 있습니다.</p>
        <form action={createAgentAction} className="quote-form">
          <label>고객사 프로젝트 (선택)
            <select defaultValue="" name="projectId">
              <option value="">회사 공통</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.clientName} · {project.name}</option>
              ))}
            </select>
          </label>
          <label>앱·구독 사업 (선택)
            <select defaultValue="" name="ventureId">
              <option value="">연결 안 함</option>
              {ventures.map((venture) => (
                <option key={venture.id} value={venture.id}>{ventureKindLabels[venture.kind]} · {venture.name}</option>
              ))}
            </select>
          </label>
          <label className="quote-form-full">이름<input name="name" placeholder="예: 초안 도우미" required /></label>
          <label className="quote-form-full">목적<textarea name="purpose" placeholder="이 에이전트가 돕는 일" required /></label>
          <label className="quote-form-full">접근 범위<textarea name="accessScope" placeholder="볼 수 있는 사업·프로젝트·자료 범위" required /></label>
          <div className="quote-form-full">
            <p className="setup-code">허용 업무</p>
            {aiAgentAllowedWorkKinds.map((kind) => (
              <label className="quote-email-approval" key={kind}>
                <input name="allowedWork" type="checkbox" value={kind} />
                {aiAgentAllowedWorkLabels[kind]}
              </label>
            ))}
          </div>
          <button className="auth-submit" type="submit">에이전트 저장</button>
        </form>
      </section>
      <section className="quote-list" aria-label="에이전트 목록">
        <div className="list-heading">
          <div>
            <p className="setup-code">등록부</p>
            <h2>시스템 계정</h2>
          </div>
          <span>{agents.length}개</span>
        </div>
        {agents.length === 0 ? (
          <p className="empty-state">등록된 에이전트가 없습니다. 사람 계정 역할로 넣지 않습니다.</p>
        ) : agents.map((agent) => (
          <a className="quote-row" href={`/agents/${agent.id}`} key={agent.id}>
            <div>
              <p>{aiAgentStatusLabels[agent.status]} · {agent.scopeLabel}</p>
              <h3>{agent.name}</h3>
              <p className="form-help">{formatAllowedWork(agent.allowedWork)}</p>
            </div>
            <strong>{aiAgentStatusLabels[agent.status]}</strong>
          </a>
        ))}
      </section>
    </main>
  );
}
