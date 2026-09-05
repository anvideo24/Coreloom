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
  id: string;
  kind: DashboardInboxKind;
  kindLabel: string;
  when: string;
  overdue: boolean;
  /** 이 항목이 속한 프로젝트. 견적·계약·청구·업무·제안만 갖는다. 설립·비용 항목은 없다(F05-03). */
  projectId?: string | null;
};

export type DashboardVitals = {
  pendingApprovals: number;
  todayTasks: number;
  overdueDeposits: number;
  unclassified: number;
  /**
   * "empty"는 판단할 청구·업무 기록이 아예 없다는 뜻이다. "normal"(정상)과 다르다 —
   * 기록이 없는 것을 정상으로 표시하면 대표가 실제로는 아직 아무 것도 등록하지 않은 상태를
   * "문제 없음"으로 오인할 수 있다(F05-04).
   */
  cashRhythm: "empty" | "normal" | "watch";
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
  const [year, month] = today.slice(0, 7).split("-").map(Number);
  const monthEnd = `${today.slice(0, 7)}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
  const buckets: Array<{ label: string; start: string; end: string }> = [];
  let start = monthStart;
  let index = 0;
  while (start <= monthEnd) {
    const unboundedEnd = shiftIsoDate(start, 6);
    const end = unboundedEnd > monthEnd ? monthEnd : unboundedEnd;
    buckets.push({ label: `${index + 1}주`, start, end });
    start = shiftIsoDate(end, 1);
    index += 1;
  }
  return buckets;
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
    projectId: string | null;
    totalAmount: number;
    emailRequested: boolean;
  }>;
  contracts: Array<{
    contractId: string;
    title: string;
    clientName: string;
    projectId: string | null;
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
    projectId: string | null;
    status: string;
  }>;
  pendingProposals: Array<{
    id: string;
    kindLabel: string;
    body: string;
    clientName: string;
    projectName: string;
    projectId?: string | null;
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
    projectId?: string | null;
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
      projectId: item.projectId ?? null,
    })),
    limit,
  );
  const contractsToExecute = take(
    input.contracts.filter((item) => item.status !== "executed").map((item) => ({
      href: `/contracts/${item.contractId}`,
      title: item.title,
      detail: `${item.clientName} · ${item.status === "original_recorded" ? "날인 원본 보관" : "초안"}`,
      amount: item.totalAmount,
      projectId: item.projectId ?? null,
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
        projectId: item.projectId ?? null,
      })),
    limit,
  );
  const proposalsToReview = take(
    input.pendingProposals.map((item) => ({
      href: `/proposals/${item.id}`,
      title: shorten(item.body),
      detail: `${item.clientName} · ${item.projectName} · ${item.kindLabel} · 공식 결정 아님`,
      projectId: item.projectId ?? null,
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
      id: `deposit:${item.id}`,
      href: `/billings/${item.id}`,
      title: item.contractTitle || item.kindLabel,
      detail: `${item.clientName} · ${item.kindLabel} · 입금 예정 ${item.dueDate}`,
      amount: item.amount,
      kind: "deposit" as const,
      kindLabel: inboxKindLabels.deposit,
      when: item.dueDate,
      overdue: true,
      projectId: item.projectId ?? null,
    })),
    ...billingsToCheck
      .filter((item) => !overdueDeposits.some((row) => `/billings/${row.id}` === item.href))
      .map((item) => ({
        ...item,
        id: `deposit:${item.href}`,
        kind: "deposit" as const,
        kindLabel: inboxKindLabels.deposit,
        when: today,
        overdue: false,
      })),
    ...quotesToSend.map((item) => ({
      ...item,
      id: `send:${item.href}`,
      kind: "send" as const,
      kindLabel: inboxKindLabels.send,
      when: "",
      overdue: false,
    })),
    ...contractsToExecute.map((item) => ({
      ...item,
      id: `sign:${item.href}`,
      kind: "sign" as const,
      kindLabel: inboxKindLabels.sign,
      when: "",
      overdue: false,
    })),
    ...input.expenses
      .filter((item) => item.status === "scheduled" && item.settlementDate <= today)
      .map((item) => ({
        id: `pay:${item.id}`,
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
      id: `review:${item.href}`,
      kind: "review" as const,
      kindLabel: inboxKindLabels.review,
      when: "",
      overdue: false,
    })),
    ...input.tasks
      .filter((item) => item.status === "open")
      .map((item) => ({
        id: `task:${item.id}`,
        href: `/tasks/${item.id}`,
        title: item.title,
        detail: `${item.clientName} · ${item.projectName} · 기한 ${item.dueDate}${item.dueDate < today ? " · 지남" : item.dueDate === today ? " · 오늘" : ""}`,
        kind: "task" as const,
        kindLabel: inboxKindLabels.task,
        when: item.dueDate,
        overdue: item.dueDate < today,
        projectId: item.projectId ?? null,
      })),
    ...input.setupItems
      .filter((item) => (item.status === "complete" || item.status === "in_progress") && !item.evidenceReference)
      .map((item) => ({
        id: `setup-gap:${item.id}`,
        href: "/company-setup",
        title: item.title,
        detail: "증빙 위치 없음",
        kind: "setup" as const,
        kindLabel: inboxKindLabels.setup,
        when: "",
        overdue: true,
      })),
    ...input.setupItems
      .filter((item) => item.status === "not_started" || item.status === "in_progress")
      .filter((item) => !(item.status === "in_progress" && !item.evidenceReference))
      .map((item) => ({
        id: `setup-open:${item.id}`,
        href: "/company-setup",
        title: item.title,
        detail: item.status === "in_progress" ? "진행 중" : "시작 전",
        kind: "setup" as const,
        kindLabel: inboxKindLabels.setup,
        when: "",
        overdue: false,
      })),
  ].sort((left, right) => compareInbox(left, right, today));

  // "입금 예정"·"지급 예정" 합계다. status가 이미 확인(입금/지급 완료)된 항목까지 날짜만 보고
  // 더하면 이미 끝난 돈이 "예정"으로 다시 잡힌다(F05-02) — 그래서 scheduled 상태만 더한다.
  const cashWeeks = monthWeekBuckets(today).map((week) => ({
    label: week.label,
    inflow: input.billings
      .filter((item) => item.status === "scheduled" && item.dueDate >= week.start && item.dueDate <= week.end)
      .reduce((sum, item) => sum + item.amount, 0),
    outflow: input.expenses
      .filter((item) => item.status === "scheduled" && item.settlementDate >= week.start && item.settlementDate <= week.end)
      .reduce((sum, item) => sum + item.amount, 0),
  }));

  const projectCards: DashboardProjectCard[] = take(
    input.projects.filter((item) => item.status !== "complete").map((item) => {
      // clientName 문자열 일치가 아니라 projectId로만 맞춘다. 동명 고객사·같은 고객사의
      // 다른 프로젝트가 있으면 이름 매칭은 엉뚱한 프로젝트의 다음 행동을 끌어온다(F05-03).
      const next = inbox.find((row) => row.projectId === item.id);
      return {
        href: `/clients-projects/${item.id}`,
        title: item.name,
        clientName: item.clientName,
        statusLabel: projectStatusLabel(item.status),
        progressPercent: item.progressPercent,
        stages: {
          quote: input.quotes.some((row) => row.projectId === item.id),
          contract: input.contracts.some((row) => row.projectId === item.id && row.status === "executed"),
          billing: input.billings.some((row) => row.projectId === item.id),
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
      cashRhythm:
        overdueDeposits.length > 0 || overdueTasks.length > 0
          ? "watch"
          : input.billings.length > 0 || input.tasks.length > 0
            ? "normal"
            : "empty",
    },
    cashWeeks,
    projectCards,
    weekDays: weekDaysAround(today, input.tasks.filter((item) => item.status === "open").map((item) => item.dueDate)),
  };
}
