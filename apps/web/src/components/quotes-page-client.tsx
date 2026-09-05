"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { createClientFromQuoteAction } from "@/app/(private)/clients-projects/actions";
import { saveQuoteVersionAction } from "@/app/(private)/quotes/actions";
import { ClientCompanyFields } from "@/components/client-company-fields";
import { CreateIconButton } from "@/components/create-icon-button";
import { CreatePanel } from "@/components/create-panel";
import { DraftAwareForm } from "@/components/draft-aware-form";
import { DraftDiscardButton } from "@/components/draft-discard-button";
import { DraftSubmitButton } from "@/components/draft-submit-button";
import { QuoteClientProjectFields } from "@/components/quote-client-project-fields";
import {
  QuoteCostingComposer,
  type QuoteComposerContact,
} from "@/components/quote-costing-composer";
import {
  companyProfileStorageMissingMessage,
  type CompanyProfileStorageState,
} from "@/lib/company-setup/profile-storage";
import type { QuoteIssuerProfile } from "@/lib/quotes/issuer";

type Client = { id: string; name: string };
type Project = { id: string; name: string; clientCompanyId: string };
type Version = {
  quoteId: string;
  versionId: string;
  versionNumber: number;
  title: string;
  totalAmount: number;
  clientName: string;
  vatMode?: "exclusive" | "inclusive";
  issuedOn?: string | Date | null;
  validUntil?: string | Date | null;
};

type PanelMode = "quote" | "new-client";

export function QuotesPageClient({
  clients,
  projects,
  contacts,
  versions,
  issuer,
  companyProfileStorage = "ready",
  draftScopeId,
}: {
  clients: Client[];
  projects: Project[];
  contacts: QuoteComposerContact[];
  versions: Version[];
  issuer: QuoteIssuerProfile;
  companyProfileStorage?: CompanyProfileStorageState;
  draftScopeId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>("quote");
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");

  useEffect(() => {
    const wantsNew = searchParams.get("new") === "1";
    setOpen(wantsNew);
    const requestedClientId = searchParams.get("clientId");
    if (requestedClientId && clients.some((client) => client.id === requestedClientId)) {
      setClientId(requestedClientId);
      setPanelMode("quote");
    } else if (wantsNew && clients.length === 0) {
      setPanelMode("new-client");
    }
  }, [searchParams, clients]);

  useEffect(() => {
    if (!clients.some((client) => client.id === clientId)) {
      setClientId(clients[0]?.id ?? "");
    }
  }, [clients, clientId]);

  const close = useCallback(() => {
    setOpen(false);
    setPanelMode(clients.length === 0 ? "new-client" : "quote");
    if (searchParams.get("new") === "1" || searchParams.get("clientId")) {
      router.replace(pathname);
    }
  }, [clients.length, pathname, router, searchParams]);

  const openCreate = useCallback(() => {
    setPanelMode(clients.length === 0 ? "new-client" : "quote");
    setOpen(true);
    router.replace(`${pathname}?new=1`);
  }, [clients.length, pathname, router]);

  const clientName = clients.find((client) => client.id === clientId)?.name ?? "";
  const panelTitle = panelMode === "new-client" ? "견적 안 고객사 등록" : "새 견적";

  return (
    <>
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / QUOTES</p>
          <h1>견적서</h1>
          <p>
            고객용 탭은 발송될 INVOICE를 미리보기만 하고, 내부 원가 탭에서 단가·마진을 잡습니다. 수정은 새
            버전으로 남습니다. 고객사가 없으면 이 화면에서 바로 등록합니다.
          </p>
        </div>
        <CreateIconButton label="새 견적" onClick={openCreate} />
      </header>

      {companyProfileStorage === "missing_table" ? (
        <p className="auth-notice" role="status">
          {companyProfileStorageMissingMessage}
        </p>
      ) : null}

      {clients.length === 0 ? (
        <section className="empty-state quote-empty">
          <h2>고객사가 아직 없습니다</h2>
          <p>견적서 작성 패널 안에서 고객사를 등록한 뒤 바로 이어서 작성합니다. 고객사 목록으로 나가지 않습니다.</p>
          <button className="auth-submit" onClick={openCreate} type="button">
            견적에서 고객사 등록
          </button>
        </section>
      ) : null}

      <section className="quote-list" aria-label="견적 버전 목록">
        <div className="list-heading">
          <div>
            <p className="setup-code">보관된 버전</p>
            <h2>견적 이력</h2>
          </div>
          <span>{versions.length}개</span>
        </div>
        {versions.length === 0 ? (
          <div className="empty-state quote-empty-inline">
            <p>아직 저장된 견적서가 없습니다.</p>
            <button className="auth-submit" onClick={openCreate} type="button">
              첫 견적 만들기
            </button>
          </div>
        ) : (
          versions.map((version) => (
            <a className="quote-row" href={`/quotes/${version.quoteId}`} key={version.versionId}>
              <div>
                <p>
                  {version.clientName} · v{version.versionNumber}
                  {version.vatMode === "inclusive" ? " · 부가세 포함" : " · 부가세 별도"}
                </p>
                <h3>{version.title}</h3>
              </div>
              <strong>{version.totalAmount.toLocaleString("ko-KR")}원</strong>
            </a>
          ))
        )}
      </section>

      <CreatePanel onClose={close} open={open} size="xlarge" title={panelTitle}>
        {panelMode === "new-client" ? (
          <DraftAwareForm
            action={createClientFromQuoteAction}
            className="quote-form"
            formId="quote-inline-client-create"
            scopeId={draftScopeId}
          >
            <p className="form-help quote-form-full">
              등록이 끝나면 이 견적 패널로 돌아와 방금 만든 고객사가 선택된 상태로 이어집니다.
            </p>
            <ClientCompanyFields includeFirstContact />
            <div className="quote-form-full" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
              <DraftSubmitButton className="auth-submit">고객사 저장 후 견적 이어쓰기</DraftSubmitButton>
              {clients.length > 0 ? (
                <button className="text-link" onClick={() => setPanelMode("quote")} type="button">
                  기존 고객사 선택
                </button>
              ) : null}
              <DraftDiscardButton />
            </div>
          </DraftAwareForm>
        ) : (
          <DraftAwareForm
            action={saveQuoteVersionAction}
            className="quote-form quote-form-costing"
            formId="quote-create"
            scopeId={draftScopeId}
          >
            <div className="quote-form-meta quote-form-meta-compact">
              <QuoteClientProjectFields
                clientId={clientId}
                clients={clients}
                onClientIdChange={setClientId}
                onRequestNewClient={() => setPanelMode("new-client")}
                projects={projects}
              />
            </div>
            <div className="quote-form-full">
              <QuoteCostingComposer
                clientId={clientId}
                clientName={clientName}
                contacts={contacts}
                issuer={issuer}
                versionNumber={1}
              />
            </div>
            <div className="quote-form-full" style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              <DraftSubmitButton className="auth-submit">견적 버전 1 저장</DraftSubmitButton>
              <DraftDiscardButton />
            </div>
          </DraftAwareForm>
        )}
      </CreatePanel>
    </>
  );
}
