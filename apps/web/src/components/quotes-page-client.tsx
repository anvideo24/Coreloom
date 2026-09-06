"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { createClientFromQuoteAction } from "@/app/(private)/clients-projects/actions";
import { saveQuoteVersionAction } from "@/app/(private)/quotes/actions";
import { ClientCompanyFields } from "@/components/client-company-fields";
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
import styles from "@/components/sales-ux.module.css";

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
const QUOTE_REDIRECT_DRAFT_IGNORE = ["clientId"];
const QUOTE_SUBMISSION_FIELDS = [
  "quoteId",
  "clientId",
  "projectId",
  "clientContactId",
  "title",
  "note",
  "packagesJson",
  "vatMode",
  "targetMarginPercent",
  "operatingCostPercent",
  "issuedOn",
  "validUntil",
] as const;

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
  const [query, setQuery] = useState("");

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
  const redirectedClientId = searchParams.get("clientId");
  const ignoreRedirectedClientDraft = redirectedClientId && clients.some((client) => client.id === redirectedClientId);
  const panelTitle = panelMode === "new-client" ? "견적 안 고객사 등록" : "새 견적";
  const filteredVersions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized
      ? versions.filter((version) => `${version.clientName} ${version.title}`.toLocaleLowerCase().includes(normalized))
      : versions;
  }, [query, versions]);

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
        <button className={`auth-submit ${styles.createButton}`} onClick={openCreate} type="button"><span aria-hidden="true">＋</span> 새 견적</button>
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
          <button className={`auth-submit ${styles.emptyCreateButton}`} onClick={openCreate} type="button">
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
          <span>{filteredVersions.length}개{query.trim() ? ` / 전체 ${versions.length}개` : ""}</span>
        </div>
        {versions.length > 0 ? (
          <label className={`quote-form-full ${styles.listSearch}`}>
            고객사명·견적 주제 검색
            <input aria-label="고객사명·견적 주제 검색" onChange={(event) => setQuery(event.target.value)} placeholder="고객사명 또는 견적 주제" value={query} />
          </label>
        ) : null}
        {versions.length === 0 ? (
          <div className="empty-state quote-empty-inline">
            <p>아직 저장된 견적서가 없습니다.</p>
            <button className={`auth-submit ${styles.emptyCreateButton}`} onClick={openCreate} type="button">
              첫 견적 만들기
            </button>
          </div>
        ) : filteredVersions.length === 0 ? (
          <p className="empty-state quote-empty-inline">검색 결과가 없습니다.</p>
        ) : (
          filteredVersions.map((version) => (
            <a className="quote-row" href={`/quotes/${version.quoteId}`} key={version.versionId}>
              <div>
                <h3>{version.title}</h3>
                <p>
                  {version.clientName} · v{version.versionNumber}
                  {version.vatMode === "inclusive" ? " · 부가세 포함" : " · 부가세 별도"}
                </p>
              </div>
              <strong>{version.totalAmount.toLocaleString("ko-KR")}원</strong>
            </a>
          ))
        )}
      </section>

      <CreatePanel onClose={close} open={open} showHeader size="xlarge" title={panelTitle}>
        {panelMode === "new-client" ? (
          <DraftAwareForm
            action={createClientFromQuoteAction}
            className="quote-form"
            formId="quote-inline-client-create"
            key="quote-inline-client-create"
            scopeId={draftScopeId}
          >
            <p className="form-help quote-form-full">
              등록이 끝나면 이 견적 패널로 돌아와 방금 만든 고객사가 선택된 상태로 이어집니다.
            </p>
            <ClientCompanyFields includeFirstContact progressiveDetails />
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
            draftIgnoreFields={ignoreRedirectedClientDraft ? QUOTE_REDIRECT_DRAFT_IGNORE : undefined}
            formId="quote-create"
            key="quote-create"
            persistentSubmissionFields={QUOTE_SUBMISSION_FIELDS}
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
                initialTab="internal"
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
