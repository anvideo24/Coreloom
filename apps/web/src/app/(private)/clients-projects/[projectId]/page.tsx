import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { updateProjectProgressAction } from "@/app/(private)/clients-projects/actions";
import { founderSession } from "@/lib/auth/session";
import { projectStatuses, projectStatusLabels } from "@/lib/domain/clients-projects";
import type { ProjectWorkspaceLink } from "@/lib/domain/project-workspace";
import { getFounderProjectWorkspace } from "@/lib/project-workspace/repository";

export const dynamic = "force-dynamic";

function WorkspaceList({
  code,
  heading,
  items,
  empty,
}: {
  code: string;
  heading: string;
  items: ProjectWorkspaceLink[];
  empty: string;
}) {
  return (
    <section aria-label={heading} className="quote-list">
      <div className="list-heading">
        <div>
          <p className="setup-code">{code}</p>
          <h2>{heading}</h2>
        </div>
        <span>{items.length}건</span>
      </div>
      {items.length === 0 ? <p className="empty-state">{empty}</p> : items.map((item) => (
        <Link className="quote-row" href={item.href} key={`${item.href}-${item.title}`}>
          <div>
            <p>{item.detail}</p>
            <h3>{item.title}</h3>
          </div>
          {typeof item.amount === "number" ? <strong>{item.amount.toLocaleString("ko-KR")}원</strong> : null}
        </Link>
      ))}
    </section>
  );
}

export default async function ProjectWorkspacePage({ params }: { params: Promise<{ projectId: string }> }) {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { projectId } = await params;
  const workspace = await getFounderProjectWorkspace(session.founder.id, projectId);
  if (!workspace) notFound();

  return (
    <main className="operations-shell project-workspace-shell">
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / PROJECT</p>
          <h1>{workspace.project.name}</h1>
          <p>{workspace.project.clientName} · {workspace.project.statusLabel} · 진행률 {workspace.progressPercent}%</p>
        </div>
        <div className="quote-header-links">
          <Link className="text-link" href="/clients-projects">프로젝트 목록</Link>
        </div>
      </header>

      <div className="project-workspace">
        <div>
          <section aria-label="프로젝트 진행률" className="progress-card">
            <div>
              <p>진행률</p>
              <strong>{workspace.progressPercent}%</strong>
            </div>
            <div aria-hidden="true" className="progress-track"><span style={{ width: `${workspace.progressPercent}%` }} /></div>
            <form action={updateProjectProgressAction} className="project-update-form">
              <input name="projectId" type="hidden" value={workspace.project.id} />
              <label>상태
                <select defaultValue={workspace.project.status} name="status">
                  {projectStatuses.map((status) => <option key={status} value={status}>{projectStatusLabels[status]}</option>)}
                </select>
              </label>
              <label>진행률<input defaultValue={workspace.progressPercent} max={100} min={0} name="progressPercent" type="number" required /></label>
              <button className="auth-submit" type="submit">저장</button>
            </form>
          </section>

          <section aria-label="담당자" className="quote-list">
            <div className="list-heading">
              <div>
                <p className="setup-code">담당자</p>
                <h2>고객사 담당자</h2>
              </div>
              <span>{workspace.contacts.length}명</span>
            </div>
            {workspace.contacts.length === 0 ? <p className="empty-state">이 고객사에 등록된 담당자가 없습니다.</p> : workspace.contacts.map((contact) => (
              <article className="quote-row" key={contact.id}>
                <div>
                  <p>{contact.role ?? "역할 없음"}</p>
                  <h3>{contact.name}</h3>
                </div>
                <strong>{contact.detail}</strong>
              </article>
            ))}
          </section>

          <WorkspaceList code="업무" heading="업무" items={workspace.tasks} empty="이 프로젝트에 연결된 업무가 없습니다." />
          <WorkspaceList code="견적" heading="견적" items={workspace.quotes} empty="이 프로젝트에 연결된 견적이 없습니다." />
          <WorkspaceList code="계약" heading="계약" items={workspace.contracts} empty="이 프로젝트에 연결된 계약이 없습니다." />
          <WorkspaceList code="청구" heading="청구" items={workspace.billings} empty="이 프로젝트에 연결된 청구가 없습니다." />
          <WorkspaceList code="문서" heading="문서" items={workspace.documents} empty="이 프로젝트에 연결된 문서 위치가 없습니다." />
        </div>

        <aside aria-label="근거와 AI 제안" className="project-workspace-rail">
          <p className="setup-code">근거 레일</p>
          <h2>시간순 근거</h2>
          <p className="form-help">최신 기록과 앞뒤 맥락을 같은 화면에서 봅니다. 원문은 복제하거나 수정하지 않으며, AI 제안은 확정 전에 공식 결정이 아닙니다.</p>
          {workspace.timeline.length === 0 ? <p className="empty-state">연결된 근거 기록이 없습니다. 근거 기록 화면에서 Recho 메일·통화·회의를 이 프로젝트에 연결하세요.</p> : workspace.timeline.map((group) => (
            <section className="project-rail-day" key={group.occurredOn}>
              <p className="setup-code">{group.occurredOn}</p>
              {group.records.map((record) => (
                <article className="project-rail-record" key={record.id}>
                  <Link href={record.href}>
                    <p>{record.detail}</p>
                    <h3>{record.title}</h3>
                  </Link>
                  <p className="form-help">{record.linkReason}</p>
                  {record.originalUrl ? <a className="text-link" href={record.originalUrl} rel="noreferrer" target="_blank">원문 열기</a> : <p className="form-help">원문 링크 없음</p>}
                  {record.proposals.length === 0 ? null : record.proposals.map((proposal) => (
                    <Link className="project-rail-proposal" href={proposal.href} key={proposal.href}>
                      <p>{proposal.detail}</p>
                      <strong>{proposal.statusLabel}</strong>
                      <span>{proposal.title}</span>
                    </Link>
                  ))}
                </article>
              ))}
            </section>
          ))}
        </aside>
      </div>
    </main>
  );
}
