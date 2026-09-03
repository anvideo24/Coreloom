import { redirect } from "next/navigation";

import { createAiProposalAction } from "@/app/(private)/proposals/actions";
import { founderSession } from "@/lib/auth/session";
import { aiProposalKindLabels, aiProposalKinds, aiProposalStatusLabels, isOfficialDecision } from "@/lib/domain/ai-proposals";
import { listFounderAiProposals } from "@/lib/ai-proposals/repository";

export const dynamic = "force-dynamic";

export default async function ProposalsPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { evidence, pending, decided } = await listFounderAiProposals(session.founder.id);

  return (
    <main className="operations-shell">
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / AI PROPOSALS</p>
          <h1>AI 제안</h1>
          <p>근거 기록에 연결된 현재 합의·다음 할 일·위험 초안을 등록하고, 대표가 확정하거나 반려합니다. 확정 전에는 공식 결정이 아닙니다. 자동 생성, 계약 체결, 외부 발송은 이 기능에 포함되지 않습니다.</p>
        </div>
      </header>
      {evidence.length === 0 ? (
        <section className="empty-state quote-empty">
          <h2>먼저 근거 기록을 연결해 주세요</h2>
          <p>근거가 없는 AI 요약은 확정 후보로 올리지 않습니다. Recho 메일·통화·회의를 프로젝트에 연결한 뒤에 제안을 등록하세요.</p>
          <a className="text-link" href="/timeline">근거 기록으로 이동</a>
        </section>
      ) : (
        <section className="quote-editor-card">
          <p className="setup-code">제안 초안</p>
          <p className="form-help">제안 본문은 AI가 만든 초안을 대표가 옮겨 적는 것이며, Recho 원문이 아닙니다.</p>
          <form action={createAiProposalAction} className="quote-form">
            <label className="quote-form-full">근거 기록
              <select name="evidenceId" required>
                {evidence.map((item) => (
                  <option key={item.id} value={item.id}>{item.clientName} · {item.projectName} · {item.occurredOn} · {item.title}</option>
                ))}
              </select>
            </label>
            <label>종류
              <select defaultValue="agreement" name="kind">
                {aiProposalKinds.map((kind) => (
                  <option key={kind} value={kind}>{aiProposalKindLabels[kind]}</option>
                ))}
              </select>
            </label>
            <label className="quote-form-full">제안 내용<textarea name="body" placeholder="근거 원문을 확인한 뒤, 현재 합의·다음 할 일 또는 위험을 적습니다." required /></label>
            <button className="auth-submit" type="submit">제안 등록</button>
          </form>
        </section>
      )}
      <section className="quote-list" aria-label="확인할 제안">
        <div className="list-heading">
          <div>
            <p className="setup-code">확인 요청</p>
            <h2>미확정 제안</h2>
          </div>
          <span>{pending.length}건</span>
        </div>
        {pending.length === 0 ? <p className="empty-state">확인할 제안이 없습니다.</p> : pending.map((proposal) => (
          <a className="quote-row" href={`/proposals/${proposal.id}`} key={proposal.id}>
            <div>
              <p>{proposal.clientName} · {proposal.projectName} · {aiProposalKindLabels[proposal.kind]} · {proposal.occurredOn}</p>
              <h3>{proposal.body}</h3>
            </div>
            <strong>{aiProposalStatusLabels[proposal.status]}</strong>
          </a>
        ))}
      </section>
      <section className="quote-list" aria-label="결정 이력">
        <div className="list-heading">
          <div>
            <p className="setup-code">결정 이력</p>
            <h2>확정·반려</h2>
          </div>
          <span>{decided.length}건</span>
        </div>
        {decided.length === 0 ? <p className="empty-state">확정하거나 반려한 제안이 없습니다.</p> : decided.map((proposal) => (
          <a className="quote-row" href={`/proposals/${proposal.id}`} key={proposal.id}>
            <div>
              <p>{proposal.clientName} · {proposal.projectName} · {aiProposalKindLabels[proposal.kind]} · {isOfficialDecision(proposal.status) ? "공식 결정" : "공식 결정 아님"}</p>
              <h3>{proposal.body}</h3>
            </div>
            <strong>{aiProposalStatusLabels[proposal.status]}</strong>
          </a>
        ))}
      </section>
    </main>
  );
}
