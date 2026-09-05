"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { createClientAction } from "@/app/(private)/clients-projects/actions";
import { ClientCompanyFields } from "@/components/client-company-fields";
import { CreatePanel } from "@/components/create-panel";
import { DraftAwareForm } from "@/components/draft-aware-form";
import { DraftDiscardButton } from "@/components/draft-discard-button";
import { DraftSubmitButton } from "@/components/draft-submit-button";
import { formatClientListMeta, type ClientTaxType, type ClientTradeKind } from "@/lib/domain/clients-projects";
import styles from "@/components/sales-ux.module.css";

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

export function ClientsPageClient({ clients, draftScopeId }: { clients: ClientRow[]; draftScopeId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

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
  const filteredClients = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized ? clients.filter((client) => client.name.toLocaleLowerCase().includes(normalized)) : clients;
  }, [clients, query]);

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
        <button className={`auth-submit ${styles.createButton}`} onClick={openCreate} type="button"><span aria-hidden="true">＋</span> 새 고객사</button>
      </header>

      <section aria-label="고객사 목록" className="quote-list">
        <div className="list-heading">
          <div>
            <p className="setup-code">등록</p>
            <h2>고객사</h2>
          </div>
          <span>{filteredClients.length}개{query.trim() ? ` / 전체 ${clients.length}개` : ""}</span>
        </div>
        {clients.length > 0 ? (
          <label className={`quote-form-full ${styles.listSearch}`}>
            고객사 검색
            <input aria-label="고객사 검색" onChange={(event) => setQuery(event.target.value)} placeholder="상호로 검색" value={query} />
          </label>
        ) : null}
        {clients.length === 0 ? (
          <div className="empty-state quote-empty-inline">
            <p>등록된 고객사가 없습니다.</p>
            <button className="auth-submit" onClick={openCreate} type="button">
              첫 고객사 만들기
            </button>
          </div>
        ) : filteredClients.length === 0 ? (
          <p className="empty-state quote-empty-inline">검색 결과가 없습니다.</p>
        ) : (
          filteredClients.map((client) => (
            <a className="quote-row" href={`/clients/${client.id}`} key={client.id}>
              <div>
                <h3>{client.name}</h3>
                <p>{formatClientListMeta(client)}</p>
              </div>
            </a>
          ))
        )}
      </section>

      <CreatePanel onClose={close} open={open} size="wide" title="새 고객사">
        <DraftAwareForm action={createClientAction} className="quote-form" formId="client-create" scopeId={draftScopeId}>
          <ClientCompanyFields includeFirstContact progressiveDetails />
          <div className="quote-form-full" style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            <DraftSubmitButton className="auth-submit">고객사 저장</DraftSubmitButton>
            <DraftDiscardButton />
          </div>
        </DraftAwareForm>
      </CreatePanel>
    </>
  );
}
