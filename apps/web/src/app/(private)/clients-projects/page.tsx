import { redirect } from "next/navigation";

import { createProjectAction, updateProjectProgressAction } from "@/app/(private)/clients-projects/actions";
import { founderSession } from "@/lib/auth/session";
import { listFounderClientsAndProjects } from "@/lib/clients-projects/repository";
import { projectStatusLabels, projectStatuses } from "@/lib/domain/clients-projects";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");

  const { clients, projects } = await listFounderClientsAndProjects(session.founder.id);

  return (
    <main className="operations-shell">
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / PROJECTS</p>
          <h1>프로젝트</h1>
          <p>
            고객사에 연결된 프로젝트를 보고 진행률을 갱신합니다. 고객사·담당자 등록은{" "}
            <a className="text-link" href="/clients">
              고객사
            </a>
            에서 합니다. 프로젝트 이름을 열면 업무·견적·계약·청구·문서와 Recho 근거를 한 화면에서 봅니다.
          </p>
        </div>
      </header>

      {clients.length === 0 ? (
        <section className="empty-state quote-empty">
          <h2>먼저 고객사를 등록해 주세요</h2>
          <p>프로젝트는 고객사에 연결해 보관합니다.</p>
          <a className="text-link" href="/clients">
            고객사 등록으로 이동
          </a>
        </section>
      ) : (
        <section aria-label="프로젝트 등록" className="registration-grid">
          <form action={createProjectAction} className="registration-card">
            <p className="setup-code">등록</p>
            <h2>새 프로젝트</h2>
            <label>
              고객사
              <select name="clientId" required>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              프로젝트명
              <input name="name" placeholder="예: 브랜드 사이트 구축" required />
            </label>
            <label>
              상태
              <select defaultValue="planned" name="status">
                {projectStatuses.map((status) => (
                  <option key={status} value={status}>
                    {projectStatusLabels[status]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              진행률
              <input defaultValue="0" max="100" min="0" name="progressPercent" required type="number" />
            </label>
            <button className="auth-submit" type="submit">
              프로젝트 저장
            </button>
          </form>
        </section>
      )}

      <section aria-label="등록된 프로젝트" className="project-list">
        <div className="list-heading">
          <div>
            <p className="setup-code">등록 현황</p>
            <h2>프로젝트</h2>
          </div>
          <span>{projects.length}개</span>
        </div>
        {projects.length === 0 ? (
          <p className="empty-state">등록된 프로젝트가 없습니다. 고객사를 등록한 뒤 첫 프로젝트를 추가하세요.</p>
        ) : (
          projects.map((project) => (
            <article className="project-row" key={project.id}>
              <div>
                <p>{project.clientName}</p>
                <h3>
                  <a href={`/clients-projects/${project.id}`}>{project.name}</a>
                </h3>
              </div>
              <form action={updateProjectProgressAction} className="project-update-form">
                <input name="projectId" type="hidden" value={project.id} />
                <label>
                  상태
                  <select defaultValue={project.status} name="status">
                    {projectStatuses.map((status) => (
                      <option key={status} value={status}>
                        {projectStatusLabels[status]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  진행률
                  <input
                    defaultValue={project.progressPercent}
                    max="100"
                    min="0"
                    name="progressPercent"
                    required
                    type="number"
                  />
                </label>
                <button className="auth-submit" type="submit">
                  저장
                </button>
              </form>
              <div className="project-progress">
                <strong>{project.progressPercent}%</strong>
                <div aria-label={`진행률 ${project.progressPercent}%`} className="progress-track">
                  <span style={{ width: `${project.progressPercent}%` }} />
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
