"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { createAgentAction } from "@/app/(private)/agents/actions";
import { CreateIconButton } from "@/components/create-icon-button";
import { CreatePanel } from "@/components/create-panel";
import {
  aiAgentAllowedWorkKinds,
  aiAgentAllowedWorkLabels,
  aiAgentCapabilityKinds,
  aiAgentCapabilityLabels,
  aiAgentModelProviderLabels,
  aiAgentModelProviders,
  aiAgentStatusLabels,
  formatAllowedWork,
  type AiAgentModelProvider,
  type AiAgentStatus,
} from "@/lib/domain/agents";
import { ventureKindLabels } from "@/lib/domain/revenue";

type AgentRow = {
  id: string;
  name: string;
  purpose: string;
  status: AiAgentStatus;
  scopeLabel: string;
  allowedWork: string[];
  modelProvider: AiAgentModelProvider;
};

type Project = { id: string; name: string; clientName: string };
type Venture = { id: string; name: string; kind: "app" | "subscription" };

export function AgentsPageClient({
  projects,
  ventures,
  agents,
}: {
  projects: Project[];
  ventures: Venture[];
  agents: AgentRow[];
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
          <p className="auth-eyebrow">CORELOOM / AGENTS</p>
          <h1>AI 에이전트</h1>
          <p>
            사람 Neon 계정과 다른 시스템 계정으로 이름·목적·지침·모델(구독)·허용 업무·능력을 등록합니다.
            기록 저장·외부 발송·금액 확정은 기본으로 꺼 두며, 대표가 에이전트마다 켤 수 있습니다. 로그인과 자동 실행은 포함하지 않습니다.
          </p>
        </div>
        <CreateIconButton label="새 에이전트" onClick={openCreate} />
      </header>

      <section className="quote-list" aria-label="에이전트 목록">
        <div className="list-heading">
          <div>
            <p className="setup-code">등록부</p>
            <h2>시스템 계정</h2>
          </div>
          <span>{agents.length}개</span>
        </div>
        {agents.length === 0 ? (
          <div className="empty-state quote-empty-inline">
            <p>등록된 에이전트가 없습니다. 사람 계정 역할로 넣지 않습니다.</p>
            <button className="auth-submit" onClick={openCreate} type="button">첫 에이전트 만들기</button>
          </div>
        ) : (
          agents.map((agent) => (
            <a className="quote-row" href={`/agents/${agent.id}`} key={agent.id}>
              <div>
                <p>
                  {aiAgentStatusLabels[agent.status]} · {agent.scopeLabel} · {aiAgentModelProviderLabels[agent.modelProvider]}
                </p>
                <h3>{agent.name}</h3>
                <p className="form-help">{formatAllowedWork(agent.allowedWork)}</p>
              </div>
              <strong>{aiAgentStatusLabels[agent.status]}</strong>
            </a>
          ))
        )}
      </section>

      <CreatePanel onClose={close} open={open} size="wide" title="새 에이전트">
        <form action={createAgentAction} className="quote-form">
          <p className="setup-code quote-form-full">연결</p>
          <p className="form-help quote-form-full">
            프로젝트와 사업을 동시에 고르지 마세요. 둘 다 비우면 회사 공통입니다. 모델은 API 키가 아니라 구독 채널입니다.
          </p>
          <label>
            고객사 프로젝트 (선택)
            <select defaultValue="" name="projectId">
              <option value="">회사 공통</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.clientName} · {project.name}</option>
              ))}
            </select>
          </label>
          <label>
            앱·구독 사업 (선택)
            <select defaultValue="" name="ventureId">
              <option value="">연결 안 함</option>
              {ventures.map((venture) => (
                <option key={venture.id} value={venture.id}>{ventureKindLabels[venture.kind]} · {venture.name}</option>
              ))}
            </select>
          </label>

          <p className="setup-code quote-form-full">기본</p>
          <label className="quote-form-full">이름<input name="name" placeholder="예: 초안 도우미" required /></label>
          <label className="quote-form-full">목적<textarea name="purpose" placeholder="이 에이전트가 돕는 일" required /></label>
          <label className="quote-form-full">접근 범위<textarea name="accessScope" placeholder="볼 수 있는 고객·프로젝트·자료 범위" required /></label>
          <label className="quote-form-full">
            모델 (구독)
            <select defaultValue="claude_subscription" name="modelProvider">
              {aiAgentModelProviders.map((provider) => (
                <option key={provider} value={provider}>{aiAgentModelProviderLabels[provider]}</option>
              ))}
            </select>
          </label>

          <p className="setup-code quote-form-full">지침</p>
          <label className="quote-form-full">일하는 방식<textarea name="workStyle" placeholder="조사 후 초안, 숫자 근거를 먼저 확인 등" /></label>
          <label className="quote-form-full">답변 방식<textarea name="answerStyle" placeholder="짧고 확인 질문 위주, 표로 정리 등" /></label>
          <label className="quote-form-full">절차<textarea name="procedure" placeholder="1) 배경 확인 2) 부족한 질문 3) 초안 제안" /></label>
          <label className="quote-form-full">지침<textarea name="instructions" placeholder="반드시 지킬 규칙, 금지 사항, 톤" /></label>
          <div className="quote-form-full">
            <p className="setup-code">허용 업무</p>
            {aiAgentAllowedWorkKinds.map((kind) => (
              <label className="quote-email-approval" key={kind}>
                <input name="allowedWork" type="checkbox" value={kind} />
                {aiAgentAllowedWorkLabels[kind]}
              </label>
            ))}
          </div>
          <div className="quote-form-full">
            <p className="setup-code">능력 (기본 꺼짐)</p>
            <p className="form-help">지침 문구만으로 권한은 생기지 않습니다. 아래를 켠 능력만 실행할 수 있습니다.</p>
            {aiAgentCapabilityKinds.map((kind) => (
              <label className="quote-email-approval" key={kind}>
                <input name="capabilities" type="checkbox" value={kind} />
                {aiAgentCapabilityLabels[kind]}
              </label>
            ))}
          </div>
          <button className="auth-submit" type="submit">에이전트 저장</button>
        </form>
      </CreatePanel>
    </>
  );
}
