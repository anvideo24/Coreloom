export const REVENUE_CURRENCY = "KRW";
export const UNCLASSIFIED_LABEL = "미분류";

export const ventureKinds = ["app", "subscription"] as const;
export const revenueEntryStatuses = ["scheduled", "confirmed"] as const;
export const ledgerSources = ["billing", "revenue_entry"] as const;

export type VentureKind = (typeof ventureKinds)[number];
export type RevenueEntryStatus = (typeof revenueEntryStatuses)[number];
export type LedgerSource = (typeof ledgerSources)[number];

export const ventureKindLabels: Record<VentureKind, string> = {
  app: "앱",
  subscription: "구독",
};

export const revenueEntryStatusLabels: Record<RevenueEntryStatus, string> = {
  scheduled: "예정",
  confirmed: "확정",
};

export type RevenueLedgerRow = {
  id: string;
  href: string;
  source: LedgerSource;
  sourceLabel: string;
  title: string;
  counterparty: string;
  amount: number;
  currency: string;
  occurredOn: string;
  settlementDate: string;
  status: RevenueEntryStatus;
  unclassified: boolean;
};

function parseAmount(amount: string) {
  const value = Number(amount);
  if (!Number.isInteger(value) || value <= 0) throw new Error("Revenue amount must be a positive integer");
  return value;
}

function parseIsoDate(value: string, message: string) {
  const date = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(message);
  if (Number.isNaN(new Date(`${date}T00:00:00.000Z`).getTime())) throw new Error(message);
  return date;
}

export function normalizeVentureRegistration(input: { name: string; kind: string }) {
  const name = input.name.trim();
  if (!name) throw new Error("Venture name is required");
  if (name.length > 120) throw new Error("Venture name is too long");
  if (!ventureKinds.includes(input.kind as VentureKind)) throw new Error("Unsupported venture kind");
  return { name, kind: input.kind as VentureKind };
}

export function normalizeRevenueEntry(input: {
  projectId?: string;
  ventureId?: string;
  amount: string;
  occurredOn: string;
  settlementDate: string;
  note?: string;
}): {
  projectId: string | null;
  ventureId: string | null;
  amount: number;
  currency: typeof REVENUE_CURRENCY;
  occurredOn: string;
  settlementDate: string;
  note: string | null;
} {
  const projectId = input.projectId?.trim() || null;
  const ventureId = input.ventureId?.trim() || null;
  if (projectId && ventureId) throw new Error("Link to a project or a venture, not both");
  const occurredOn = parseIsoDate(input.occurredOn, "Occurred date is required");
  const settlementDate = parseIsoDate(input.settlementDate, "Settlement date is required");
  if (settlementDate < occurredOn) throw new Error("Settlement date cannot be earlier than occurred date");
  return {
    projectId,
    ventureId,
    amount: parseAmount(input.amount),
    currency: REVENUE_CURRENCY,
    occurredOn,
    settlementDate,
    note: input.note?.trim() || null,
  };
}

export function confirmRevenueEntry(input: { status: string; approved: boolean }) {
  if (!input.approved) throw new Error("Representative approval is required");
  if (input.status === "confirmed") throw new Error("Confirmed revenue cannot be changed");
  if (input.status !== "scheduled") throw new Error("Unsupported revenue status");
  return { status: "confirmed" as const };
}

export function ledgerRowFromBilling(input: {
  id: string;
  kindLabel: string;
  contractTitle: string;
  clientName: string;
  projectName: string | null;
  amount: number;
  currency: string;
  billingDate: string;
  dueDate: string;
  status: string;
}): RevenueLedgerRow {
  return {
    id: `billing:${input.id}`,
    href: `/billings/${input.id}`,
    source: "billing",
    sourceLabel: "고객사 프로젝트",
    title: input.contractTitle || input.kindLabel,
    counterparty: input.clientName,
    amount: input.amount,
    currency: input.currency,
    occurredOn: input.billingDate,
    settlementDate: input.dueDate,
    status: input.status === "deposited" ? "confirmed" : "scheduled",
    unclassified: false,
  };
}

export function ledgerRowFromRevenueEntry(input: {
  id: string;
  ventureName: string | null;
  ventureKind: string | null;
  clientName: string | null;
  projectName: string | null;
  amount: number;
  currency: string;
  occurredOn: string;
  settlementDate: string;
  status: RevenueEntryStatus;
}): RevenueLedgerRow {
  const unclassified = !input.ventureName && !input.clientName && !input.projectName;
  const sourceLabel = input.ventureKind === "app" || input.ventureKind === "subscription"
    ? ventureKindLabels[input.ventureKind]
    : unclassified
      ? UNCLASSIFIED_LABEL
      : "고객사 프로젝트";
  const counterparty = unclassified
    ? UNCLASSIFIED_LABEL
    : input.ventureName ?? (input.projectName ? `${input.clientName} · ${input.projectName}` : input.clientName ?? UNCLASSIFIED_LABEL);

  return {
    id: `revenue:${input.id}`,
    href: `/revenue/${input.id}`,
    source: "revenue_entry",
    sourceLabel,
    title: input.projectName ?? input.ventureName ?? UNCLASSIFIED_LABEL,
    counterparty,
    amount: input.amount,
    currency: input.currency,
    occurredOn: input.occurredOn,
    settlementDate: input.settlementDate,
    status: input.status,
    unclassified,
  };
}

export function sortLedgerRows(rows: RevenueLedgerRow[]) {
  return [...rows].sort((left, right) => {
    const occurred = right.occurredOn.localeCompare(left.occurredOn);
    if (occurred !== 0) return occurred;
    return right.settlementDate.localeCompare(left.settlementDate);
  });
}

export function summarizeLedger(rows: RevenueLedgerRow[]) {
  return {
    confirmedAmount: rows.filter((row) => row.status === "confirmed").reduce((sum, row) => sum + row.amount, 0),
    scheduledAmount: rows.filter((row) => row.status === "scheduled").reduce((sum, row) => sum + row.amount, 0),
    unclassifiedCount: rows.filter((row) => row.unclassified).length,
  };
}
