import {
  aiAgentModelProviderLabels,
  formatAllowedWork,
  type AiAgentModelProvider,
} from "@/lib/domain/agents";

export const AGENT_PANEL_OPEN_STORAGE_KEY = "coreloom.agent-panel-open";
export const AGENT_PANEL_SELECTED_STORAGE_KEY = "coreloom.agent-panel-selected";

export function parseAgentPanelOpen(value: string | null) {
  return value === "1";
}

export function serializeAgentPanelOpen(open: boolean) {
  return open ? "1" : "0";
}

export function isAgentPanelToggleHotkey(event: KeyboardEvent) {
  return (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "j";
}

const pageTitles: Array<{ match: (pathname: string) => boolean; title: string }> = [
  { match: (path) => path === "/dashboard", title: "대시보드" },
  { match: (path) => path.startsWith("/approvals"), title: "승인함" },
  { match: (path) => path.startsWith("/quotes"), title: "견적서" },
  { match: (path) => path.startsWith("/contracts"), title: "계약" },
  { match: (path) => path.startsWith("/billings"), title: "청구" },
  { match: (path) => path.startsWith("/clients-projects"), title: "프로젝트" },
  { match: (path) => path.startsWith("/clients"), title: "고객사" },
  { match: (path) => path.startsWith("/revenue"), title: "매출 원장" },
  { match: (path) => path.startsWith("/expenses"), title: "비용 원장" },
  { match: (path) => path.startsWith("/accounts"), title: "계정과목" },
  { match: (path) => path.startsWith("/tasks"), title: "업무" },
  { match: (path) => path.startsWith("/agents"), title: "에이전트" },
  { match: (path) => path.startsWith("/timeline"), title: "근거 기록" },
  { match: (path) => path.startsWith("/proposals"), title: "AI 제안" },
  { match: (path) => path.startsWith("/documents"), title: "문서함" },
  { match: (path) => path.startsWith("/company-setup"), title: "설립 준비" },
  { match: (path) => path.startsWith("/admin/manual"), title: "매뉴얼" },
];

export function agentPanelContextTitle(pathname: string) {
  return pageTitles.find((entry) => entry.match(pathname))?.title ?? "운영 화면";
}

export const agentPanelHandoffHints: Record<AiAgentModelProvider, { label: string; hint: string }> = {
  claude_subscription: {
    label: "Claude 구독",
    hint: "Claude 웹·앱 구독 채팅에 아래 패키지를 붙여넣으세요. API 키 호출이 아닙니다.",
  },
  gpt_codex_subscription: {
    label: "GPT·Codex 구독",
    hint: "ChatGPT 또는 Codex 구독 자리에 아래 패키지를 붙여넣으세요. API 키 호출이 아닙니다.",
  },
  cursor_agent: {
    label: "Cursor",
    hint: "Cursor Agent 채팅에 아래 패키지를 붙여넣으세요. API 키 호출이 아닙니다.",
  },
};

export function normalizeAgentPanelMessage(value: string) {
  const message = value.trim();
  if (!message) throw new Error("Panel message is required");
  if (message.length > 2000) throw new Error("Panel message is too long");
  return message;
}

export function normalizeAgentPanelPathname(value: string) {
  const pathname = value.trim() || "/";
  if (pathname.length > 240) throw new Error("Panel pathname is too long");
  if (!pathname.startsWith("/")) throw new Error("Panel pathname is invalid");
  return pathname;
}

/** 구독 자리에 붙여넣을 패키지. API 키·자동 실행은 만들지 않는다. */
export function buildAgentSubscriptionPackage(input: {
  agentName: string;
  purpose: string;
  workStyle?: string | null;
  answerStyle?: string | null;
  procedure?: string | null;
  instructions?: string | null;
  allowedWork: string[];
  modelProvider: AiAgentModelProvider;
  pathname: string;
  contextTitle: string;
  message: string;
}) {
  const message = normalizeAgentPanelMessage(input.message);
  const pathname = normalizeAgentPanelPathname(input.pathname);
  const contextTitle = input.contextTitle.trim() || agentPanelContextTitle(pathname);
  const handoff = agentPanelHandoffHints[input.modelProvider];
  const sections = [
    `# Coreloom 에이전트 요청`,
    `에이전트: ${input.agentName}`,
    `목적: ${input.purpose}`,
    `모델: ${aiAgentModelProviderLabels[input.modelProvider]}`,
    `허용 업무: ${formatAllowedWork(input.allowedWork) || "없음"}`,
    `화면: ${contextTitle} (${pathname})`,
    input.workStyle?.trim() ? `일하는 방식: ${input.workStyle.trim()}` : null,
    input.answerStyle?.trim() ? `답변 방식: ${input.answerStyle.trim()}` : null,
    input.procedure?.trim() ? `절차:\n${input.procedure.trim()}` : null,
    input.instructions?.trim() ? `지침:\n${input.instructions.trim()}` : null,
    `요청:\n${message}`,
    `제약: 금전·계약·권한·외부 공개의 최종 확정은 하지 마세요. 초안·조사·승인 요청 초안까지만 하세요.`,
  ].filter(Boolean);

  return {
    packageText: sections.join("\n\n"),
    handoffLabel: handoff.label,
    handoffHint: handoff.hint,
    modelLabel: aiAgentModelProviderLabels[input.modelProvider],
    contextTitle,
    pathname,
    message,
  };
}

export function buildAgentPanelWorkNotes(input: {
  message: string;
  contextTitle: string;
  pathname: string;
  modelLabel: string;
  packageText: string;
}) {
  const requestNote = input.message;
  const inputNote = [
    `화면 ${input.contextTitle} (${input.pathname})`,
    `모델 ${input.modelLabel}`,
    `구독 패키지 ${input.packageText.length}자 (패널에서 복사)`,
  ].join("\n");
  return { requestNote, inputNote };
}
