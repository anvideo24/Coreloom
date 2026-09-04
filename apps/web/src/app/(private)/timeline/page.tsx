import { redirect } from "next/navigation";

import { linkRechoEvidenceAction } from "@/app/(private)/timeline/actions";
import { founderSession } from "@/lib/auth/session";
import { rechoEvidenceKindLabels, rechoEvidenceKinds } from "@/lib/domain/recho-evidence";
import { listFounderRechoEvidence } from "@/lib/recho-evidence/repository";

export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { projects, timeline } = await listFounderRechoEvidence(session.founder.id);

  return (
    <main className="operations-shell">
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / EVIDENCE</p>
          <h1>근거 기록</h1>
          <p>Recho의 메일·통화·회의를 프로젝트에 연결하고 시간순으로 봅니다. Coreloom은 원문 식별자·발생 시각·연결 이유만 보관하며, 원문은 수정하지 않습니다. AI 제안은 근거에 연결한 뒤 AI 제안 화면에서 확정하거나 반려합니다. Recho API 동기화는 이 기능에 포함되지 않습니다.</p>
        </div>
      </header>
      {projects.length === 0 ? (
        <section className="empty-state quote-empty">
          <h2>먼저 프로젝트를 등록해 주세요</h2>
          <p>근거 기록은 고객사 프로젝트에 연결합니다. 연결할 프로젝트가 없으면 미분류로 두지 않습니다.</p>
          <a className="text-link" href="/clients-projects">프로젝트로 이동</a>
        </section>
      ) : (
        <section className="quote-editor-card">
          <p className="setup-code">기록 연결</p>
          <p className="form-help">표시 제목은 목록 구분용이며 원문이 아닙니다. 원문은 Recho에서 식별자 또는 링크로 엽니다.</p>
          <form action={linkRechoEvidenceAction} className="quote-form">
            <label>프로젝트
              <select name="projectId" required>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.clientName} · {project.name}</option>
                ))}
              </select>
            </label>
            <label>종류
              <select defaultValue="email" name="kind">
                {rechoEvidenceKinds.map((kind) => (
                  <option key={kind} value={kind}>{rechoEvidenceKindLabels[kind]}</option>
                ))}
              </select>
            </label>
            <label>발생일<input name="occurredOn" required type="date" /></label>
            <label>발생 시각<input name="occurredTime" required type="time" /></label>
            <label className="quote-form-full">표시 제목<input name="title" placeholder="예: 견적 범위 회신" required /></label>
            <label>원문 식별자<input name="originalIdentifier" placeholder="예: recho-record-1" required /></label>
            <label>원문 링크 (선택)<input name="originalUrl" placeholder="https://" type="url" /></label>
            <label className="quote-form-full">연결 이유<textarea name="linkReason" placeholder="이 기록을 이 프로젝트의 근거로 연결하는 이유" required /></label>
            <button className="auth-submit" type="submit">근거로 연결</button>
          </form>
        </section>
      )}
      <section className="quote-list" aria-label="시간순 근거">
        <div className="list-heading">
          <div>
            <p className="setup-code">타임라인</p>
            <h2>시간순 근거</h2>
          </div>
          <span>{timeline.length}일</span>
        </div>
        {timeline.length === 0 ? <p className="empty-state">연결된 근거 기록이 없습니다.</p> : timeline.map((group) => (
          <article className="quote-list" key={group.occurredOn}>
            <p className="setup-code">{group.occurredOn}</p>
            {group.records.map((record) => (
              <a className="quote-row" href={`/timeline/${record.id}`} key={record.id}>
                <div>
                  <p>{record.clientName} · {record.projectName} · {rechoEvidenceKindLabels[record.kind]} · {record.occurredTime}</p>
                  <h3>{record.title}</h3>
                </div>
                <strong>{rechoEvidenceKindLabels[record.kind]}</strong>
              </a>
            ))}
          </article>
        ))}
      </section>
    </main>
  );
}
