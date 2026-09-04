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
  { match: (path) => path.startsWith("/quotes"), title: "견적서" },
  { match: (path) => path.startsWith("/contracts"), title: "계약" },
  { match: (path) => path.startsWith("/billings"), title: "청구" },
  { match: (path) => path.startsWith("/clients-projects"), title: "프로젝트" },
  { match: (path) => path.startsWith("/clients"), title: "고객사" },
  { match: (path) => path.startsWith("/revenue"), title: "매출 원장" },
  { match: (path) => path.startsWith("/expenses"), title: "비용 원장" },
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
