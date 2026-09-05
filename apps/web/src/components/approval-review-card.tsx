import type { ApprovalReviewSummary } from "@/lib/domain/approvals";

/** 확정 폼 위에서 대상·금액·증빙·결과를 한눈에 보여 준다(F03-03). */
export function ApprovalReviewCard({ summary }: { summary: ApprovalReviewSummary }) {
  return (
    <dl className="approval-review-card">
      <div>
        <dt>대상</dt>
        <dd>{summary.subject}</dd>
      </div>
      <div>
        <dt>금액</dt>
        <dd>{summary.amountLabel}</dd>
      </div>
      <div>
        <dt>증빙</dt>
        <dd>{summary.evidenceLabel}</dd>
      </div>
      <div>
        <dt>확정 결과</dt>
        <dd>{summary.outcomeLabel}</dd>
      </div>
    </dl>
  );
}
