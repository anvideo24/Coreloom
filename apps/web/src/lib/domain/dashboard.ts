import { calculateCompanySetupProgress, type CompanySetupStatus } from "@/lib/domain/company-setup";

export const DASHBOARD_TIME_ZONE = "Asia/Seoul";
export const DASHBOARD_LIST_LIMIT = 5;

export type DashboardLink = {
  href: string;
  title: string;
  detail: string;
  amount?: number;
};

export function calendarDateInTimeZone(now: Date, timeZone = DASHBOARD_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function take<T>(items: T[], limit: number) {
  return items.slice(0, limit);
}

function shorten(value: string, max = 48) {
  const text = value.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export function buildFounderDashboard(input: {
  today: string;
  setupItems: Array<{
    id: string;
    title: string;
    status: CompanySetupStatus;
    evidenceReference: string | null;
  }>;
  quotes: Array<{
    quoteId: string;
    versionId: string;
    versionNumber: number;
    title: string;
    clientName: string;
    totalAmount: number;
    emailRequested: boolean;
  }>;
  contracts: Array<{
    contractId: string;
    title: string;
    clientName: string;
    status: string;
    totalAmount: number;
  }>;
  billings: Array<{
    id: string;
    clientName: string;
    contractTitle: string;
    kindLabel: string;
    amount: number;
    billingDate: string;
    dueDate: string;
    status: string;
  }>;
  pendingProposals: Array<{
    id: string;
    kindLabel: string;
    body: string;
    clientName: string;
    projectName: string;
  }>;
  projects: Array<{
    id: string;
    name: string;
    clientName: string;
    status: string;
    progressPercent: number;
  }>;
  revenue: {
    confirmedAmount: number;
    scheduledAmount: number;
    unclassifiedCount: number;
  };
  tasks: Array<{
    id: string;
    title: string;
    dueDate: string;
    status: string;
    clientName: string;
    projectName: string;
  }>;
  recentDecisions: Array<{
    id: string;
    kindLabel: string;
    body: string;
    statusLabel: string;
    clientName: string;
    projectName: string;
  }>;
  documentCount: number;
}, limit = DASHBOARD_LIST_LIMIT) {
  const today = input.today.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error("Dashboard date is required");

  const openSetupItems = input.setupItems
    .filter((item) => item.status === "not_started" || item.status === "in_progress")
    .map((item) => ({ href: "/company-setup", title: item.title, detail: item.status === "in_progress" ? "진행 중" : "시작 전" }));
  const evidenceGaps = input.setupItems
    .filter((item) => (item.status === "complete" || item.status === "in_progress") && !item.evidenceReference)
    .map((item) => ({ href: "/company-setup", title: item.title, detail: "증빙 위치 없음" }));

  const quotesToSend = take(
    input.quotes.filter((item) => !item.emailRequested).map((item) => ({
      href: `/quotes/${item.quoteId}/versions/${item.versionId}/email`,
      title: item.title,
      detail: `${item.clientName} · v${item.versionNumber} · 메일 미발송`,
      amount: item.totalAmount,
    })),
    limit,
  );
  const contractsToExecute = take(
    input.contracts.filter((item) => item.status !== "executed").map((item) => ({
      href: `/contracts/${item.contractId}`,
      title: item.title,
      detail: `${item.clientName} · ${item.status === "original_recorded" ? "날인 원본 보관" : "초안"}`,
      amount: item.totalAmount,
    })),
    limit,
  );
  const billingsToCheck = take(
    input.billings
      .filter((item) => item.status === "scheduled" && (item.billingDate <= today || item.dueDate <= today))
      .sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.billingDate.localeCompare(right.billingDate))
      .map((item) => ({
        href: `/billings/${item.id}`,
        title: item.contractTitle || item.kindLabel,
        detail: `${item.clientName} · ${item.kindLabel} · ${item.dueDate <= today ? `입금 예정 ${item.dueDate}` : `청구일 ${item.billingDate}`}`,
        amount: item.amount,
      })),
    limit,
  );
  const proposalsToReview = take(
    input.pendingProposals.map((item) => ({
      href: `/proposals/${item.id}`,
      title: shorten(item.body),
      detail: `${item.clientName} · ${item.projectName} · ${item.kindLabel} · 공식 결정 아님`,
    })),
    limit,
  );
  const activeProjects = take(
    input.projects.filter((item) => item.status !== "complete").map((item) => ({
      href: `/clients-projects/${item.id}`,
      title: item.name,
      detail: `${item.clientName} · ${item.status === "active" ? "진행 중" : item.status === "on_hold" ? "보류" : "예정"} · ${item.progressPercent}%`,
    })),
    limit,
  );
  const schedule = take(
    input.tasks
      .filter((item) => item.status === "open")
      .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
      .map((item) => ({
        href: `/tasks/${item.id}`,
        title: item.title,
        detail: `${item.clientName} · ${item.projectName} · 기한 ${item.dueDate}${item.dueDate < today ? " · 지남" : item.dueDate === today ? " · 오늘" : ""}`,
      })),
    limit,
  );
  const recentDecisions = take(
    input.recentDecisions.map((item) => ({
      href: `/proposals/${item.id}`,
      title: shorten(item.body),
      detail: `${item.clientName} · ${item.projectName} · ${item.kindLabel} · ${item.statusLabel}`,
    })),
    limit,
  );

  return {
    today,
    setupProgress: calculateCompanySetupProgress(input.setupItems),
    openSetupItems: take(openSetupItems, limit),
    evidenceGaps: take(evidenceGaps, limit),
    quotesToSend,
    contractsToExecute,
    billingsToCheck,
    proposalsToReview,
    activeProjects,
    revenue: input.revenue,
    schedule,
    recentDecisions,
    documentCount: input.documentCount,
  };
}
