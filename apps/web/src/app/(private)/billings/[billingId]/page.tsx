import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { confirmBillingDepositAction } from "@/app/(private)/billings/actions";
import { ApprovalReviewCard } from "@/components/approval-review-card";
import { founderSession } from "@/lib/auth/session";
import { getFounderBillingDetail } from "@/lib/billings/repository";
import { buildApprovalReviewSummary } from "@/lib/domain/approvals";
import { billingKindLabels, billingStatusLabels } from "@/lib/domain/billings";

export const dynamic = "force-dynamic";

export default async function BillingDetailPage({ params }: { params: Promise<{ billingId: string }> }) {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { billingId } = await params;
  const detail = await getFounderBillingDetail(session.founder.id, billingId);
  if (!detail) notFound();
  const { billing } = detail;
  const review = buildApprovalReviewSummary({
    subject: `${billing.clientName} · ${detail.contractTitle} · ${billingKindLabels[billing.kind]}`,
    amount: billing.amount,
    currency: billing.currency,
    evidence: [billing.note?.trim() || null, billing.billingNumber ? `청구번호 ${billing.billingNumber}` : null]
      .filter(Boolean)
      .join(" · ") || null,
    outcomeLabel: "입금 확정 — 금액 고정, 세금계산서 발행 없음",
  });

  return (
    <main className="operations-shell">
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / BILLING</p>
          <h1>{billingKindLabels[billing.kind]}</h1>
          <p>{billing.clientName} · {detail.contractTitle} · {billingStatusLabels[billing.status]} · {billing.currency}</p>
        </div>
        <div className="quote-header-links">
          <Link className="text-link" href={`/billings/${billing.id}/print`}>청구서 PDF</Link>
          <Link className="text-link" href={`/billings/${billing.id}/email`}>메일 발송</Link>
          {billing.seriesId ? <Link className="text-link" href={`/billings/series/${billing.seriesId}`}>반복 청구 일정</Link> : null}
          <Link className="text-link" href={`/contracts/${billing.contractId}`}>연결된 계약</Link>
          <Link className="text-link" href="/billings">청구 목록</Link>
        </div>
      </header>
      <section className="quote-editor-card">
        <p className="setup-code">금액과 일정</p>
        <p>{billing.currency} · {billing.amount.toLocaleString("ko-KR")}원</p>
        <p className="form-help">청구일 {billing.billingDate} · 입금 예정일 {billing.dueDate}{billing.depositedAt ? ` · 입금 확인 ${billing.depositedAt.toLocaleDateString("ko-KR")}` : ""}</p>
        {billing.billingNumber || billing.poNumber ? (
          <p className="form-help">
            {billing.billingNumber ? `청구번호 ${billing.billingNumber}` : null}
            {billing.billingNumber && billing.poNumber ? " · " : null}
            {billing.poNumber ? `PO ${billing.poNumber}` : null}
          </p>
        ) : null}
        {billing.note ? <p className="form-help">{billing.note}</p> : null}
      </section>
      {billing.status === "scheduled" ? (
        <section className="quote-editor-card">
          <p className="setup-code">입금 확인</p>
          <p className="form-help">입금이 실제 확인된 뒤에만 확정합니다. 확정된 금액은 덮어쓰지 않습니다. 세금계산서 발행은 포함되지 않습니다.</p>
          <ApprovalReviewCard summary={review} />
          <form action={confirmBillingDepositAction} className="quote-form">
            <input name="billingId" type="hidden" value={billing.id} />
            <label className="quote-email-approval quote-form-full">
              <input name="approved" required type="checkbox" value="true" />
              입금 금액과 일정을 확인했고, 대표로서 이 청구의 입금을 확정합니다.
            </label>
            <button className="auth-submit" type="submit">입금 확인</button>
          </form>
        </section>
      ) : (
        <section className="quote-editor-card">
          <p className="setup-code">입금 확인</p>
          <p>이 청구는 입금이 확정되어 금액을 바꾸지 않습니다.</p>
        </section>
      )}
    </main>
  );
}
