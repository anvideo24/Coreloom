import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { confirmAiProposalAction, rejectAiProposalAction } from "@/app/(private)/proposals/actions";
import { ApprovalReviewCard } from "@/components/approval-review-card";
import { founderSession } from "@/lib/auth/session";
import { buildApprovalReviewSummary } from "@/lib/domain/approvals";
import { aiProposalKindLabels, aiProposalStatusLabels, isOfficialDecision } from "@/lib/domain/ai-proposals";
import { rechoEvidenceKindLabels } from "@/lib/domain/recho-evidence";
import { getFounderAiProposalDetail } from "@/lib/ai-proposals/repository";

export const dynamic = "force-dynamic";

export default async function ProposalDetailPage({ params }: { params: Promise<{ proposalId: string }> }) {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { proposalId } = await params;
  const proposal = await getFounderAiProposalDetail(session.founder.id, proposalId);
  if (!proposal) notFound();
  const review = buildApprovalReviewSummary({
    subject: `${aiProposalKindLabels[proposal.kind]} · ${proposal.clientName} · ${proposal.projectName} · ${proposal.body}`,
    evidence: `${rechoEvidenceKindLabels[proposal.evidenceKind]} · ${proposal.occurredOn} ${proposal.occurredTime} · ${proposal.evidenceTitle} · 원문 식별자 ${proposal.originalIdentifier}`,
    outcomeLabel: "제안 확정 — 공식 결정으로 기록, 자동 실행 없음",
  });

  return (
    <main className="operations-shell">
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / AI PROPOSAL</p>
          <h1>{aiProposalKindLabels[proposal.kind]}</h1>
          <p>{proposal.clientName} · {proposal.projectName} · {aiProposalStatusLabels[proposal.status]} · {isOfficialDecision(proposal.status) ? "공식 결정" : "공식 결정 아님"}</p>
        </div>
        <div className="quote-header-links">
          <Link className="text-link" href="/approvals">승인함</Link>
          <Link className="text-link" href={`/timeline/${proposal.evidenceId}`}>근거 원문</Link>
          <Link className="text-link" href="/proposals">제안 목록</Link>
        </div>
      </header>
      <section className="quote-editor-card">
        <p className="setup-code">제안 내용</p>
        <p className="form-help">이 문구는 AI 초안이며 Recho 원문이 아닙니다. 확정 전에 원문과 앞뒤 시간을 확인하세요.</p>
        <p>{proposal.body}</p>
      </section>
      <section className="quote-editor-card">
        <p className="setup-code">근거 기록</p>
        <p>{rechoEvidenceKindLabels[proposal.evidenceKind]} · {proposal.occurredOn} {proposal.occurredTime} · {proposal.evidenceTitle}</p>
        <p className="form-help">원문 식별자 {proposal.originalIdentifier}</p>
        {proposal.originalUrl ? (
          <p><a className="text-link" href={proposal.originalUrl} rel="noreferrer" target="_blank">원문 열기</a></p>
        ) : (
          <p className="form-help">원문 링크가 없습니다. 근거 기록에서 식별자로 원문을 찾으세요.</p>
        )}
      </section>
      {proposal.status === "proposed" ? (
        <>
          <section className="quote-editor-card">
            <p className="setup-code">확정</p>
            <p className="form-help">원문과 시간 맥락을 확인한 뒤에만 공식 결정으로 남깁니다. 확정된 제안은 덮어쓰지 않습니다.</p>
            <ApprovalReviewCard summary={review} />
            <form action={confirmAiProposalAction} className="quote-form">
              <input name="proposalId" type="hidden" value={proposal.id} />
              <label className="quote-email-approval quote-form-full">
                <input name="approved" required type="checkbox" value="true" />
                근거 원문을 확인했고, 대표로서 이 제안을 공식 결정으로 확정합니다.
              </label>
              <button className="auth-submit" type="submit">제안 확정</button>
            </form>
          </section>
          <section className="quote-editor-card">
            <p className="setup-code">반려</p>
            <p className="form-help">반려 사유도 남깁니다. 반려된 제안은 공식 결정이 아니며 내용을 바꾸지 않습니다.</p>
            <form action={rejectAiProposalAction} className="quote-form">
              <input name="proposalId" type="hidden" value={proposal.id} />
              <label className="quote-form-full">반려 사유<textarea name="reason" required /></label>
              <label className="quote-email-approval quote-form-full">
                <input name="approved" required type="checkbox" value="true" />
                근거 원문을 확인했고, 대표로서 이 제안을 반려합니다.
              </label>
              <button className="auth-submit" type="submit">제안 반려</button>
            </form>
          </section>
        </>
      ) : (
        <section className="quote-editor-card">
          <p className="setup-code">결정</p>
          <p>{aiProposalStatusLabels[proposal.status]}{proposal.decidedAt ? ` · ${proposal.decidedAt.toLocaleString("ko-KR")}` : ""}</p>
          {proposal.decisionReason ? <p className="form-help">{proposal.decisionReason}</p> : null}
          <p className="form-help">이 제안은 결정되어 내용을 바꾸지 않습니다.</p>
        </section>
      )}
    </main>
  );
}
