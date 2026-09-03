import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { confirmRevenueEntryAction, refundRevenueEntryAction } from "@/app/(private)/revenue/actions";
import { founderSession } from "@/lib/auth/session";
import { ledgerRowFromRevenueEntry, revenueEntryStatusLabels, UNCLASSIFIED_LABEL } from "@/lib/domain/revenue";
import { getFounderRevenueEntryDetail } from "@/lib/revenue/repository";

export const dynamic = "force-dynamic";

export default async function RevenueEntryDetailPage({ params }: { params: Promise<{ entryId: string }> }) {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { entryId } = await params;
  const entry = await getFounderRevenueEntryDetail(session.founder.id, entryId);
  if (!entry) notFound();
  const row = ledgerRowFromRevenueEntry(entry);

  return (
    <main className="operations-shell">
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / REVENUE</p>
          <h1>{row.title}</h1>
          <p>{row.sourceLabel} · {row.counterparty} · {revenueEntryStatusLabels[row.status]} · {entry.currency}</p>
        </div>
        <div className="quote-header-links">
          <Link className="text-link" href="/expenses">비용 원장</Link>
          <Link className="text-link" href="/revenue">매출 원장</Link>
        </div>
      </header>
      <section className="quote-editor-card">
        <p className="setup-code">금액과 일정</p>
        <p>{entry.currency} · {entry.amount.toLocaleString("ko-KR")}원</p>
        <p className="form-help">발생일 {entry.occurredOn} · 정산일 {entry.settlementDate}{entry.confirmedAt ? ` · 확정 ${entry.confirmedAt.toLocaleDateString("ko-KR")}` : ""}</p>
        {row.unclassified ? <p className="form-help">이 건은 {UNCLASSIFIED_LABEL}입니다. 거래처 또는 사업에 연결하지 못했습니다.</p> : null}
        {entry.note ? <p className="form-help">{entry.note}</p> : null}
      </section>
      {entry.status === "scheduled" ? (
        <section className="quote-editor-card">
          <p className="setup-code">매출 확정</p>
          <p className="form-help">입금 또는 정산이 실제로 확인된 뒤에만 확정합니다. 확정된 금액은 덮어쓰지 않습니다. 세금계산서 발행은 포함되지 않습니다.</p>
          <form action={confirmRevenueEntryAction} className="quote-form">
            <input name="entryId" type="hidden" value={entry.id} />
            <label className="quote-email-approval quote-form-full">
              <input name="approved" required type="checkbox" value="true" />
              금액과 일정을 확인했고, 대표로서 이 매출을 확정합니다.
            </label>
            <button className="auth-submit" type="submit">매출 확정</button>
          </form>
        </section>
      ) : (
        <section className="quote-editor-card">
          <p className="setup-code">매출 확정</p>
          <p>이 매출은 확정되어 금액을 바꾸지 않습니다.</p>
        </section>
      )}
      {entry.status === "confirmed" ? (
        <section className="quote-editor-card">
          <p className="setup-code">환불 등록</p>
          <p className="form-help">확정된 매출에 대해서만 환불합니다. 원래 금액({entry.amount.toLocaleString("ko-KR")}원)을 덮어쓰지 않고 별도 이력으로 남기며, 환불 합계는 원래 금액을 넘을 수 없습니다.{entry.refundedTotal > 0 ? ` 기존 환불 합계 ${entry.refundedTotal.toLocaleString("ko-KR")}원.` : ""}</p>
          <form action={refundRevenueEntryAction} className="quote-form">
            <input name="entryId" type="hidden" value={entry.id} />
            <label>환불 금액 (원)<input max={entry.amount - entry.refundedTotal} min={1} name="amount" required step={1} type="number" /></label>
            <label>환불일<input name="refundedOn" required type="date" /></label>
            <label className="quote-form-full">환불 사유<textarea name="reason" required /></label>
            <label className="quote-email-approval quote-form-full">
              <input name="approved" required type="checkbox" value="true" />
              환불 내용을 확인했고, 대표로서 이 환불을 등록합니다. 등록된 환불은 덮어쓰지 않습니다.
            </label>
            <button className="auth-submit" type="submit">환불 등록</button>
          </form>
        </section>
      ) : null}
      {entry.refunds.length > 0 ? (
        <section className="quote-list" aria-label="환불 이력">
          <div className="list-heading">
            <div>
              <p className="setup-code">환불</p>
              <h2>환불 이력</h2>
            </div>
            <span>{entry.refundedTotal.toLocaleString("ko-KR")}원</span>
          </div>
          {entry.refunds.map((refund) => (
            <article className="quote-row" key={refund.id}>
              <div>
                <p>{refund.refundedOn} · {refund.reason}</p>
                <h3>{refund.amount.toLocaleString("ko-KR")}원</h3>
              </div>
              <strong>{refund.amount.toLocaleString("ko-KR")}원</strong>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}
