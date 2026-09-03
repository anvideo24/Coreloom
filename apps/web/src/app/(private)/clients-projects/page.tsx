import { redirect } from "next/navigation";

import { createClientAction, createClientContactAction, createProjectAction, updateProjectProgressAction } from "@/app/(private)/clients-projects/actions";
import { founderSession } from "@/lib/auth/session";
import { listFounderClientsAndProjects } from "@/lib/clients-projects/repository";
import { contactRelationStatusLabels, contactRelationStatuses, projectStatuses } from "@/lib/domain/clients-projects";

export const dynamic = "force-dynamic";

const statusLabels = { planned: "예정", active: "진행 중", on_hold: "보류", complete: "완료" } as const;

export default async function ClientsProjectsPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");

  const { clients, projects, contacts } = await listFounderClientsAndProjects(session.founder.id);

  return (
    <main className="operations-shell">
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / CLIENTS & PROJECTS</p>
          <h1>고객사와 프로젝트</h1>
          <p>고객사를 먼저 등록한 뒤 담당자와 프로젝트를 연결하세요. 진행률은 현재 판단 기준이며, 업무와 기한은 업무·일정에서 이어서 등록합니다. Recho 연결은 다음 기능에서 이어집니다.</p>
        </div>
      </header>

      <section className="registration-grid" aria-label="등록">
        <form action={createClientAction} className="registration-card">
          <p className="setup-code">1. 고객사 등록</p>
          <h2>고객사</h2>
          <label>고객사명<input name="name" placeholder="예: 주식회사 예시" required /></label>
          <button className="auth-submit" type="submit">고객사 저장</button>
        </form>
        <form action={createClientContactAction} className="registration-card">
          <p className="setup-code">2. 담당자 등록</p>
          <h2>담당자</h2>
          {clients.length === 0 ? <p className="form-help">먼저 고객사를 등록하면 담당자를 연결할 수 있습니다.</p> : <>
            <label>고객사<select name="clientId" required>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
            <label>이름<input name="name" placeholder="예: 김담당" required /></label>
            <label>역할 (선택)<input name="role" placeholder="예: 프로젝트 매니저" /></label>
            <label>이메일 (선택)<input name="email" type="email" /></label>
            <label>전화 (선택)<input name="phone" /></label>
            <label>관계<select defaultValue="active" name="relationStatus">{contactRelationStatuses.map((status) => <option key={status} value={status}>{contactRelationStatusLabels[status]}</option>)}</select></label>
            <button className="auth-submit" type="submit">담당자 저장</button>
          </>}
        </form>
        <form action={createProjectAction} className="registration-card">
          <p className="setup-code">3. 프로젝트 등록</p>
          <h2>프로젝트</h2>
          {clients.length === 0 ? <p className="form-help">먼저 고객사를 등록하면 프로젝트를 연결할 수 있습니다.</p> : <>
            <label>고객사<select name="clientId" required>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
            <label>프로젝트명<input name="name" placeholder="예: 브랜드 사이트 구축" required /></label>
            <label>상태<select defaultValue="planned" name="status">{projectStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
            <label>진행률<input defaultValue="0" max="100" min="0" name="progressPercent" type="number" required /></label>
            <button className="auth-submit" type="submit">프로젝트 저장</button>
          </>}
        </form>
      </section>

      <section className="quote-list" aria-label="등록된 담당자">
        <div className="list-heading"><div><p className="setup-code">연락처</p><h2>고객사 담당자</h2></div><span>{contacts.length}명</span></div>
        {contacts.length === 0 ? <p className="empty-state">등록된 담당자가 없습니다. 고객사를 등록한 뒤 담당자를 추가하세요.</p> : contacts.map((contact) => (
          <article className="quote-row" key={contact.id}>
            <div>
              <p>{contact.clientName} · {contactRelationStatusLabels[contact.relationStatus]}{contact.role ? ` · ${contact.role}` : ""}</p>
              <h3>{contact.name}</h3>
            </div>
            <strong>{contact.email ?? contact.phone ?? "연락처 없음"}</strong>
          </article>
        ))}
      </section>

      <section className="project-list" aria-label="등록된 프로젝트">
        <div className="list-heading"><div><p className="setup-code">등록 현황</p><h2>진행 중인 프로젝트</h2></div><span>{projects.length}개</span></div>
        {projects.length === 0 ? <p className="empty-state">등록된 프로젝트가 없습니다. 고객사를 등록한 뒤 첫 프로젝트를 추가하세요.</p> : projects.map((project) => (
          <article className="project-row" key={project.id}>
            <div><p>{project.clientName}</p><h3>{project.name}</h3></div>
            <form action={updateProjectProgressAction} className="project-update-form">
              <input name="projectId" type="hidden" value={project.id} />
              <label>상태<select defaultValue={project.status} name="status">{projectStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
              <label>진행률<input defaultValue={project.progressPercent} max="100" min="0" name="progressPercent" type="number" required /></label>
              <button className="auth-submit" type="submit">저장</button>
            </form>
            <div className="project-progress"><strong>{project.progressPercent}%</strong><div aria-label={`진행률 ${project.progressPercent}%`} className="progress-track"><span style={{ width: `${project.progressPercent}%` }} /></div></div>
          </article>
        ))}
      </section>
    </main>
  );
}
