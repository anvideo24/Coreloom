import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { founderSession } from "@/lib/auth/session";
import { getFounderRecurringSeriesDetail } from "@/lib/billings/repository";
import { billingStatusLabels } from "@/lib/domain/billings";

export const dynamic = "force-dynamic";

export default async function RecurringSeriesDetailPage({ params }: { params: Promise<{ seriesId: string }> }) {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { seriesId } = await params;
  const detail = await getFounderRecurringSeriesDetail(session.founder.id, seriesId);
  if (!detail) notFound();
  const { series, occurrences } = detail;

  return (
    <main className="operations-shell">
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / RECURRING BILLING</p>
          <h1>반복 청구 일정</h1>
          <p>{series.clientName} · {detail.contractTitle} · 매월 · {series.currency}</p>
        </div>
        <div className="quote-header-links">
          <Link className="text-link" href={`/contracts/${series.contractId}`}>연결된 계약</Link>
          <Link className="text-link" href="/billings">청구 목록</Link>
        </div>
      </header>
      <section className="quote-editor-card">
        <p className="setup-code">일정</p>
        <p>{series.currency} · 월 {series.amount.toLocaleString("ko-KR")}원 · {occurrences.length}회</p>
        <p className="form-help">청구일 {series.startDate}부터 {series.endDate}까지 · 입금 예정은 청구일 {series.dueOffsetDays}일 뒤</p>
        {series.note ? <p className="form-help">{series.note}</p> : null}
        <p className="form-help">이미 만든 예정 청구는 덮어쓰지 않습니다. 메일 발송과 입금 확인은 각 청구에서 따로 하며, 세금계산서 발행은 포함하지 않습니다.</p>
      </section>
      <section className="quote-list" aria-label="반복 청구 회차">
        <div className="list-heading">
          <div>
            <p className="setup-code">생성된 청구</p>
            <h2>월별 청구</h2>
          </div>
          <span>{occurrences.length}개</span>
        </div>
        {occurrences.map((billing) => (
          <a className="quote-row" href={`/billings/${billing.id}`} key={billing.id}>
            <div>
              <p>청구일 {billing.billingDate} · 예정 {billing.dueDate} · {billingStatusLabels[billing.status]}</p>
              <h3>{detail.contractTitle}</h3>
            </div>
            <strong>{billing.amount.toLocaleString("ko-KR")}원</strong>
          </a>
        ))}
      </section>
    </main>
  );
}
