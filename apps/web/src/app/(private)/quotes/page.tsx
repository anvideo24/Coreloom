import { redirect } from "next/navigation";

import { saveQuoteVersionAction } from "@/app/(private)/quotes/actions";
import { QuoteClientProjectFields } from "@/components/quote-client-project-fields";
import { QuoteItemsFields } from "@/components/quote-items-fields";
import { founderSession } from "@/lib/auth/session";
import { listFounderQuotes } from "@/lib/quotes/repository";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { clients, projects, versions } = await listFounderQuotes(session.founder.id);

  return <main className="operations-shell">
    <header className="operations-header"><div><p className="auth-eyebrow">CORELOOM / QUOTES</p><h1>견적서</h1><p>견적 수정은 새 버전으로 남습니다. 금액은 부가세 별도 기준이며, 각 버전에서 PDF를 다운로드하거나 인쇄할 수 있습니다.</p></div><a className="text-link" href="/dashboard">대시보드</a></header>
    {clients.length === 0 ? <section className="empty-state quote-empty"><h2>먼저 고객사를 등록해 주세요</h2><p>견적서는 고객사에 연결해 보관합니다.</p><a className="text-link" href="/clients-projects">고객사 등록으로 이동</a></section> : <section className="quote-editor-card"><p className="setup-code">새 견적 초안</p><form action={saveQuoteVersionAction} className="quote-form">
      <QuoteClientProjectFields clients={clients} projects={projects} />
      <label className="quote-form-full">견적명<input name="title" placeholder="예: 웹사이트 구축 견적" required /></label>
      <div className="quote-form-full"><QuoteItemsFields /></div>
      <label className="quote-form-full">메모 (선택)<textarea name="note" placeholder="견적 조건이나 전달 메모" /></label>
      <button className="auth-submit" type="submit">견적 버전 1 저장</button>
    </form></section>}
    <section className="quote-list" aria-label="견적 버전 목록"><div className="list-heading"><div><p className="setup-code">보관된 버전</p><h2>견적 이력</h2></div><span>{versions.length}개</span></div>{versions.length === 0 ? <p className="empty-state">아직 저장된 견적서가 없습니다.</p> : versions.map((version) => <a className="quote-row" href={`/quotes/${version.quoteId}`} key={version.versionId}><div><p>{version.clientName} · v{version.versionNumber}</p><h3>{version.title}</h3></div><strong>{version.totalAmount.toLocaleString("ko-KR")}원</strong></a>)}</section>
  </main>;
}
