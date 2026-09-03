import { notFound, redirect } from "next/navigation";

import { QuoteDocumentActions } from "@/components/quote-print-button";
import { founderSession } from "@/lib/auth/session";
import { quotePdfDownloadPath } from "@/lib/quotes/download";
import { getFounderQuoteDetail } from "@/lib/quotes/repository";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function QuotePrintPage({ params }: { params: Promise<{ quoteId: string; versionId: string }> }) {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { quoteId, versionId } = await params;
  const detail = await getFounderQuoteDetail(session.founder.id, quoteId);
  const version = detail?.versions.find((candidate) => candidate.id === versionId);
  if (!detail || !version) notFound();
  const items = Array.isArray(version.items) ? version.items as { description: string; amount: number }[] : [];

  return <main className="quote-print-shell"><div className="quote-print-actions"><Link className="text-link" href={`/quotes/${quoteId}`}>견적 이력</Link><Link className="text-link" href={`/quotes/${quoteId}/versions/${versionId}/email`}>메일 발송</Link><Link className="text-link" href="/contracts">계약</Link><QuoteDocumentActions downloadHref={quotePdfDownloadPath(quoteId, versionId)} /></div><article className="quote-document"><header><p>견적서 · 부가세 별도</p><h1>{version.title}</h1><dl><div><dt>고객사</dt><dd>{detail.quote.clientName}</dd></div><div><dt>버전</dt><dd>v{version.versionNumber}</dd></div></dl></header><table><thead><tr><th>항목</th><th>공급가액</th></tr></thead><tbody>{items.map((item, index) => <tr key={index}><td>{item.description}</td><td>{item.amount.toLocaleString("ko-KR")}원</td></tr>)}</tbody></table><section className="quote-totals"><p><span>공급가액</span><strong>{version.subtotalAmount.toLocaleString("ko-KR")}원</strong></p><p><span>부가세 (10%)</span><strong>{version.vatAmount.toLocaleString("ko-KR")}원</strong></p><p className="quote-total"><span>합계</span><strong>{version.totalAmount.toLocaleString("ko-KR")}원</strong></p></section>{version.note ? <p className="quote-note">{version.note}</p> : null}</article></main>;
}
