import { redirect } from "next/navigation";

import { createRevenueEntryAction, createVentureAction } from "@/app/(private)/revenue/actions";
import { founderSession } from "@/lib/auth/session";
import { revenueEntryStatusLabels, UNCLASSIFIED_LABEL, ventureKindLabels, ventureKinds } from "@/lib/domain/revenue";
import { listFounderRevenueLedger } from "@/lib/revenue/repository";

export const dynamic = "force-dynamic";

export default async function RevenuePage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { ventures, projects, rows, summary } = await listFounderRevenueLedger(session.founder.id);

  return (
    <main className="operations-shell">
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / REVENUE</p>
          <h1>매출 원장</h1>
          <p>고객사 프로젝트 청구와 앱·구독 매출을 한 목록에서 봅니다. 금액은 통화·발생일·정산일·확정 상태를 함께 가지며, 연결하지 못한 건은 미분류로 표시합니다. 확정된 매출에 대해 환불을 등록하면 원래 금액을 덮어쓰지 않고 별도 환불 이력으로 남깁니다. 비용은 비용 원장에서 따로 봅니다. 결제 채널 자동 수집과 세금계산서는 이 기능에 포함되지 않습니다.</p>
        </div>
      </header>
      <section className="registration-grid" aria-label="등록">
        <form action={createVentureAction} className="registration-card">
          <p className="setup-code">1. 사업 등록</p>
          <h2>앱·구독 사업</h2>
          <label>사업명<input name="name" placeholder="예: 구독 서비스" required /></label>
          <label>종류<select defaultValue="app" name="kind">{ventureKinds.map((kind) => <option key={kind} value={kind}>{ventureKindLabels[kind]}</option>)}</select></label>
          <button className="auth-submit" type="submit">사업 저장</button>
        </form>
        <form action={createRevenueEntryAction} className="registration-card">
          <p className="setup-code">2. 매출 등록</p>
          <h2>앱·구독·미분류</h2>
          <p className="form-help">고객사 프로젝트 청구는 청구 화면에서 등록합니다. 여기에서는 앱·구독 또는 아직 연결하지 못한 매출만 남깁니다. 프로젝트와 사업을 동시에 고르지 마세요. 둘 다 비우면 미분류입니다.</p>
          <label>고객사 프로젝트 (선택)
            <select defaultValue="" name="projectId">
              <option value="">연결 안 함</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.clientName} · {project.name}</option>)}
            </select>
          </label>
          <label>앱·구독 사업 (선택)
            <select defaultValue="" name="ventureId">
              <option value="">연결 안 함</option>
              {ventures.map((venture) => <option key={venture.id} value={venture.id}>{ventureKindLabels[venture.kind]} · {venture.name}</option>)}
            </select>
          </label>
          <label>금액 (원)<input min={1} name="amount" required step={1} type="number" /></label>
          <label>발생일<input name="occurredOn" required type="date" /></label>
          <label>정산일<input name="settlementDate" required type="date" /></label>
          <label>메모 (선택)<input name="note" /></label>
          <button className="auth-submit" type="submit">매출 저장</button>
        </form>
      </section>
      <section className="quote-list" aria-label="매출 원장">
        <div className="list-heading">
          <div>
            <p className="setup-code">원장</p>
            <h2>고객사 프로젝트와 앱·구독</h2>
          </div>
          <span>{rows.length}건</span>
        </div>
        {rows.length === 0 ? (
          <p className="empty-state">표시할 매출이 없습니다. 청구 입금 또는 앱·구독 매출을 등록하면 이 목록에 모입니다. 합계 0원은 만들지 않습니다.</p>
        ) : (
          <>
            <p className="form-help">확정 {summary.confirmedAmount.toLocaleString("ko-KR")}원 · 예정 {summary.scheduledAmount.toLocaleString("ko-KR")}원{summary.refundedAmount > 0 ? ` · 환불 ${summary.refundedAmount.toLocaleString("ko-KR")}원` : ""} · {UNCLASSIFIED_LABEL} {summary.unclassifiedCount}건</p>
            {rows.map((row) => (
              <a className="quote-row" href={row.href} key={row.id}>
                <div>
                  <p>{row.sourceLabel} · {row.counterparty} · {revenueEntryStatusLabels[row.status]} · 정산 {row.settlementDate}</p>
                  <h3>{row.title}</h3>
                </div>
                <strong>{row.amount.toLocaleString("ko-KR")}원</strong>
              </a>
            ))}
          </>
        )}
      </section>
    </main>
  );
}
