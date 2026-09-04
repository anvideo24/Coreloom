"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { createClientAction } from "@/app/(private)/clients-projects/actions";
import { CreateIconButton } from "@/components/create-icon-button";
import { CreatePanel } from "@/components/create-panel";
import { contactRelationStatuses, contactRelationStatusLabels } from "@/lib/domain/clients-projects";

type ClientRow = {
  id: string;
  name: string;
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
            고객사 목록을 보고, 헤더의 +로 등록합니다. 담당자는 고객사를 연 뒤 추가합니다. 프로젝트는 수주
            메뉴의 프로젝트에서 연결합니다.
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
                <p>
                  담당자 {client.contactCount}명 · 프로젝트 {client.projectCount}개
                </p>
                <h3>{client.name}</h3>
              </div>
            </a>
          ))
        )}
      </section>

      <CreatePanel onClose={close} open={open} size="wide" title="새 고객사">
        <form action={createClientAction} className="quote-form">
          <label className="quote-form-full">
            고객사명
            <input name="name" placeholder="예: 주식회사 예시" required />
          </label>
          <p className="form-help quote-form-full">담당자는 선택입니다. 비워 두고 나중에 고객사 화면에서 추가할 수 있습니다.</p>
          <label>
            담당자 이름 (선택)
            <input name="contactName" placeholder="예: 김담당" />
          </label>
          <label>
            역할 (선택)
            <input name="contactRole" placeholder="예: 프로젝트 매니저" />
          </label>
          <label>
            이메일 (선택)
            <input name="contactEmail" type="email" />
          </label>
          <label>
            전화 (선택)
            <input name="contactPhone" />
          </label>
          <label>
            관계
            <select defaultValue="active" name="relationStatus">
              {contactRelationStatuses.map((status) => (
                <option key={status} value={status}>
                  {contactRelationStatusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <button className="auth-submit" type="submit">
            고객사 저장
          </button>
        </form>
      </CreatePanel>
    </>
  );
}
