import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { founderSession } from "@/lib/auth/session";
import { rechoEvidenceKindLabels } from "@/lib/domain/recho-evidence";
import { getFounderRechoEvidenceDetail } from "@/lib/recho-evidence/repository";

export const dynamic = "force-dynamic";

export default async function TimelineDetailPage({ params }: { params: Promise<{ recordId: string }> }) {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { recordId } = await params;
  const record = await getFounderRechoEvidenceDetail(session.founder.id, recordId);
  if (!record) notFound();

  return (
    <main className="operations-shell">
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / EVIDENCE</p>
          <h1>{record.title}</h1>
          <p>{record.clientName} · {record.projectName} · {rechoEvidenceKindLabels[record.kind]} · {record.occurredOn} {record.occurredTime}</p>
        </div>
        <div className="quote-header-links">
          <Link className="text-link" href="/clients-projects">고객사·프로젝트</Link>
          <Link className="text-link" href="/timeline">근거 목록</Link>
        </div>
      </header>
      <section className="quote-editor-card">
        <p className="setup-code">원문 연결</p>
        <p className="form-help">표시 제목은 원문이 아닙니다. Coreloom에서 원문을 고치지 않으며, 내용은 Recho에서 확인합니다.</p>
        <p>원문 식별자 {record.originalIdentifier}</p>
        {record.originalUrl ? (
          <p><a className="text-link" href={record.originalUrl} rel="noreferrer" target="_blank">원문 열기</a></p>
        ) : (
          <p className="form-help">원문 링크가 없습니다. Recho에서 식별자로 원문을 찾으세요.</p>
        )}
      </section>
      <section className="quote-editor-card">
        <p className="setup-code">연결 이유</p>
        <p className="form-help">{record.linkReason}</p>
      </section>
    </main>
  );
}
