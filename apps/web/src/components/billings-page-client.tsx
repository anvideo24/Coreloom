"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { createBillingAction, createRecurringSeriesAction } from "@/app/(private)/billings/actions";
import { CreateIconButton } from "@/components/create-icon-button";
import { CreatePanel } from "@/components/create-panel";
import {
  billingKindLabels,
  billingKinds,
  billingStatusLabels,
  type BillingKind,
  type BillingStatus,
} from "@/lib/domain/billings";

type ExecutableContract = {
  contractId: string;
  clientName: string;
  title: string;
  totalAmount: number;
};

type BillingRow = {
  id: string;
  clientName: string;
  contractTitle: string;
  kind: BillingKind;
  status: BillingStatus;
  dueDate: string;
  amount: number;
  billingNumber: string | null;
  poNumber: string | null;
};

type SeriesRow = {
  id: string;
  clientName: string;
  contractTitle: string;
  startDate: string;
  endDate: string;
  occurrenceCount: number;
  amount: number;
};

type PanelMode = "billing" | "series" | null;

export function BillingsPageClient({
  billings,
  executableContracts,
  series,
}: {
  billings: BillingRow[];
  executableContracts: ExecutableContract[];
  series: SeriesRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<PanelMode>(null);

  useEffect(() => {
    const next = searchParams.get("new");
    if (next === "1") setMode("billing");
    else if (next === "series") setMode("series");
    else setMode(null);
  }, [searchParams]);

  const close = useCallback(() => {
    setMode(null);
    if (searchParams.get("new")) router.replace(pathname);
  }, [pathname, router, searchParams]);

  const openBilling = useCallback(() => {
    setMode("billing");
    router.replace(`${pathname}?new=1`);
  }, [pathname, router]);

  const openSeries = useCallback(() => {
    setMode("series");
    router.replace(`${pathname}?new=series`);
  }, [pathname, router]);

  const canCreate = executableContracts.length > 0;

  return (
    <>
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / BILLINGS</p>
          <h1>분할 청구</h1>
          <p>
            체결된 계약에 착수금·중도금·잔금 또는 월 반복 청구 일정을 등록합니다. 반복 청구는 시작일부터 종료일까지 매달
            예정 청구를 한 번에 만들며, 메일과 입금 확인은 각 청구에서 따로 합니다. 세금계산서 발행은 포함하지 않습니다.
          </p>
        </div>
        {canCreate ? (
          <div className="quote-header-links">
            <CreateIconButton label="단건 청구" onClick={openBilling} />
            <CreateIconButton className="create-icon-button-secondary" label="반복 청구" onClick={openSeries} />
          </div>
        ) : (
          <CreateIconButton disabled label="단건 청구" />
        )}
      </header>

      {!canCreate ? (
        <section className="empty-state quote-empty">
          <h2>먼저 계약을 체결해 주세요</h2>
          <p>분할 청구는 체결된 계약에만 연결합니다. 초안 계약에는 청구 일정을 만들지 않습니다.</p>
          <a className="text-link" href="/contracts">
            계약 목록으로 이동
          </a>
        </section>
      ) : null}

      <section aria-label="반복 청구 일정" className="quote-list">
        <div className="list-heading">
          <div>
            <p className="setup-code">월 반복</p>
            <h2>반복 청구 일정</h2>
          </div>
          <span>{series.length}개</span>
        </div>
        {series.length === 0 ? (
          <div className="empty-state quote-empty-inline">
            <p>등록된 반복 청구 일정이 없습니다.</p>
            {canCreate ? (
              <button className="auth-submit" onClick={openSeries} type="button">
                반복 청구 등록
              </button>
            ) : null}
          </div>
        ) : (
          series.map((item) => (
            <a className="quote-row" href={`/billings/series/${item.id}`} key={item.id}>
              <div>
                <p>
                  {item.clientName} · 매월 · {item.startDate} ~ {item.endDate} · {item.occurrenceCount}회
                </p>
                <h3>{item.contractTitle}</h3>
              </div>
              <strong>{item.amount.toLocaleString("ko-KR")}원</strong>
            </a>
          ))
        )}
      </section>

      <section aria-label="청구 목록" className="quote-list">
        <div className="list-heading">
          <div>
            <p className="setup-code">등록된 일정</p>
            <h2>청구 이력</h2>
          </div>
          <span>{billings.length}개</span>
        </div>
        {billings.length === 0 ? (
          <div className="empty-state quote-empty-inline">
            <p>아직 등록된 청구 일정이 없습니다.</p>
            {canCreate ? (
              <button className="auth-submit" onClick={openBilling} type="button">
                첫 청구 일정 만들기
              </button>
            ) : null}
          </div>
        ) : (
          billings.map((billing) => (
            <a className="quote-row" href={`/billings/${billing.id}`} key={billing.id}>
              <div>
                <p>
                  {billing.clientName} · {billingKindLabels[billing.kind]} · {billingStatusLabels[billing.status]} · 예정{" "}
                  {billing.dueDate}
                  {billing.billingNumber ? ` · ${billing.billingNumber}` : ""}
                  {billing.poNumber ? ` · PO ${billing.poNumber}` : ""}
                </p>
                <h3>{billing.contractTitle}</h3>
              </div>
              <strong>{billing.amount.toLocaleString("ko-KR")}원</strong>
            </a>
          ))
        )}
      </section>

      {canCreate ? (
        <CreatePanel onClose={close} open={mode === "billing"} size="wide" title="단건 청구">
          <form action={createBillingAction} className="quote-form">
            <p className="setup-code quote-form-full">연결</p>
            <label className="quote-form-full">
              계약
              <select name="contractId" required>
                {executableContracts.map((contract) => (
                  <option key={contract.contractId} value={contract.contractId}>
                    {contract.clientName} · {contract.title} · {contract.totalAmount.toLocaleString("ko-KR")}원
                  </option>
                ))}
              </select>
            </label>

            <p className="setup-code quote-form-full">청구</p>
            <label>
              구분
              <select name="kind" required>
                {billingKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {billingKindLabels[kind]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              금액 (원)
              <input min={1} name="amount" required step={1} type="number" />
            </label>
            <label>
              청구일
              <input name="billingDate" required type="date" />
            </label>
            <label>
              입금 예정일
              <input name="dueDate" required type="date" />
            </label>
            <label>
              청구번호 (선택)
              <input name="billingNumber" placeholder="내부 청구번호" />
            </label>
            <label>
              PO·발주번호 (선택)
              <input name="poNumber" placeholder="고객사 발주번호" />
            </label>
            <label className="quote-form-full">
              메모 (선택)
              <textarea name="note" placeholder="입금 계좌나 조건" />
            </label>
            <button className="auth-submit" type="submit">
              청구 일정 저장
            </button>
          </form>
        </CreatePanel>
      ) : null}

      {canCreate ? (
        <CreatePanel onClose={close} open={mode === "series"} size="wide" title="반복 청구">
          <form action={createRecurringSeriesAction} className="quote-form">
            <p className="setup-code quote-form-full">월 반복</p>
            <p className="form-help quote-form-full">
              매달 같은 금액의 예정 청구를 시작일부터 종료일까지 만듭니다. 한 번에 최대 24개월이며, 자동 메일 발송과 입금
              확정은 하지 않습니다.
            </p>
            <label className="quote-form-full">
              계약
              <select name="contractId" required>
                {executableContracts.map((contract) => (
                  <option key={`series-${contract.contractId}`} value={contract.contractId}>
                    {contract.clientName} · {contract.title} · {contract.totalAmount.toLocaleString("ko-KR")}원
                  </option>
                ))}
              </select>
            </label>
            <label>
              월 금액 (원)
              <input min={1} name="amount" required step={1} type="number" />
            </label>
            <label>
              입금 예정 지연(일)
              <input defaultValue={0} max={31} min={0} name="dueOffsetDays" required step={1} type="number" />
            </label>
            <label>
              시작 청구일
              <input name="startDate" required type="date" />
            </label>
            <label>
              마지막 청구일
              <input name="endDate" required type="date" />
            </label>
            <label className="quote-form-full">
              메모 (선택)
              <textarea name="note" placeholder="월 유지보수, 계좌 안내" />
            </label>
            <label className="quote-email-approval quote-form-full">
              <input name="approved" required type="checkbox" value="true" />
              금액과 기간을 확인했고, 대표로서 이 반복 청구 일정을 등록합니다.
            </label>
            <button className="auth-submit" type="submit">
              반복 청구 일정 저장
            </button>
          </form>
        </CreatePanel>
      ) : null}
    </>
  );
}
