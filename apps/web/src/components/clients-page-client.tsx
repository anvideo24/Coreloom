"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { createClientAction } from "@/app/(private)/clients-projects/actions";
import { ClientCompanyFields } from "@/components/client-company-fields";
import { CreateIconButton } from "@/components/create-icon-button";
import { CreatePanel } from "@/components/create-panel";
import { formatClientListMeta, type ClientTaxType, type ClientTradeKind } from "@/lib/domain/clients-projects";

type ClientRow = {
  id: string;
  name: string;
  businessRegistrationNumber: string | null;
  representativeName: string | null;
  taxType: ClientTaxType | null;
  tradeKind: ClientTradeKind;
  contactCount: number;
  projectCount: number;
};

export function ClientsPageClient({ clients }: { clients: ClientRow[] }) {
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
          <p className="auth-eyebrow">CORELOOM / CLIENTS</p>
          <h1>고객사</h1>
          <p>
            상호·사업자번호·대표자·거래 유형(매출/매입)·주소를 두고 세금계산서·계약·비용 매입에 씁니다. 담당자는
            고객사를 연 뒤 추가합니다.
          </p>
        </div>
        <CreateIconButton label="새 고객사" onClick={openCreate} />
      </header>

      <section aria-label="고객사 목록" className="quote-list">
        <div className="list-heading">
          <div>
            <p className="setup-code">등록</p>
            <h2>고객사</h2>
          </div>
          <span>{clients.length}개</span>
        </div>
        {clients.length === 0 ? (
          <div className="empty-state quote-empty-inline">
            <p>등록된 고객사가 없습니다.</p>
            <button className="auth-submit" onClick={openCreate} type="button">
              첫 고객사 만들기
            </button>
          </div>
        ) : (
          clients.map((client) => (
            <a className="quote-row" href={`/clients/${client.id}`} key={client.id}>
              <div>
                <p>{formatClientListMeta(client)}</p>
                <h3>{client.name}</h3>
              </div>
            </a>
          ))
        )}
      </section>

      <CreatePanel onClose={close} open={open} size="wide" title="새 고객사">
        <form action={createClientAction} className="quote-form">
          <ClientCompanyFields includeFirstContact />
          <button className="auth-submit" type="submit">
            고객사 저장
          </button>
        </form>
      </CreatePanel>
    </>
  );
}
