import type { ApprovalReviewSummary } from "@/lib/domain/approvals";
import styles from "./approval-review-card.module.css";

/** 확정 전에 기록값과 확정 뒤의 변화를 구분해 보여 준다(F03-03). */
export function ApprovalReviewCard({ summary }: { summary: ApprovalReviewSummary }) {
  return (
    <section aria-label="확정 전 확인" className={styles.card}>
      <h2>확정 전 확인</h2>
      <dl className={styles.grid}>
        <div className={styles.primary}>
          <dt>대상</dt>
          <dd>{summary.subject}</dd>
        </div>
        <div className={styles.primary}>
          <dt>금액</dt>
          <dd>{summary.amountLabel}</dd>
        </div>
        <div className={styles.recorded}>
          <dt>기록된 증빙·참고</dt>
          <dd>
            <span>{summary.evidenceLabel}</span>
            <p>기록된 값이며, 원본·입금·내용을 확인한 결과는 아닙니다.</p>
          </dd>
        </div>
        <div className={styles.outcome}>
          <dt>확정 후 결과</dt>
          <dd>{summary.outcomeLabel}</dd>
        </div>
      </dl>
    </section>
  );
}
