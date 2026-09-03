import { redirect } from "next/navigation";

import { createBillingAction } from "@/app/(private)/billings/actions";
import { founderSession } from "@/lib/auth/session";
import { listFounderBillings } from "@/lib/billings/repository";
import { billingKindLabels, billingKinds, billingStatusLabels } from "@/lib/domain/billings";

export const dynamic = "force-dynamic";

export default async function BillingsPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { billings, executableContracts } = await listFounderBillings(session.founder.id);

  return (
    <main className="operations-shell">
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / BILLINGS</p>
          <h1>분할 청구</h1>
          <p>체결된 계약에 착수금·중도금·잔금 일정을 등록합니다. 입금은 대표가 확인한 뒤에만 확정됩니다. 각 청구에서 부가세 별도 PDF를 내려받거나 대표 승인 뒤 이메일로 보낼 수 있습니다. 세금계산서 발행은 포함하지 않습니다.</p>
        </div>
      </header>
      {executableContracts.length === 0 ? (
        <section className="empty-state quote-empty">
          <h2>먼저 계약을 체결해 주세요</h2>
          <p>분할 청구는 체결된 계약에만 연결합니다. 초안 계약에는 청구 일정을 만들지 않습니다.</p>
          <a className="text-link" href="/contracts">계약 목록으로 이동</a>
        </section>
      ) : (
        <section className="quote-editor-card">
          <p className="setup-code">청구 일정 등록</p>
          <form action={createBillingAction} className="quote-form">
            <label>계약
              <select name="contractId" required>
                {executableContracts.map((contract) => (
                  <option key={contract.contractId} value={contract.contractId}>
                    {contract.clientName} · {contract.title} · {contract.totalAmount.toLocaleString("ko-KR")}원
                  </option>
                ))}
              </select>
            </label>
            <label>구분
              <select name="kind" required>
                {billingKinds.map((kind) => <option key={kind} value={kind}>{billingKindLabels[kind]}</option>)}
              </select>
            </label>
            <label>금액 (원)<input min={1} name="amount" required step={1} type="number" /></label>
            <label>청구일<input name="billingDate" required type="date" /></label>
            <label>입금 예정일<input name="dueDate" required type="date" /></label>
            <label className="quote-form-full">메모 (선택)<textarea name="note" placeholder="입금 계좌나 조건" /></label>
            <button className="auth-submit" type="submit">청구 일정 저장</button>
          </form>
        </section>
      )}
      <section className="quote-list" aria-label="청구 목록">
        <div className="list-heading">
          <div>
            <p className="setup-code">등록된 일정</p>
            <h2>청구 이력</h2>
          </div>
          <span>{billings.length}개</span>
        </div>
        {billings.length === 0 ? <p className="empty-state">아직 등록된 청구 일정이 없습니다.</p> : billings.map((billing) => (
          <a className="quote-row" href={`/billings/${billing.id}`} key={billing.id}>
            <div>
              <p>{billing.clientName} · {billingKindLabels[billing.kind]} · {billingStatusLabels[billing.status]} · 예정 {billing.dueDate}</p>
              <h3>{billing.contractTitle}</h3>
            </div>
            <strong>{billing.amount.toLocaleString("ko-KR")}원</strong>
          </a>
        ))}
      </section>
    </main>
  );
}
