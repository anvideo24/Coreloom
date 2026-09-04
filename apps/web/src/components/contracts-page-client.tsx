"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { createContractFromQuoteAction } from "@/app/(private)/contracts/actions";
import { CreateIconButton } from "@/components/create-icon-button";
import { CreatePanel } from "@/components/create-panel";
import { contractStatusLabels, type ContractStatus } from "@/lib/domain/contracts";

type ConvertibleQuote = {
  versionId: string;
  clientName: string;
  title: string;
  versionNumber: number;
  totalAmount: number;
};

type ContractRow = {
  contractId: string;
  clientName: string;
  title: string;
  versionNumber: number;
  status: ContractStatus;
  totalAmount: number;
};

export function ContractsPageClient({
  contracts,
  convertibleQuotes,
}: {
  contracts: ContractRow[];
  convertibleQuotes: ConvertibleQuote[];
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

  const canCreate = convertibleQuotes.length > 0;

  return (
    <>
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / CONTRACTS</p>
          <h1>계약</h1>
          <p>
            견적 버전을 계약 초안으로 옮긴 뒤, 날인 원본 위치를 기록하고 대표가 체결을 확정합니다. 전자서명 공급자는 아직
            연결하지 않습니다.
          </p>
        </div>
        <CreateIconButton disabled={!canCreate} label="새 계약" onClick={openCreate} />
      </header>

      {!canCreate ? (
        <section className="empty-state quote-empty">
          <h2>{contracts.length === 0 ? "먼저 견적서를 저장해 주세요" : "전환할 새 견적이 없습니다"}</h2>
          <p>계약은 저장된 견적 버전에서만 만들 수 있습니다. 이미 계약이 있는 견적은 기존 계약 이력에서 수정본을 만듭니다.</p>
          <a className="text-link" href="/quotes">
            견적서 목록으로 이동
          </a>
        </section>
      ) : null}

      <section aria-label="계약 목록" className="quote-list">
        <div className="list-heading">
          <div>
            <p className="setup-code">보관된 계약</p>
            <h2>계약 이력</h2>
          </div>
          <span>{contracts.length}개</span>
        </div>
        {contracts.length === 0 ? (
          <div className="empty-state quote-empty-inline">
            <p>아직 저장된 계약이 없습니다.</p>
            {canCreate ? (
              <button className="auth-submit" onClick={openCreate} type="button">
                첫 계약 초안 만들기
              </button>
            ) : null}
          </div>
        ) : (
          contracts.map((contract) => (
            <a className="quote-row" href={`/contracts/${contract.contractId}`} key={contract.contractId}>
              <div>
                <p>
                  {contract.clientName} · v{contract.versionNumber} · {contractStatusLabels[contract.status]}
                </p>
                <h3>{contract.title}</h3>
              </div>
              <strong>{contract.totalAmount.toLocaleString("ko-KR")}원</strong>
            </a>
          ))
        )}
      </section>

      {canCreate ? (
        <CreatePanel onClose={close} open={open} size="wide" title="새 계약">
          <form action={createContractFromQuoteAction} className="quote-form">
            <p className="setup-code quote-form-full">견적에서 초안</p>
            <p className="form-help quote-form-full">
              선택한 견적 버전의 금액·항목이 계약 초안으로 복사됩니다. 날인 원본 위치·체결은 상세에서 이어갑니다. 계약
              기간·자동갱신·전자서명은 이후 필드입니다.
            </p>
            <label className="quote-form-full">
              견적 버전
              <select name="quoteVersionId" required>
                {convertibleQuotes.map((quote) => (
                  <option key={quote.versionId} value={quote.versionId}>
                    {quote.clientName} · {quote.title} · v{quote.versionNumber} ·{" "}
                    {quote.totalAmount.toLocaleString("ko-KR")}원
                  </option>
                ))}
              </select>
            </label>
            <button className="auth-submit" type="submit">
              계약 초안 저장
            </button>
          </form>
        </CreatePanel>
      ) : null}
    </>
  );
}
