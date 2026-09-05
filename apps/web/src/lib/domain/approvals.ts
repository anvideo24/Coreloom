export const approvalKinds = [
  "expense",
  "revenue",
  "billing",
  "contract",
  "proposal",
  "agent_work",
] as const;

export type ApprovalKind = (typeof approvalKinds)[number];

export const approvalKindLabels: Record<ApprovalKind, string> = {
  expense: "비용 확정",
  revenue: "매출 확정",
  billing: "입금 확정",
  contract: "계약 체결",
  proposal: "AI 제안",
  agent_work: "에이전트 요청",
};

export type ApprovalInboxItem = {
  id: string;
  kind: ApprovalKind;
  kindLabel: string;
  href: string;
  title: string;
  detail: string;
  amount?: number;
  when: string;
};

const kindOrder = new Map(approvalKinds.map((kind, index) => [kind, index]));

function shorten(text: string, max = 72) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function buildApprovalInbox(input: {
  expenses: Array<{
    id: string;
    title: string;
    counterparty: string;
    amount: number;
    settlementDate: string;
    status: string;
  }>;
  revenueEntries: Array<{
    id: string;
    href: string;
    title: string;
    counterparty: string;
    amount: number;
    settlementDate: string;
    status: string;
    source: string;
  }>;
  billings: Array<{
    id: string;
    clientName: string;
    contractTitle: string;
    kindLabel: string;
    amount: number;
    dueDate: string;
    status: string;
  }>;
  contracts: Array<{
    contractId: string;
    title: string;
    clientName: string;
    status: string;
    totalAmount: number;
  }>;
  proposals: Array<{
    id: string;
    kindLabel: string;
    body: string;
    clientName: string;
    projectName: string;
  }>;
  agentWorks: Array<{
    id: string;
    agentId: string;
    agentName: string;
    requestNote: string;
    createdAt: string;
  }>;
}): ApprovalInboxItem[] {
  const items: ApprovalInboxItem[] = [
    ...input.expenses
      .filter((item) => item.status === "scheduled")
      .map((item) => ({
        id: `expense:${item.id}`,
        kind: "expense" as const,
        kindLabel: approvalKindLabels.expense,
        href: `/expenses/${item.id}`,
        title: item.title,
        detail: `${item.counterparty} · 지급 예정 ${item.settlementDate}`,
        amount: item.amount,
        when: item.settlementDate,
      })),
    ...input.revenueEntries
      .filter((item) => item.status === "scheduled" && item.source === "revenue_entry")
      .map((item) => ({
        id: `revenue:${item.id}`,
        kind: "revenue" as const,
        kindLabel: approvalKindLabels.revenue,
        href: item.href.startsWith("/") ? item.href : `/revenue/${item.id}`,
        title: item.title,
        detail: `${item.counterparty} · 정산일 ${item.settlementDate}`,
        amount: item.amount,
        when: item.settlementDate,
      })),
    ...input.billings
      .filter((item) => item.status === "scheduled")
      .map((item) => ({
        id: `billing:${item.id}`,
        kind: "billing" as const,
        kindLabel: approvalKindLabels.billing,
        href: `/billings/${item.id}`,
        title: item.contractTitle || item.kindLabel,
        detail: `${item.clientName} · ${item.kindLabel} · 입금 예정 ${item.dueDate}`,
        amount: item.amount,
        when: item.dueDate,
      })),
    ...input.contracts
      .filter((item) => item.status === "original_recorded")
      .map((item) => ({
        id: `contract:${item.contractId}`,
        kind: "contract" as const,
        kindLabel: approvalKindLabels.contract,
        href: `/contracts/${item.contractId}`,
        title: item.title,
        detail: `${item.clientName} · 날인 원본 보관됨`,
        amount: item.totalAmount,
        when: "",
      })),
    ...input.proposals.map((item) => ({
      id: `proposal:${item.id}`,
      kind: "proposal" as const,
      kindLabel: approvalKindLabels.proposal,
      href: `/proposals/${item.id}`,
      title: shorten(item.body),
      detail: `${item.clientName} · ${item.projectName} · ${item.kindLabel}`,
      when: "",
    })),
    ...input.agentWorks.map((item) => ({
      id: `agent_work:${item.id}`,
      kind: "agent_work" as const,
      kindLabel: approvalKindLabels.agent_work,
      href: `/agents/${item.agentId}`,
      title: shorten(item.requestNote),
      detail: `${item.agentName} · 승인 대기`,
      when: item.createdAt.slice(0, 10),
    })),
  ];

  return items.sort((left, right) => {
    const byWhen = (left.when || "9999").localeCompare(right.when || "9999");
    if (byWhen !== 0) return byWhen;
    return (kindOrder.get(left.kind) ?? 0) - (kindOrder.get(right.kind) ?? 0);
  });
}

export function summarizeApprovals(items: ApprovalInboxItem[]) {
  const byKind = Object.fromEntries(approvalKinds.map((kind) => [kind, 0])) as Record<ApprovalKind, number>;
  for (const item of items) byKind[item.kind] += 1;
  return {
    total: items.length,
    byKind,
  };
}

/** 확정 직전에 대표가 보는 네 칸(F03-03). 값이 비어도 칸은 보여서 「없음」을 확인하게 한다. */
export type ApprovalReviewSummary = {
  subject: string;
  amountLabel: string;
  evidenceLabel: string;
  outcomeLabel: string;
};

export function buildApprovalReviewSummary(input: {
  subject: string;
  amount?: number | null;
  currency?: string;
  evidence?: string | null;
  outcomeLabel: string;
}): ApprovalReviewSummary {
  const subject = input.subject.trim() || "대상 없음";
  const amountLabel =
    typeof input.amount === "number" && Number.isFinite(input.amount)
      ? `${input.currency ?? "KRW"} · ${input.amount.toLocaleString("ko-KR")}원`
      : "금액 없음";
  const evidenceLabel = input.evidence?.trim() || "증빙 없음";
  const outcomeLabel = input.outcomeLabel.trim() || "결과 미정";
  return { subject, amountLabel, evidenceLabel, outcomeLabel };
}

export function approvalReviewIsComplete(summary: ApprovalReviewSummary): boolean {
  return Boolean(summary.subject && summary.amountLabel && summary.evidenceLabel && summary.outcomeLabel);
}

/** 승인 체크 없이 확정·이미 확정된 건 재확정을 막는다(F03-04). */
export function assertFounderConfirmationGate(input: {
  approved: boolean;
  status: string;
  confirmedStatus: string;
  alreadyConfirmedMessage: string;
}) {
  if (!input.approved) throw new Error("Representative approval is required");
  if (input.status === input.confirmedStatus) throw new Error(input.alreadyConfirmedMessage);
}
