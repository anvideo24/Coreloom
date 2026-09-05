import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { confirmExpenseEntryAction } from "@/app/(private)/expenses/actions";
import { ApprovalReviewCard } from "@/components/approval-review-card";
import { founderSession } from "@/lib/auth/session";
import { buildApprovalReviewSummary } from "@/lib/domain/approvals";
import { expenseEntryStatusLabels, ledgerRowFromExpenseEntry } from "@/lib/domain/expenses";
import { UNCLASSIFIED_LABEL } from "@/lib/domain/revenue";
import { getFounderExpenseEntryDetail } from "@/lib/expenses/repository";

export const dynamic = "force-dynamic";

export default async function ExpenseEntryDetailPage({ params }: { params: Promise<{ entryId: string }> }) {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { entryId } = await params;
  const entry = await getFounderExpenseEntryDetail(session.founder.id, entryId);
  if (!entry) notFound();
  const row = ledgerRowFromExpenseEntry(entry);
  const review = buildApprovalReviewSummary({
    subject: `${row.title} · ${row.counterparty}`,
    amount: entry.amount,
    currency: entry.currency,
    evidence: entry.note?.trim() || null,
    outcomeLabel: "비용 확정 — 금액 고정, 자동 이체·세금계산서 없음",
  });

  return (
    <main className="operations-shell">
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / EXPENSE</p>
          <h1>{row.title}</h1>
          <p>{row.sourceLabel} · {row.counterparty} · {expenseEntryStatusLabels[row.status]} · {entry.currency}</p>
        </div>
        <div className="quote-header-links">
          <Link className="text-link" href="/revenue">매출 원장</Link>
          <Link className="text-link" href="/expenses">비용 원장</Link>
        </div>
      </header>
      <section className="quote-editor-card">
        <p className="setup-code">금액과 일정</p>
        <p>{entry.currency} · {entry.amount.toLocaleString("ko-KR")}원</p>
        <p className="form-help">발생일 {entry.occurredOn} · 지급 예정일 {entry.settlementDate}{entry.confirmedAt ? ` · 확정 ${entry.confirmedAt.toLocaleDateString("ko-KR")}` : ""}</p>
        {row.unclassified ? <p className="form-help">이 건은 {UNCLASSIFIED_LABEL}입니다. 거래처 또는 사업에 연결하지 못했습니다.</p> : null}
        {entry.note ? <p className="form-help">{entry.note}</p> : null}
      </section>
      {entry.status === "scheduled" ? (
        <section className="quote-editor-card">
          <p className="setup-code">비용 확정</p>
          <p className="form-help">지급이 실제로 확인된 뒤에만 확정합니다. 확정된 금액은 덮어쓰지 않습니다. 자동 이체와 세금계산서 발행은 포함되지 않습니다.</p>
          <ApprovalReviewCard summary={review} />
          <form action={confirmExpenseEntryAction} className="quote-form">
            <input name="entryId" type="hidden" value={entry.id} />
            <label className="quote-email-approval quote-form-full">
              <input name="approved" required type="checkbox" value="true" />
              금액과 일정을 확인했고, 대표로서 이 비용을 확정합니다.
            </label>
            <button className="auth-submit" type="submit">비용 확정</button>
          </form>
        </section>
      ) : (
        <section className="quote-editor-card">
          <p className="setup-code">비용 확정</p>
          <p>이 비용은 확정되어 금액을 바꾸지 않습니다.</p>
        </section>
      )}
    </main>
  );
}
