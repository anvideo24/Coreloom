import { redirect } from "next/navigation";

import { createVaultDocumentAction } from "@/app/(private)/documents/actions";
import { founderSession } from "@/lib/auth/session";
import { vaultDocumentKindLabels, vaultDocumentKinds } from "@/lib/domain/documents";
import { listFounderVaultDocuments } from "@/lib/documents/repository";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { projects, documents } = await listFounderVaultDocuments(session.founder.id);

  return (
    <main className="operations-shell">
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / DOCUMENTS</p>
          <h1>비공개 문서함</h1>
          <p>설립 증빙, 계약 원본, 산출물, 정산 자료의 원본 위치를 버전으로 보관합니다. Coreloom은 파일을 올리지 않고 누가 언제 위치를 남겼는지만 기록합니다. 파일 업로드와 외부 공개는 이 기능에 포함되지 않습니다.</p>
        </div>
      </header>
      <section className="quote-editor-card">
        <p className="setup-code">원본 위치 등록</p>
        <p className="form-help">원본은 안전한 회사 문서함 또는 링크에 두고, 여기에는 그 위치만 적습니다. 프로젝트를 비우면 회사 공통으로 보관합니다.</p>
        <form action={createVaultDocumentAction} className="quote-form">
          <label>종류
            <select defaultValue="company_setup" name="kind">
              {vaultDocumentKinds.map((kind) => <option key={kind} value={kind}>{vaultDocumentKindLabels[kind]}</option>)}
            </select>
          </label>
          <label>고객사 프로젝트 (선택)
            <select defaultValue="" name="projectId">
              <option value="">회사 공통</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.clientName} · {project.name}</option>)}
            </select>
          </label>
          <label className="quote-form-full">문서명<input name="title" placeholder="예: 사업자등록증" required /></label>
          <label className="quote-form-full">원본 경로 또는 링크<input name="originalReference" placeholder="예: 회사 문서함/설립/사업자등록증.pdf" required /></label>
          <label className="quote-form-full">메모 (선택)<textarea name="note" /></label>
          <button className="auth-submit" type="submit">문서함 저장</button>
        </form>
      </section>
      <section className="quote-list" aria-label="문서 목록">
        <div className="list-heading">
          <div>
            <p className="setup-code">보관 현황</p>
            <h2>원본 위치</h2>
          </div>
          <span>{documents.length}건</span>
        </div>
        {documents.length === 0 ? <p className="empty-state">보관된 문서 위치가 없습니다. 원본은 덮어쓰지 않고 새 버전으로만 이어갑니다.</p> : documents.map((document) => (
          <a className="quote-row" href={`/documents/${document.documentId}`} key={document.documentId}>
            <div>
              <p>{vaultDocumentKindLabels[document.kind]} · {document.counterparty} · v{document.versionNumber}</p>
              <h3>{document.title}</h3>
            </div>
            <strong>v{document.versionNumber}</strong>
          </a>
        ))}
      </section>
    </main>
  );
}
