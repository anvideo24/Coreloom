import { UNCLASSIFIED_LABEL, ventureKindLabels } from "@/lib/domain/revenue";

export const EXPENSE_CURRENCY = "KRW";
export const expenseEntryStatuses = ["scheduled", "confirmed"] as const;

export type ExpenseEntryStatus = (typeof expenseEntryStatuses)[number];

export const expenseEntryStatusLabels: Record<ExpenseEntryStatus, string> = {
  scheduled: "예정",
  confirmed: "확정",
};

export type ExpenseLedgerRow = {
  id: string;
  href: string;
  sourceLabel: string;
  title: string;
  counterparty: string;
  amount: number;
  currency: string;
  occurredOn: string;
  settlementDate: string;
  status: ExpenseEntryStatus;
  unclassified: boolean;
};

function parseAmount(amount: string) {
  const value = Number(amount);
  if (!Number.isInteger(value) || value <= 0) throw new Error("Expense amount must be a positive integer");
  return value;
}

function parseIsoDate(value: string, message: string) {
  const date = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(message);
  if (Number.isNaN(new Date(`${date}T00:00:00.000Z`).getTime())) throw new Error(message);
  return date;
}

export function normalizeExpenseEntry(input: {
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
  currency: typeof EXPENSE_CURRENCY;
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
    currency: EXPENSE_CURRENCY,
    occurredOn,
    settlementDate,
    note: input.note?.trim() || null,
  };
}

export function confirmExpenseEntry(input: { status: string; approved: boolean }) {
  if (!input.approved) throw new Error("Representative approval is required");
  if (input.status === "confirmed") throw new Error("Confirmed expenses cannot be changed");
  if (input.status !== "scheduled") throw new Error("Unsupported expense status");
  return { status: "confirmed" as const };
}

export function ledgerRowFromExpenseEntry(input: {
  id: string;
  ventureName: string | null;
  ventureKind: string | null;
  clientName: string | null;
  projectName: string | null;
  amount: number;
  currency: string;
  occurredOn: string;
  settlementDate: string;
  status: ExpenseEntryStatus;
}): ExpenseLedgerRow {
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
    id: input.id,
    href: `/expenses/${input.id}`,
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

export function sortExpenseRows(rows: ExpenseLedgerRow[]) {
  return [...rows].sort((left, right) => {
    const occurred = right.occurredOn.localeCompare(left.occurredOn);
    if (occurred !== 0) return occurred;
    return right.settlementDate.localeCompare(left.settlementDate);
  });
}

export function summarizeExpenses(rows: Array<{ status: string; amount: number; unclassified: boolean }>) {
  return {
    confirmedAmount: rows.filter((row) => row.status === "confirmed").reduce((sum, row) => sum + row.amount, 0),
    scheduledAmount: rows.filter((row) => row.status === "scheduled").reduce((sum, row) => sum + row.amount, 0),
    unclassifiedCount: rows.filter((row) => row.unclassified).length,
  };
}
