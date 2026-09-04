"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { createVaultDocumentAction } from "@/app/(private)/documents/actions";
import { CreateIconButton } from "@/components/create-icon-button";
import { CreatePanel } from "@/components/create-panel";
import {
  vaultDocumentKindLabels,
  vaultDocumentKinds,
  type VaultDocumentKind,
} from "@/lib/domain/documents";

type Project = { id: string; name: string; clientName: string };
type Client = { id: string; name: string };
type DocumentRow = {
  documentId: string;
  title: string;
  kind: VaultDocumentKind;
  versionNumber: number;
  counterparty: string;
  hasStoredFile: boolean;
};

export function DocumentsPageClient({
  projects,
  clients,
  documents,
}: {
  projects: Project[];
  clients: Client[];
  documents: DocumentRow[];
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
          <p className="auth-eyebrow">CORELOOM / DOCUMENTS</p>
          <h1>비공개 문서함</h1>
          <p>
            설립 증빙, 계약 원본, 산출물, 정산 자료의 원본 파일 또는 위치를 버전으로 보관합니다. 올린 파일은 이 PC의
            비공개 폴더에 두고 대표만 받을 수 있습니다. 외부 공개는 하지 않습니다.
          </p>
        </div>
        <CreateIconButton label="원본 등록" onClick={openCreate} />
      </header>

      <section aria-label="문서 목록" className="quote-list">
        <div className="list-heading">
          <div>
            <p className="setup-code">보관 현황</p>
            <h2>원본 보관</h2>
          </div>
          <span>{documents.length}건</span>
        </div>
        {documents.length === 0 ? (
          <div className="empty-state quote-empty-inline">
            <p>보관된 문서가 없습니다. 원본은 덮어쓰지 않고 새 버전으로만 이어갑니다.</p>
            <button className="auth-submit" onClick={openCreate} type="button">
              첫 원본 등록하기
            </button>
          </div>
        ) : (
          documents.map((document) => (
            <a className="quote-row" href={`/documents/${document.documentId}`} key={document.documentId}>
              <div>
                <p>
                  {vaultDocumentKindLabels[document.kind]} · {document.counterparty} · v{document.versionNumber}
                  {document.hasStoredFile ? " · 파일 보관" : ""}
                </p>
                <h3>{document.title}</h3>
              </div>
              <strong>v{document.versionNumber}</strong>
            </a>
          ))
        )}
      </section>

      <CreatePanel onClose={close} open={open} size="wide" title="원본 등록">
        <form action={createVaultDocumentAction} className="quote-form">
          <p className="form-help quote-form-full">
            원본 파일을 올리거나, 안전한 회사 문서함 경로·링크를 적습니다. 둘 중 하나는 있어야 합니다. 고객사만
            고르면 사업자등록증처럼 프로젝트 없이 연결합니다. 프로젝트와 고객사는 동시에 고르지 마세요. PDF와
            이미지(JPEG, PNG, WebP)만 올리며, 한 파일은 20MB까지입니다.
          </p>
          <p className="setup-code quote-form-full">분류</p>
          <label>
            종류
            <select defaultValue="company_setup" name="kind">
              {vaultDocumentKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {vaultDocumentKindLabels[kind]}
                </option>
              ))}
            </select>
          </label>
          <label>
            고객사 (선택)
            <select defaultValue="" name="clientCompanyId">
              <option value="">회사 공통 / 프로젝트로 연결</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            고객사 프로젝트 (선택)
            <select defaultValue="" name="projectId">
              <option value="">회사 공통</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.clientName} · {project.name}
                </option>
              ))}
            </select>
          </label>

          <p className="setup-code quote-form-full">원본</p>
          <label className="quote-form-full">
            문서명
            <input name="title" placeholder="예: 사업자등록증" required />
          </label>
          <label className="quote-form-full">
            원본 파일
            <input accept="application/pdf,image/jpeg,image/png,image/webp" name="originalFile" type="file" />
          </label>
          <label className="quote-form-full">
            원본 경로 또는 링크 (선택)
            <input name="originalReference" placeholder="예: 회사 문서함/설립/사업자등록증.pdf" />
          </label>
          <label className="quote-form-full">
            메모 (선택)
            <textarea name="note" />
          </label>
          <button className="auth-submit" type="submit">
            문서함 저장
          </button>
        </form>
      </CreatePanel>
    </>
  );
}
