import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  createContractAmendmentAction,
  executeContractAction,
  recordContractOriginalAction,
} from "@/app/(private)/contracts/actions";
import { founderSession } from "@/lib/auth/session";
import { getFounderContractDetail } from "@/lib/contracts/repository";
import { contractStatusLabels } from "@/lib/domain/contracts";
import { normalizeStoredQuoteItemsForPdf } from "@/lib/domain/quotes";

export const dynamic = "force-dynamic";

export default async function ContractDetailPage({ params }: { params: Promise<{ contractId: string }> }) {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { contractId } = await params;
  const detail = await getFounderContractDetail(session.founder.id, contractId);
  if (!detail) notFound();
  const latest = detail.versions[0];
  const items = normalizeStoredQuoteItemsForPdf(latest.items);

  return (
    <main className="operations-shell">
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / CONTRACT HISTORY</p>
          <h1>{latest.title}</h1>
          <p>{detail.contract.clientName} · 현재 v{latest.versionNumber} · {contractStatusLabels[latest.status]} · {latest.currency}</p>
        </div>
        <div className="quote-header-links">
          {latest.status === "executed" ? <Link className="text-link" href="/billings">분할 청구</Link> : null}
          <Link className="text-link" href="/contracts">계약 목록</Link>
        </div>
      </header>

      {latest.status !== "executed" ? (
        <section className="quote-editor-card">
          <p className="setup-code">날인 원본 위치</p>
          <form action={recordContractOriginalAction} className="quote-form">
            <input name="contractId" type="hidden" value={detail.contract.id} />
            <label className="quote-form-full">원본 경로 또는 링크
              <input defaultValue={latest.originalReference ?? ""} name="originalReference" placeholder="예: 회사 문서함/계약/고객사-날인본.pdf" required />
            </label>
            <button className="auth-submit" type="submit">날인 원본 위치 저장</button>
          </form>
        </section>
      ) : null}

      {latest.status === "original_recorded" ? (
        <section className="quote-editor-card">
          <p className="setup-code">체결 확정</p>
          <p className="form-help">체결하면 이 버전은 덮어쓰지 않습니다. 내용은 새 수정본으로만 이어갑니다.</p>
          <form action={executeContractAction} className="quote-form">
            <input name="contractId" type="hidden" value={detail.contract.id} />
            <label className="quote-email-approval quote-form-full">
              <input name="approved" required type="checkbox" value="true" />
              날인 원본 위치와 금액을 확인했고, 대표로서 이 버전을 최종 계약으로 체결합니다.
            </label>
            <button className="auth-submit" type="submit">최종 계약으로 체결</button>
          </form>
        </section>
      ) : null}

      {latest.status === "executed" ? (
        <section className="quote-editor-card">
          <p className="setup-code">수정본</p>
          <p className="form-help">체결된 버전은 그대로 두고, 같은 견적 금액을 복사한 새 초안을 만듭니다.</p>
          <form action={createContractAmendmentAction}>
            <input name="contractId" type="hidden" value={detail.contract.id} />
            <button className="auth-submit" type="submit">v{latest.versionNumber + 1} 초안 만들기</button>
          </form>
        </section>
      ) : null}

      <section className="quote-editor-card">
        <p className="setup-code">이 버전 금액</p>
        <p>{latest.currency} · 부가세 별도 · 공급가액 {latest.subtotalAmount.toLocaleString("ko-KR")}원 · 합계 {latest.totalAmount.toLocaleString("ko-KR")}원</p>
        <ul className="contract-item-list">
          {items.map((item, index) => (
            <li key={`${item.title}-${index}`}>{item.title} · {item.amount.toLocaleString("ko-KR")}원</li>
          ))}
        </ul>
        {latest.originalReference ? <p className="form-help">원본 위치: {latest.originalReference}</p> : null}
        <p><Link className="text-link" href={`/quotes/${detail.contract.quoteId}`}>연결된 견적 이력</Link></p>
      </section>

      <section className="quote-list">
        <div className="list-heading">
          <div>
            <p className="setup-code">변경 이력</p>
            <h2>저장된 버전</h2>
          </div>
          <span>{detail.versions.length}개</span>
        </div>
        {detail.versions.map((version) => (
          <article className="quote-row" key={version.id}>
            <div>
              <p>v{version.versionNumber} · {contractStatusLabels[version.status]}{version.executedAt ? ` · ${version.executedAt.toLocaleDateString("ko-KR")}` : ""}</p>
              <h3>{version.title}</h3>
            </div>
            <strong>{version.totalAmount.toLocaleString("ko-KR")}원</strong>
          </article>
        ))}
      </section>
    </main>
  );
}
