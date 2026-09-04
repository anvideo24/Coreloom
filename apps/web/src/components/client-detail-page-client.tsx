"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { createClientContactAction } from "@/app/(private)/clients-projects/actions";
import { CreateIconButton } from "@/components/create-icon-button";
import { CreatePanel } from "@/components/create-panel";
import {
  contactRelationStatusLabels,
  contactRelationStatuses,
  projectStatusLabels,
  type ContactRelationStatus,
  type ProjectStatus,
} from "@/lib/domain/clients-projects";

type ContactRow = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  relationStatus: ContactRelationStatus;
};

type ProjectRow = {
  id: string;
  name: string;
  status: ProjectStatus;
  progressPercent: number;
};

export function ClientDetailPageClient({
  client,
  contacts,
  projects,
}: {
  client: { id: string; name: string };
  contacts: ContactRow[];
  projects: ProjectRow[];
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
          <p className="auth-eyebrow">CORELOOM / CLIENTS</p>
          <p>
            <a className="text-link" href="/clients">
              고객사 목록
            </a>
          </p>
          <h1>{client.name}</h1>
          <p>담당자를 관리하고, 연결된 프로젝트를 확인합니다. 프로젝트 등록은 프로젝트 메뉴에서 합니다.</p>
        </div>
        <CreateIconButton label="새 담당자" onClick={openCreate} />
      </header>

      <section aria-label="담당자 목록" className="quote-list">
        <div className="list-heading">
          <div>
            <p className="setup-code">연락처</p>
            <h2>담당자</h2>
          </div>
          <span>{contacts.length}명</span>
        </div>
        {contacts.length === 0 ? (
          <div className="empty-state quote-empty-inline">
            <p>등록된 담당자가 없습니다.</p>
            <button className="auth-submit" onClick={openCreate} type="button">
              첫 담당자 추가
            </button>
          </div>
        ) : (
          contacts.map((contact) => (
            <article className="quote-row" key={contact.id}>
              <div>
                <p>
                  {contactRelationStatusLabels[contact.relationStatus]}
                  {contact.role ? ` · ${contact.role}` : ""}
                </p>
                <h3>{contact.name}</h3>
              </div>
              <strong>{contact.email ?? contact.phone ?? "연락처 없음"}</strong>
            </article>
          ))
        )}
      </section>

      <section aria-label="연결된 프로젝트" className="project-list">
        <div className="list-heading">
          <div>
            <p className="setup-code">연결</p>
            <h2>프로젝트</h2>
          </div>
          <span>{projects.length}개</span>
        </div>
        {projects.length === 0 ? (
          <p className="empty-state">
            연결된 프로젝트가 없습니다.{" "}
            <a className="text-link" href="/clients-projects">
              프로젝트
            </a>
            에서 이 고객사로 등록하세요.
          </p>
        ) : (
          projects.map((project) => (
            <article className="project-row" key={project.id}>
              <div>
                <p>
                  {projectStatusLabels[project.status]} · {project.progressPercent}%
                </p>
                <h3>
                  <a href={`/clients-projects/${project.id}`}>{project.name}</a>
                </h3>
              </div>
            </article>
          ))
        )}
      </section>

      <CreatePanel onClose={close} open={open} size="wide" title="새 담당자">
        <form action={createClientContactAction} className="quote-form">
          <input name="clientId" type="hidden" value={client.id} />
          <label className="quote-form-full">
            이름
            <input name="name" placeholder="예: 김담당" required />
          </label>
          <label>
            역할 (선택)
            <input name="role" placeholder="예: 프로젝트 매니저" />
          </label>
          <label>
            이메일 (선택)
            <input name="email" type="email" />
          </label>
          <label>
            전화 (선택)
            <input name="phone" />
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
            담당자 저장
          </button>
        </form>
      </CreatePanel>
    </>
  );
}
