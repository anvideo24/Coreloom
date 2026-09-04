"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { saveQuoteVersionAction } from "@/app/(private)/quotes/actions";
import { CreateIconButton } from "@/components/create-icon-button";
import { CreatePanel } from "@/components/create-panel";
import { QuoteClientProjectFields } from "@/components/quote-client-project-fields";
import { QuoteCostingComposer } from "@/components/quote-costing-composer";

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
};

export function QuotesPageClient({
  clients,
  projects,
  versions,
}: {
  clients: Client[];
  projects: Project[];
  versions: Version[];
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

  const canCreate = clients.length > 0;

  return (
    <>
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / QUOTES</p>
          <h1>견적서</h1>
          <p>
            작업 패키지별로 원가·마진을 잡아 고객 금액을 제안합니다. 수정은 새 버전으로 남으며, 고객 PDF에는 작업명·설명·금액만
            나갑니다.
          </p>
        </div>
        <CreateIconButton disabled={!canCreate} label="새 견적" onClick={openCreate} />
      </header>

      {!canCreate ? (
        <section className="empty-state quote-empty">
          <h2>먼저 고객사를 등록해 주세요</h2>
          <p>견적서는 고객사에 연결해 보관합니다.</p>
          <a className="text-link" href="/clients-projects">
            고객사 등록으로 이동
          </a>
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
            {canCreate ? (
              <button className="auth-submit" onClick={openCreate} type="button">
                첫 견적 만들기
              </button>
            ) : null}
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

      <CreatePanel onClose={close} open={open && canCreate} size="xlarge" title="새 견적">
        <form action={saveQuoteVersionAction} className="quote-form quote-form-costing">
          <div className="quote-form-meta">
            <label className="quote-form-title">
              견적명
              <input name="title" placeholder="제목 없는 견적" required />
            </label>
            <QuoteClientProjectFields clients={clients} projects={projects} />
          </div>
          <div className="quote-form-full">
            <QuoteCostingComposer />
          </div>
          <label className="quote-form-full">
            메모 (선택)
            <textarea name="note" placeholder="견적 조건이나 전달 메모" />
          </label>
          <button className="auth-submit" type="submit">
            견적 버전 1 저장
          </button>
        </form>
      </CreatePanel>
    </>
  );
}
