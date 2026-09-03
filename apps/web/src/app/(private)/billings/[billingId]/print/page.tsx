import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { QuoteDocumentActions } from "@/components/quote-print-button";
import { founderSession } from "@/lib/auth/session";
import { getFounderBillingDetail } from "@/lib/billings/repository";
import { billingKindLabels, billingPdfDownloadPath, calculateBillingInvoiceAmounts } from "@/lib/domain/billings";

export const dynamic = "force-dynamic";

export default async function BillingPrintPage({ params }: { params: Promise<{ billingId: string }> }) {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { billingId } = await params;
  const detail = await getFounderBillingDetail(session.founder.id, billingId);
  if (!detail) notFound();
  const { billing } = detail;
  const invoice = calculateBillingInvoiceAmounts(billing.amount);
  const kindLabel = billingKindLabels[billing.kind];

  return (
    <main className="quote-print-shell">
      <div className="quote-print-actions">
        <Link className="text-link" href={`/billings/${billingId}`}>청구 상세</Link>
        <Link className="text-link" href={`/billings/${billingId}/email`}>메일 발송</Link>
        <Link className="text-link" href="/billings">청구 목록</Link>
        <QuoteDocumentActions downloadHref={billingPdfDownloadPath(billingId)} />
      </div>
      <article className="quote-document">
        <header>
          <p>청구서 · 부가세 별도</p>
          <h1>{detail.contractTitle}</h1>
          <dl>
            <div><dt>고객사</dt><dd>{billing.clientName}</dd></div>
            <div><dt>구분</dt><dd>{kindLabel}</dd></div>
            <div><dt>청구일</dt><dd>{billing.billingDate}</dd></div>
            <div><dt>입금 예정일</dt><dd>{billing.dueDate}</dd></div>
          </dl>
        </header>
        <table>
          <thead><tr><th>항목</th><th>공급가액</th></tr></thead>
          <tbody><tr><td>{kindLabel}</td><td>{invoice.subtotalAmount.toLocaleString("ko-KR")}원</td></tr></tbody>
        </table>
        <section className="quote-totals">
          <p><span>공급가액</span><strong>{invoice.subtotalAmount.toLocaleString("ko-KR")}원</strong></p>
          <p><span>부가세 (10%)</span><strong>{invoice.vatAmount.toLocaleString("ko-KR")}원</strong></p>
          <p className="quote-total"><span>합계</span><strong>{invoice.totalAmount.toLocaleString("ko-KR")}원</strong></p>
        </section>
        {billing.note ? <p className="quote-note">{billing.note}</p> : null}
      </article>
    </main>
  );
}
