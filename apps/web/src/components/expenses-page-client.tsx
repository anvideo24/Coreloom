"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { createExpenseEntryAction } from "@/app/(private)/expenses/actions";
import { CreateIconButton } from "@/components/create-icon-button";
import { CreatePanel } from "@/components/create-panel";
import { DraftAwareForm } from "@/components/draft-aware-form";
import { DraftDiscardButton } from "@/components/draft-discard-button";
import { DraftSubmitButton } from "@/components/draft-submit-button";
import { expenseEntryStatusLabels, type ExpenseEntryStatus } from "@/lib/domain/expenses";
import { formatLedgerAccountLabel } from "@/lib/domain/ledger-accounts";
import { UNCLASSIFIED_LABEL, ventureKindLabels, type VentureKind } from "@/lib/domain/revenue";

type Project = { id: string; name: string; clientName: string };
type Venture = { id: string; name: string; kind: VentureKind };
type Supplier = { id: string; name: string };
type Account = { id: string; code: string; name: string };
type ExpenseRow = {
  id: string;
  href: string;
  sourceLabel: string;
  counterparty: string;
  status: ExpenseEntryStatus;
  settlementDate: string;
  title: string;
  amount: number;
};
type Summary = {
  confirmedAmount: number;
  scheduledAmount: number;
  unclassifiedCount: number;
};

export function ExpensesPageClient({
  ventures,
  projects,
  suppliers,
  accounts,
  rows,
  summary,
  draftScopeId,
}: {
  ventures: Venture[];
  projects: Project[];
  suppliers: Supplier[];
  accounts: Account[];
  rows: ExpenseRow[];
  summary: Summary;
  draftScopeId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(searchParams.get("new") === "1");
  }, [searchParams]);

  const close = useCallback(() => {
    setOpen(false);
    if (searchParams.get("new") === "1") router.replace(pathname);
  }, [pathname, router, searchParams]);

  const openCreate = useCallback(() => {
    setOpen(true);
    router.replace(`${pathname}?new=1`);
  }, [pathname, router]);

  return (
    <>
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / EXPENSES</p>
          <h1>비용 원장</h1>
          <p>
            고객사 프로젝트 또는 앱·구독 사업에 비용을 연결합니다. 금액은 통화·발생일·지급 예정일·확정 상태를 함께
            가지며, 연결하지 못한 건은 미분류로 표시합니다. 자동 이체, 급여, 세금계산서 발행은 이 기능에 포함되지
            않습니다.
          </p>
        </div>
        <CreateIconButton label="비용 등록" onClick={openCreate} />
      </header>

      <section aria-label="비용 원장" className="quote-list">
        <div className="list-heading">
          <div>
            <p className="setup-code">원장</p>
            <h2>프로젝트와 사업 비용</h2>
          </div>
          <span>{rows.length}건</span>
        </div>
        {rows.length === 0 ? (
          <div className="empty-state quote-empty-inline">
            <p>표시할 비용이 없습니다. 합계 0원은 만들지 않습니다.</p>
            <button className="auth-submit" onClick={openCreate} type="button">
              첫 비용 등록
            </button>
          </div>
        ) : (
          <>
            <p className="form-help">
              확정 {summary.confirmedAmount.toLocaleString("ko-KR")}원 · 예정{" "}
              {summary.scheduledAmount.toLocaleString("ko-KR")}원 · {UNCLASSIFIED_LABEL} {summary.unclassifiedCount}건
            </p>
            {rows.map((row) => (
              <a className="quote-row" href={row.href} key={row.id}>
                <div>
                  <p>
                    {row.sourceLabel} · {row.counterparty} · {expenseEntryStatusLabels[row.status]} · 지급{" "}
                    {row.settlementDate}
                  </p>
                  <h3>{row.title}</h3>
                </div>
                <strong>{row.amount.toLocaleString("ko-KR")}원</strong>
              </a>
            ))}
          </>
        )}
      </section>

      <CreatePanel onClose={close} open={open} showHeader size="wide" title="비용 등록">
        <DraftAwareForm action={createExpenseEntryAction} className="quote-form" formId="expense-create" scopeId={draftScopeId}>
          <p className="setup-code quote-form-full">연결</p>
          <p className="form-help quote-form-full">
            프로젝트와 사업을 동시에 고르지 마세요. 둘 다 비우면 미분류입니다. 사업은 매출 원장에서 먼저 등록합니다.
            매입처는 거래 유형이 매입 또는 매출·매입인 고객사만 고를 수 있고, 이름을 비우면 그 상호로 채웁니다. 고객사에 없는
            거래처는 이름만 적어도 됩니다. 증빙 파일은 문서함에서 연결합니다.
          </p>
          <label>
            고객사 프로젝트 (선택)
            <select defaultValue="" name="projectId">
              <option value="">연결 안 함</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.clientName} · {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            앱·구독 사업 (선택)
            <select defaultValue="" name="ventureId">
              <option value="">연결 안 함</option>
              {ventures.map((venture) => (
                <option key={venture.id} value={venture.id}>
                  {ventureKindLabels[venture.kind]} · {venture.name}
                </option>
              ))}
            </select>
          </label>

          <p className="setup-code quote-form-full">금액·매입</p>
          <label>
            계정과목 (선택)
            <select defaultValue="" name="ledgerAccountId">
              <option value="">미정</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {formatLedgerAccountLabel(account)}
                </option>
              ))}
            </select>
          </label>
          <label>
            매입처 고객사 (선택)
            <select defaultValue="" name="supplierClientCompanyId">
              <option value="">선택 안 함</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            매입처 이름 (선택)
            <input name="supplierName" placeholder="고객사 미연결 시 또는 병기" />
          </label>
          <label>
            금액 (원)
            <input min={1} name="amount" required step={1} type="number" />
          </label>
          <label>
            발생일
            <input name="occurredOn" required type="date" />
          </label>
          <label>
            지급 예정일
            <input name="settlementDate" required type="date" />
          </label>
          <label>
            메모 (선택)
            <input name="note" />
          </label>
          <div className="quote-form-full">
            <DraftSubmitButton className="auth-submit">비용 저장</DraftSubmitButton>
            <DraftDiscardButton />
          </div>
        </DraftAwareForm>
      </CreatePanel>
    </>
  );
}
