"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { createLedgerAccountAction } from "@/app/(private)/accounts/actions";
import { CreateIconButton } from "@/components/create-icon-button";
import { CreatePanel } from "@/components/create-panel";
import {
  formatLedgerAccountLabel,
  formatLedgerAccountListMeta,
  ledgerAccountClasses,
  ledgerAccountClassLabels,
  type LedgerAccountClass,
} from "@/lib/domain/ledger-accounts";

type AccountRow = {
  id: string;
  code: string;
  name: string;
  accountClass: LedgerAccountClass;
  categoryKey: string | null;
};

export function AccountsPageClient({ accounts }: { accounts: AccountRow[] }) {
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
          <p className="auth-eyebrow">CORELOOM / ACCOUNTS</p>
          <h1>계정과목</h1>
          <p>
            자산·부채·자본·수익·비용 과목을 두고 매출·비용 원장에서 고릅니다. 복식 분개·전표·세무 대행은 포함하지
            않습니다. 처음에는 기본 과목이 자동으로 채워집니다.
          </p>
        </div>
        <CreateIconButton label="과목 추가" onClick={openCreate} />
      </header>

      <section aria-label="계정과목 목록" className="quote-list">
        <div className="list-heading">
          <div>
            <p className="setup-code">마스터</p>
            <h2>계정과목</h2>
          </div>
          <span>{accounts.length}개</span>
        </div>
        {accounts.length === 0 ? (
          <div className="empty-state quote-empty-inline">
            <p>표시할 계정과목이 없습니다.</p>
            <button className="auth-submit" onClick={openCreate} type="button">
              첫 과목 만들기
            </button>
          </div>
        ) : (
          accounts.map((account) => (
            <div className="quote-row" key={account.id}>
              <div>
                <p>{formatLedgerAccountListMeta(account)}</p>
                <h3>{formatLedgerAccountLabel(account)}</h3>
              </div>
            </div>
          ))
        )}
      </section>

      <CreatePanel onClose={close} open={open} size="wide" title="과목 추가">
        <form action={createLedgerAccountAction} className="quote-form">
          <p className="setup-code quote-form-full">과목</p>
          <p className="form-help quote-form-full">
            코드는 워크스페이스 안에서 유일합니다. 수익·비용 과목만 원장 등록에 쓰이며, 자산·부채·자본은 이후 분개를
            위한 자리입니다.
          </p>
          <label>
            코드
            <input name="code" placeholder="예: 5600" required />
          </label>
          <label>
            이름
            <input name="name" placeholder="예: 교육비" required />
          </label>
          <label>
            구분
            <select defaultValue="expense" name="accountClass">
              {ledgerAccountClasses.map((accountClass) => (
                <option key={accountClass} value={accountClass}>
                  {ledgerAccountClassLabels[accountClass]}
                </option>
              ))}
            </select>
          </label>
          <label>
            원장 키 (선택)
            <input name="categoryKey" placeholder="예: marketing" />
          </label>
          <p className="form-help quote-form-full">
            원장 키는 예전 enum과 맞출 때만 적습니다. 비워 두면 코드·이름만 씁니다.
          </p>
          <button className="auth-submit" type="submit">
            과목 저장
          </button>
        </form>
      </CreatePanel>
    </>
  );
}
