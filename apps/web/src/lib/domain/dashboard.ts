import { calculateCompanySetupProgress, type CompanySetupStatus } from "@/lib/domain/company-setup";
import { summarizeExpenses } from "@/lib/domain/expenses";

export const DASHBOARD_TIME_ZONE = "Asia/Seoul";
export const DASHBOARD_LIST_LIMIT = 5;

export type DashboardLink = {
  href: string;
  title: string;
  detail: string;
  amount?: number;
};

export const inboxKinds = ["deposit", "send", "sign", "pay", "review", "task", "setup"] as const;
export type DashboardInboxKind = (typeof inboxKinds)[number];

export const inboxKindLabels: Record<DashboardInboxKind, string> = {
  deposit: "입금",
  send: "발송",
  sign: "체결",
  pay: "지급",
  review: "승인",
  task: "업무",
  setup: "설립",
};

export type DashboardInboxItem = DashboardLink & {
  kind: DashboardInboxKind;
  kindLabel: string;
  when: string;
  overdue: boolean;
};

export type DashboardVitals = {
  pendingApprovals: number;
  todayTasks: number;
  overdueDeposits: number;
  unclassified: number;
  cashRhythm: "normal" | "watch";
};

export type DashboardCashWeek = {
  label: string;
  inflow: number;
  outflow: number;
};

export type DashboardProjectCard = {
  href: string;
  title: string;
  clientName: string;
  statusLabel: string;
  progressPercent: number;
  stages: { quote: boolean; contract: boolean; billing: boolean };
  nextAction: string;
};

