import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createContractFromQuoteAction } from "@/app/(private)/contracts/actions";
import { saveQuoteVersionAction } from "@/app/(private)/quotes/actions";
import { QuoteItemsFields } from "@/components/quote-items-fields";
import { founderSession } from "@/lib/auth/session";
import { getFounderContractForQuote } from "@/lib/contracts/repository";
import { quoteVatModeLabels, type QuoteVatMode } from "@/lib/domain/quotes";
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
  const latestVatMode = (latest.vatMode ?? "exclusive") as QuoteVatMode;
  const contract = await getFounderContractForQuote(session.founder.id, quoteId);

  return (
    <main className="operations-shell">
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / QUOTE HISTORY</p>
          <h1>{latest.title}</h1>
          <p>{detail.quote.clientName} · 현재 v{latest.versionNumber} · {quoteVatModeLabels[latestVatMode]}</p>
        </div>
        <div className="quote-header-links">
          {contract ? <Link className="text-link" href={`/contracts/${contract.id}`}>연결된 계약</Link> : null}
          <Link className="text-link" href="/quotes">견적서 목록</Link>
        </div>
      </header>
      {contract ? null : (
        <section className="quote-editor-card">
          <p className="setup-code">계약 초안</p>
          <p className="form-help">현재 견적 버전을 계약 초안으로 옮깁니다. 날인 원본 위치와 체결 확정은 계약 화면에서 이어갑니다.</p>
          <form action={createContractFromQuoteAction}>
            <input name="quoteVersionId" type="hidden" value={latest.id} />
            <button className="auth-submit" type="submit">이 버전으로 계약 초안 만들기</button>
          </form>
        </section>
      )}
      <section className="quote-editor-card">
        <p className="setup-code">새 수정본 만들기</p>
        <form action={saveQuoteVersionAction} className="quote-form">
          <input name="quoteId" type="hidden" value={detail.quote.id} />
          <input name="clientId" type="hidden" value={detail.quote.clientCompanyId} />
          <input name="projectId" type="hidden" value={detail.quote.projectId ?? ""} />
          <label className="quote-form-full">견적명<input defaultValue={latest.title} name="title" required /></label>
          <label className="quote-form-full">
            부가세
            <select defaultValue={latestVatMode} name="vatMode">
              <option value="exclusive">미포함 (별도)</option>
              <option value="inclusive">포함</option>
            </select>
          </label>
          <div className="quote-form-full"><QuoteItemsFields initialItems={items} /></div>
          <label className="quote-form-full">메모 (선택)<textarea defaultValue={latest.note ?? ""} name="note" /></label>
          <button className="auth-submit" type="submit">v{latest.versionNumber + 1} 저장</button>
        </form>
      </section>
      <section className="quote-list">
        <div className="list-heading">
          <div>
            <p className="setup-code">변경 이력</p>
            <h2>저장된 버전</h2>
          </div>
          <span>{detail.versions.length}개</span>
        </div>
        {detail.versions.map((version) => {
          const mode = (version.vatMode ?? "exclusive") as QuoteVatMode;
          return (
            <a className="quote-row" href={`/quotes/${detail.quote.id}/versions/${version.id}/print`} key={version.id}>
              <div>
                <p>v{version.versionNumber} · {quoteVatModeLabels[mode]}</p>
                <h3>{version.title}</h3>
              </div>
              <strong>{version.totalAmount.toLocaleString("ko-KR")}원</strong>
            </a>
          );
        })}
      </section>
    </main>
  );
}
