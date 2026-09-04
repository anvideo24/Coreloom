"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { createProjectAction, updateProjectProgressAction } from "@/app/(private)/clients-projects/actions";
import { CreateIconButton } from "@/components/create-icon-button";
import { CreatePanel } from "@/components/create-panel";
import {
  formatProjectListMeta,
  projectStatusLabels,
  projectStatuses,
  type ProjectStatus,
} from "@/lib/domain/clients-projects";

type Client = { id: string; name: string };
type ProjectRow = {
  id: string;
  name: string;
  summary: string | null;
  status: ProjectStatus;
  progressPercent: number;
  startOn: string | null;
  targetEndOn: string | null;
  clientName: string;
};

export function ProjectsPageClient({
  clients,
  projects,
}: {
  clients: Client[];
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

  const canCreate = clients.length > 0;

  return (
    <>
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / PROJECTS</p>
          <h1>프로젝트</h1>
          <p>
            고객사에 연결된 프로젝트 목록입니다. +로 등록하고, 이름을 열면 업무·견적·계약·청구·문서와 Recho 근거를
            봅니다. 고객사·담당자는{" "}
            <a className="text-link" href="/clients">
              고객사
            </a>
            에서 관리합니다.
          </p>
        </div>
        <CreateIconButton disabled={!canCreate} label="새 프로젝트" onClick={openCreate} />
      </header>

      {!canCreate ? (
        <section className="empty-state quote-empty">
          <h2>먼저 고객사를 등록해 주세요</h2>
          <p>프로젝트는 고객사에 연결해 보관합니다.</p>
          <a className="text-link" href="/clients">
            고객사 등록으로 이동
          </a>
        </section>
      ) : null}

      <section aria-label="등록된 프로젝트" className="project-list">
        <div className="list-heading">
          <div>
            <p className="setup-code">등록 현황</p>
            <h2>프로젝트</h2>
          </div>
          <span>{projects.length}개</span>
        </div>
        {projects.length === 0 ? (
          <div className="empty-state quote-empty-inline">
            <p>등록된 프로젝트가 없습니다.</p>
            {canCreate ? (
              <button className="auth-submit" onClick={openCreate} type="button">
                첫 프로젝트 만들기
              </button>
            ) : null}
          </div>
        ) : (
          projects.map((project) => (
            <article className="project-row" key={project.id}>
              <div>
                <p>{formatProjectListMeta(project)}</p>
                <h3>
                  <a href={`/clients-projects/${project.id}`}>{project.name}</a>
                </h3>
                {project.summary?.trim() ? <p className="form-help">{project.summary}</p> : null}
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

      {canCreate ? (
        <CreatePanel onClose={close} open={open} size="wide" title="새 프로젝트">
          <form action={createProjectAction} className="quote-form">
            <p className="setup-code quote-form-full">연결</p>
            <label className="quote-form-full">
              고객사
              <select defaultValue={clients[0]?.id} name="clientId" required>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>

            <p className="setup-code quote-form-full">프로젝트</p>
            <label className="quote-form-full">
              프로젝트명
              <input name="name" placeholder="예: 브랜드 사이트 구축" required />
            </label>
            <label className="quote-form-full">
              요약 (선택)
              <textarea name="summary" placeholder="범위·목표를 한두 문장으로" />
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
            <label>
              시작일 (선택)
              <input name="startOn" type="date" />
            </label>
            <label>
              목표 종료일 (선택)
              <input name="targetEndOn" type="date" />
            </label>
            <button className="auth-submit" type="submit">
              프로젝트 저장
            </button>
          </form>
        </CreatePanel>
      ) : null}
    </>
  );
}
