import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { addVaultDocumentVersionAction } from "@/app/(private)/documents/actions";
import { founderSession } from "@/lib/auth/session";
import { originalReferenceHref, vaultDocumentDownloadPath, vaultDocumentKindLabels } from "@/lib/domain/documents";
import { getFounderVaultDocumentDetail } from "@/lib/documents/repository";

export const dynamic = "force-dynamic";

export default async function DocumentDetailPage({ params }: { params: Promise<{ documentId: string }> }) {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { documentId } = await params;
  const detail = await getFounderVaultDocumentDetail(session.founder.id, documentId);
  if (!detail) notFound();
  const latest = detail.versions[0];
  if (!latest) notFound();
  const latestHref = originalReferenceHref(latest.originalReference);

  return (
    <main className="operations-shell">
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / DOCUMENT</p>
          <h1>{detail.document.title}</h1>
          <p>{vaultDocumentKindLabels[detail.document.kind]} · {detail.document.counterparty} · 현재 v{latest.versionNumber}</p>
        </div>
        <div className="quote-header-links">
          <Link className="text-link" href="/company-setup">회사 설립 준비</Link>
          <Link className="text-link" href="/documents">문서함 목록</Link>
        </div>
      </header>
      <section className="quote-editor-card">
        <p className="setup-code">현재 원본</p>
        <p className="form-help">이 원본은 덮어쓰지 않습니다. 바뀌면 아래 새 버전으로만 남깁니다. 올린 파일은 대표만 받을 수 있습니다.</p>
        <p>{latest.originalReference}</p>
        {latest.storageKey ? (
          <p><a className="text-link" href={vaultDocumentDownloadPath(detail.document.id, latest.id)}>원본 받기</a></p>
        ) : null}
        {latestHref ? (
          <p><a className="text-link" href={latestHref} rel="noreferrer" target="_blank">원본 열기</a></p>
        ) : null}
        {latest.note ? <p className="form-help">{latest.note}</p> : null}
      </section>
      <section className="quote-editor-card">
        <p className="setup-code">새 버전</p>
        <p className="form-help">이전 버전은 그대로 두고, 새 원본 파일 또는 위치만 추가합니다.</p>
        <form action={addVaultDocumentVersionAction} className="quote-form">
          <input name="documentId" type="hidden" value={detail.document.id} />
          <label className="quote-form-full">원본 파일<input accept="application/pdf,image/jpeg,image/png,image/webp" name="originalFile" type="file" /></label>
          <label className="quote-form-full">원본 경로 또는 링크 (선택)<input name="originalReference" /></label>
          <label className="quote-form-full">메모 (선택)<textarea name="note" /></label>
          <button className="auth-submit" type="submit">v{latest.versionNumber + 1} 원본 저장</button>
        </form>
      </section>
      <section className="quote-list" aria-label="버전 이력">
        <div className="list-heading">
          <div>
            <p className="setup-code">버전</p>
            <h2>원본 이력</h2>
          </div>
          <span>{detail.versions.length}개</span>
        </div>
        {detail.versions.map((version) => (
          <article className="quote-row" key={version.id}>
            <div>
              <p>v{version.versionNumber} · {version.createdAt.toLocaleString("ko-KR")}{version.storageKey ? " · 파일 보관" : ""}</p>
              <h3>{version.originalReference}</h3>
            </div>
            <strong>v{version.versionNumber}</strong>
          </article>
        ))}
      </section>
    </main>
  );
}