export type DashboardWeekDay = {
  date: string;
  label: string;
  count: number;
  isToday: boolean;
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

function shiftIsoDate(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00+09:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return calendarDateInTimeZone(date);
}

function weekdayMondayIndex(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
  return weekday === 0 ? 6 : weekday - 1;
}

export function monthWeekBuckets(today: string): Array<{ label: string; start: string; end: string }> {
  const monthStart = `${today.slice(0, 7)}-01`;
  return [0, 1, 2, 3].map((index) => ({
    label: `${index + 1}주`,
    start: shiftIsoDate(monthStart, index * 7),
    end: shiftIsoDate(monthStart, index * 7 + 6),
  }));
}

export function weekDaysAround(today: string, taskDates: string[]): DashboardWeekDay[] {
  const monday = shiftIsoDate(today, -weekdayMondayIndex(today));
  const labels = ["월", "화", "수", "목", "금", "토", "일"];
  return labels.map((label, index) => {
    const date = shiftIsoDate(monday, index);
    return {
      date,
      label,
      count: taskDates.filter((item) => item === date).length,
      isToday: date === today,
    };
  });
}

const inboxKindOrder: Record<DashboardInboxKind, number> = {
  deposit: 0,
  pay: 1,
  send: 2,
  sign: 3,
  review: 4,
  task: 5,
  setup: 6,
};

function inboxRank(item: DashboardInboxItem, today: string) {
  if (item.overdue) return 0;
  if (item.when && item.when === today) return 1;
  if (!item.when) return 2;
  return 3;
}

function compareInbox(left: DashboardInboxItem, right: DashboardInboxItem, today: string) {
  return inboxRank(left, today) - inboxRank(right, today)
    || inboxKindOrder[left.kind] - inboxKindOrder[right.kind]
    || left.title.localeCompare(right.title, "ko");
}

function projectStatusLabel(status: string) {
  if (status === "active") return "진행 중";
  if (status === "on_hold") return "보류";
  return "예정";
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
  expenses: Array<{
    id: string;
    title: string;
    counterparty: string;
    amount: number;
    settlementDate: string;
    status: string;
    unclassified: boolean;
  }>;
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
  const expensesToCheck = take(
    input.expenses
      .filter((item) => item.status === "scheduled" && item.settlementDate <= today)
      .sort((left, right) => left.settlementDate.localeCompare(right.settlementDate))
      .map((item) => ({
        href: `/expenses/${item.id}`,
        title: item.title,
        detail: `${item.counterparty} · 지급 예정 ${item.settlementDate}`,
        amount: item.amount,
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

  const expenses = summarizeExpenses(input.expenses);
  const todayTasks = input.tasks.filter((item) => item.status === "open" && item.dueDate === today);
  const overdueTasks = input.tasks.filter((item) => item.status === "open" && item.dueDate < today);
  const overdueDeposits = input.billings.filter((item) => item.status === "scheduled" && item.dueDate < today);
  const inbox: DashboardInboxItem[] = [
    ...overdueDeposits.map((item) => ({
      href: `/billings/${item.id}`,
      title: item.contractTitle || item.kindLabel,
      detail: `${item.clientName} · ${item.kindLabel} · 입금 예정 ${item.dueDate}`,
      amount: item.amount,
      kind: "deposit" as const,
      kindLabel: inboxKindLabels.deposit,
      when: item.dueDate,
      overdue: true,
    })),
    ...billingsToCheck
      .filter((item) => !overdueDeposits.some((row) => `/billings/${row.id}` === item.href))
      .map((item) => ({
        ...item,
        kind: "deposit" as const,
        kindLabel: inboxKindLabels.deposit,
        when: today,
        overdue: false,
      })),
    ...quotesToSend.map((item) => ({
      ...item,
      kind: "send" as const,
      kindLabel: inboxKindLabels.send,
      when: "",
      overdue: false,
    })),
    ...contractsToExecute.map((item) => ({
      ...item,
      kind: "sign" as const,
      kindLabel: inboxKindLabels.sign,
      when: "",
      overdue: false,
    })),
    ...input.expenses
      .filter((item) => item.status === "scheduled" && item.settlementDate <= today)
      .map((item) => ({
        href: `/expenses/${item.id}`,
        title: item.title,
        detail: `${item.counterparty} · 지급 예정 ${item.settlementDate}`,
        amount: item.amount,
        kind: "pay" as const,
        kindLabel: inboxKindLabels.pay,
        when: item.settlementDate,
        overdue: item.settlementDate < today,
      })),
    ...proposalsToReview.map((item) => ({
      ...item,
      kind: "review" as const,
      kindLabel: inboxKindLabels.review,
      when: "",
      overdue: false,
    })),
    ...input.tasks
      .filter((item) => item.status === "open")
      .map((item) => ({
        href: `/tasks/${item.id}`,
        title: item.title,
        detail: `${item.clientName} · ${item.projectName} · 기한 ${item.dueDate}${item.dueDate < today ? " · 지남" : item.dueDate === today ? " · 오늘" : ""}`,
        kind: "task" as const,
        kindLabel: inboxKindLabels.task,
        when: item.dueDate,
        overdue: item.dueDate < today,
      })),
    ...evidenceGaps.map((item) => ({
      ...item,
      kind: "setup" as const,
      kindLabel: inboxKindLabels.setup,
      when: "",
      overdue: true,
    })),
    ...openSetupItems
      .filter((item) => !evidenceGaps.some((gap) => gap.title === item.title))
      .map((item) => ({
        ...item,
        kind: "setup" as const,
        kindLabel: inboxKindLabels.setup,
        when: "",
        overdue: false,
      })),
  ].sort((left, right) => compareInbox(left, right, today));

  const cashWeeks = monthWeekBuckets(today).map((week) => ({
    label: week.label,
    inflow: input.billings
      .filter((item) => item.billingDate >= week.start && item.billingDate <= week.end)
      .reduce((sum, item) => sum + item.amount, 0),
    outflow: input.expenses
      .filter((item) => item.settlementDate >= week.start && item.settlementDate <= week.end)
      .reduce((sum, item) => sum + item.amount, 0),
  }));

  const projectCards: DashboardProjectCard[] = take(
    input.projects.filter((item) => item.status !== "complete").map((item) => {
      const next = inbox.find((row) => row.detail.includes(item.clientName) || row.title === item.name);
      return {
        href: `/clients-projects/${item.id}`,
        title: item.name,
        clientName: item.clientName,
        statusLabel: projectStatusLabel(item.status),
        progressPercent: item.progressPercent,
        stages: {
          quote: input.quotes.some((row) => row.clientName === item.clientName),
          contract: input.contracts.some((row) => row.clientName === item.clientName && row.status === "executed"),
          billing: input.billings.some((row) => row.clientName === item.clientName),
        },
        nextAction: next ? `${next.kindLabel} · ${next.title}` : "다음 할 일이 없습니다",
      };
    }),
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
    expenses,
    expensesToCheck,
    schedule,
    recentDecisions,
    documentCount: input.documentCount,
    inbox: take(inbox, 8),
    vitals: {
      pendingApprovals: contractsToExecute.length + proposalsToReview.length,
      todayTasks: todayTasks.length,
      overdueDeposits: overdueDeposits.length,
      unclassified: input.revenue.unclassifiedCount + expenses.unclassifiedCount,
      cashRhythm: overdueDeposits.length > 0 || overdueTasks.length > 0 ? "watch" : "normal",
    },
    cashWeeks,
    projectCards,
    weekDays: weekDaysAround(today, input.tasks.filter((item) => item.status === "open").map((item) => item.dueDate)),
  };
}
