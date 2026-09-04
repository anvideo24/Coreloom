"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { linkRechoEvidenceAction } from "@/app/(private)/timeline/actions";
import { CreateIconButton } from "@/components/create-icon-button";
import { CreatePanel } from "@/components/create-panel";
import {
  rechoEvidenceKindLabels,
  rechoEvidenceKinds,
  type RechoEvidenceKind,
} from "@/lib/domain/recho-evidence";

type Project = { id: string; name: string; clientName: string };
type EvidenceRow = {
  id: string;
  kind: RechoEvidenceKind;
  title: string;
  occurredOn: string;
  occurredTime: string;
  clientName: string;
  projectName: string;
};
type TimelineGroup = { occurredOn: string; records: EvidenceRow[] };

export function TimelinePageClient({
  projects,
  timeline,
}: {
  projects: Project[];
  timeline: TimelineGroup[];
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

  const canCreate = projects.length > 0;

  return (
    <>
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / EVIDENCE</p>
          <h1>근거 기록</h1>
          <p>
            Recho의 메일·통화·회의를 프로젝트에 연결하고 시간순으로 봅니다. Coreloom은 원문 식별자·발생 시각·연결 이유만
            보관하며, 원문은 수정하지 않습니다. AI 제안은 근거에 연결한 뒤 AI 제안 화면에서 확정하거나 반려합니다. Recho
            API 동기화는 이 기능에 포함되지 않습니다.
          </p>
        </div>
        <CreateIconButton disabled={!canCreate} label="근거 연결" onClick={openCreate} />
      </header>

      {!canCreate ? (
        <section className="empty-state quote-empty">
          <h2>먼저 프로젝트를 등록해 주세요</h2>
          <p>근거 기록은 고객사 프로젝트에 연결합니다. 연결할 프로젝트가 없으면 미분류로 두지 않습니다.</p>
          <a className="text-link" href="/clients-projects">
            프로젝트로 이동
          </a>
        </section>
      ) : null}

      <section aria-label="시간순 근거" className="quote-list">
        <div className="list-heading">
          <div>
            <p className="setup-code">타임라인</p>
            <h2>시간순 근거</h2>
          </div>
          <span>{timeline.length}일</span>
        </div>
        {timeline.length === 0 ? (
          <div className="empty-state quote-empty-inline">
            <p>연결된 근거 기록이 없습니다.</p>
            {canCreate ? (
              <button className="auth-submit" onClick={openCreate} type="button">
                첫 근거 연결하기
              </button>
            ) : null}
          </div>
        ) : (
          timeline.map((group) => (
            <article className="quote-list" key={group.occurredOn}>
              <p className="setup-code">{group.occurredOn}</p>
              {group.records.map((record) => (
                <a className="quote-row" href={`/timeline/${record.id}`} key={record.id}>
                  <div>
                    <p>
                      {record.clientName} · {record.projectName} · {rechoEvidenceKindLabels[record.kind]} ·{" "}
                      {record.occurredTime}
                    </p>
                    <h3>{record.title}</h3>
                  </div>
                  <strong>{rechoEvidenceKindLabels[record.kind]}</strong>
                </a>
              ))}
            </article>
          ))
        )}
      </section>

      {canCreate ? (
        <CreatePanel onClose={close} open={open} size="wide" title="근거 연결">
          <form action={linkRechoEvidenceAction} className="quote-form">
            <p className="form-help quote-form-full">
              표시 제목은 목록 구분용이며 원문이 아닙니다. 원문은 Recho에서 식별자 또는 링크로 엽니다.
            </p>
            <p className="setup-code quote-form-full">연결</p>
            <label>
              프로젝트
              <select defaultValue={projects[0]?.id} name="projectId" required>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.clientName} · {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              종류
              <select defaultValue="email" name="kind">
                {rechoEvidenceKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {rechoEvidenceKindLabels[kind]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              발생일
              <input name="occurredOn" required type="date" />
            </label>
            <label>
              발생 시각
              <input name="occurredTime" required type="time" />
            </label>

            <p className="setup-code quote-form-full">원문</p>
            <label className="quote-form-full">
              표시 제목
              <input name="title" placeholder="예: 견적 범위 회신" required />
            </label>
            <label>
              원문 식별자
              <input name="originalIdentifier" placeholder="예: recho-record-1" required />
            </label>
            <label>
              원문 링크 (선택)
              <input name="originalUrl" placeholder="https://" type="url" />
            </label>
            <label className="quote-form-full">
              연결 이유
              <textarea name="linkReason" placeholder="이 기록을 이 프로젝트의 근거로 연결하는 이유" required />
            </label>
            <button className="auth-submit" type="submit">
              근거로 연결
            </button>
          </form>
        </CreatePanel>
      ) : null}
    </>
  );
}
