import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { saveQuoteVersionAction } from "@/app/(private)/quotes/actions";
import { QuoteItemsFields } from "@/components/quote-items-fields";
import { founderSession } from "@/lib/auth/session";
import { getFounderQuoteDetail } from "@/lib/quotes/repository";

export const dynamic = "force-dynamic";

export default async function QuoteDetailPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { quoteId } = await params;
  const detail = await getFounderQuoteDetail(session.founder.id, quoteId);
  if (!detail) notFound();
  const latest = detail.versions[0];
  const items = Array.isArray(latest.items) ? latest.items as { description: string; amount: number }[] : [];

  return <main className="operations-shell"><header className="operations-header"><div><p className="auth-eyebrow">CORELOOM / QUOTE HISTORY</p><h1>{latest.title}</h1><p>{detail.quote.clientName} · 현재 v{latest.versionNumber}</p></div><Link className="text-link" href="/quotes">견적서 목록</Link></header>
    <section className="quote-editor-card"><p className="setup-code">새 수정본 만들기</p><form action={saveQuoteVersionAction} className="quote-form"><input name="quoteId" type="hidden" value={detail.quote.id} /><input name="clientId" type="hidden" value={detail.quote.clientCompanyId} /><input name="projectId" type="hidden" value={detail.quote.projectId ?? ""} /><label className="quote-form-full">견적명<input defaultValue={latest.title} name="title" required /></label><div className="quote-form-full"><QuoteItemsFields initialItems={items} /></div><label className="quote-form-full">메모 (선택)<textarea defaultValue={latest.note ?? ""} name="note" /></label><button className="auth-submit" type="submit">v{latest.versionNumber + 1} 저장</button></form></section>
    <section className="quote-list"><div className="list-heading"><div><p className="setup-code">변경 이력</p><h2>저장된 버전</h2></div><span>{detail.versions.length}개</span></div>{detail.versions.map((version) => <a className="quote-row" href={`/quotes/${detail.quote.id}/versions/${version.id}/print`} key={version.id}><div><p>v{version.versionNumber} · 부가세 별도</p><h3>{version.title}</h3></div><strong>{version.totalAmount.toLocaleString("ko-KR")}원</strong></a>)}</section>
  </main>;
}
