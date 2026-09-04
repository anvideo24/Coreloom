"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { createClientContactAction, updateClientAction } from "@/app/(private)/clients-projects/actions";
import { ClientCompanyFields } from "@/components/client-company-fields";
import { CreateIconButton } from "@/components/create-icon-button";
import { CreatePanel } from "@/components/create-panel";
import {
  contactRelationStatusLabels,
  contactRelationStatuses,
  projectStatusLabels,
  type ClientCompanyProfile,
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
  taxInvoiceRecipient: boolean;
};

type ProjectRow = {
  id: string;
  name: string;
  status: ProjectStatus;
  progressPercent: number;
};

function dash(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

export function ClientDetailPageClient({
  client,
  contacts,
  projects,
}: {
  client: { id: string } & ClientCompanyProfile;
  contacts: ContactRow[];
  projects: ProjectRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [contactOpen, setContactOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    setContactOpen(searchParams.get("new") === "1");
    setEditOpen(searchParams.get("edit") === "1");
  }, [searchParams]);

  const closeContact = useCallback(() => {
    setContactOpen(false);
    if (searchParams.get("new") === "1") router.replace(pathname);
  }, [pathname, router, searchParams]);

  const openContact = useCallback(() => {
    setContactOpen(true);
    router.replace(`${pathname}?new=1`);
  }, [pathname, router]);

  const closeEdit = useCallback(() => {
    setEditOpen(false);
    if (searchParams.get("edit") === "1") router.replace(pathname);
  }, [pathname, router, searchParams]);

  const openEdit = useCallback(() => {
    setEditOpen(true);
    router.replace(`${pathname}?edit=1`);
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
          <p>회사 정보·담당자·연결 프로젝트를 봅니다. 세금계산서에 쓸 상호·사업자번호·대표자는 여기서 유지합니다.</p>
        </div>
        <div className="operations-header-actions">
          <button className="text-link" onClick={openEdit} type="button">
            회사 정보 수정
          </button>
          <CreateIconButton label="새 담당자" onClick={openContact} />
        </div>
      </header>

      <section aria-label="회사 정보" className="quote-editor-card client-profile-card">
        <p className="setup-code">회사</p>
        <dl className="client-profile-grid">
          <div>
            <dt>사업자등록번호</dt>
            <dd>{dash(client.businessRegistrationNumber)}</dd>
          </div>
          <div>
            <dt>대표자</dt>
            <dd>{dash(client.representativeName)}</dd>
          </div>
          <div>
            <dt>업태</dt>
            <dd>{dash(client.businessType)}</dd>
          </div>
          <div>
            <dt>종목</dt>
            <dd>{dash(client.businessItem)}</dd>
          </div>
          <div className="client-profile-full">
            <dt>주소</dt>
            <dd>{dash(client.address)}</dd>
          </div>
          <div>
            <dt>대표 전화</dt>
            <dd>{dash(client.phone)}</dd>
          </div>
          <div>
            <dt>대표 이메일</dt>
            <dd>{dash(client.email)}</dd>
          </div>
          <div className="client-profile-full">
            <dt>홈페이지</dt>
            <dd>
              {client.website?.trim() ? (
                <a className="text-link" href={/^https?:\/\//i.test(client.website) ? client.website : `https://${client.website}`} rel="noreferrer" target="_blank">
                  {client.website}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="client-profile-full">
            <dt>사업자등록증</dt>
            <dd>{dash(client.businessRegistrationRef)}</dd>
          </div>
        </dl>
      </section>

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
            <button className="auth-submit" onClick={openContact} type="button">
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
                  {contact.taxInvoiceRecipient ? " · 계산서 수신" : ""}
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

      <CreatePanel onClose={closeEdit} open={editOpen} size="wide" title="회사 정보 수정">
        <form action={updateClientAction} className="quote-form">
          <input name="clientId" type="hidden" value={client.id} />
          <ClientCompanyFields defaults={client} />
          <button className="auth-submit" type="submit">
            회사 정보 저장
          </button>
        </form>
      </CreatePanel>

      <CreatePanel onClose={closeContact} open={contactOpen} size="wide" title="새 담당자">
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
            관계
            <select defaultValue="active" name="relationStatus">
              {contactRelationStatuses.map((status) => (
                <option key={status} value={status}>
                  {contactRelationStatusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            이메일 (선택)
            <input name="email" type="email" />
          </label>
          <label>
            전화 (선택)
            <input name="phone" />
          </label>
          <label className="quote-form-full quote-email-approval">
            <input name="taxInvoiceRecipient" type="checkbox" value="on" />
            세금계산서·계산서 수신 담당 (이메일이 필요합니다)
          </label>
          <button className="auth-submit" type="submit">
            담당자 저장
          </button>
        </form>
      </CreatePanel>
    </>
  );
}
