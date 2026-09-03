import { redirect } from "next/navigation";

import { createExpenseEntryAction } from "@/app/(private)/expenses/actions";
import { founderSession } from "@/lib/auth/session";
import { expenseEntryStatusLabels } from "@/lib/domain/expenses";
import { UNCLASSIFIED_LABEL, ventureKindLabels } from "@/lib/domain/revenue";
import { listFounderExpenseLedger } from "@/lib/expenses/repository";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { ventures, projects, rows, summary } = await listFounderExpenseLedger(session.founder.id);

  return (
    <main className="operations-shell">
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / EXPENSES</p>
          <h1>비용 원장</h1>
          <p>고객사 프로젝트 또는 앱·구독 사업에 비용을 연결합니다. 금액은 통화·발생일·지급 예정일·확정 상태를 함께 가지며, 연결하지 못한 건은 미분류로 표시합니다. 자동 이체, 급여, 세금계산서 발행은 이 기능에 포함되지 않습니다.</p>
        </div>
      </header>
      <section className="quote-editor-card">
        <p className="setup-code">비용 등록</p>
        <p className="form-help">프로젝트와 사업을 동시에 고르지 마세요. 둘 다 비우면 미분류입니다. 사업은 매출 원장에서 먼저 등록합니다.</p>
        <form action={createExpenseEntryAction} className="quote-form">
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
          <label>지급 예정일<input name="settlementDate" required type="date" /></label>
          <label className="quote-form-full">메모 (선택)<input name="note" /></label>
          <button className="auth-submit" type="submit">비용 저장</button>
        </form>
      </section>
      <section className="quote-list" aria-label="비용 원장">
        <div className="list-heading">
          <div>
            <p className="setup-code">원장</p>
            <h2>프로젝트와 사업 비용</h2>
          </div>
          <span>{rows.length}건</span>
        </div>
        {rows.length === 0 ? (
          <p className="empty-state">표시할 비용이 없습니다. 합계 0원은 만들지 않습니다.</p>
        ) : (
          <>
            <p className="form-help">확정 {summary.confirmedAmount.toLocaleString("ko-KR")}원 · 예정 {summary.scheduledAmount.toLocaleString("ko-KR")}원 · {UNCLASSIFIED_LABEL} {summary.unclassifiedCount}건</p>
            {rows.map((row) => (
              <a className="quote-row" href={row.href} key={row.id}>
                <div>
                  <p>{row.sourceLabel} · {row.counterparty} · {expenseEntryStatusLabels[row.status]} · 지급 {row.settlementDate}</p>
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
