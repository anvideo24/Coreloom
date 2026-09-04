export const BILLING_CURRENCY = "KRW";
export const billingKinds = ["down_payment", "interim", "final"] as const;
export const recurringBillingKind = "recurring" as const;
export const allBillingKinds = [...billingKinds, recurringBillingKind] as const;
export const billingStatuses = ["scheduled", "deposited"] as const;
export const RECURRING_INTERVAL = "monthly" as const;
export const MAX_RECURRING_OCCURRENCES = 24;

export type BillingKind = (typeof allBillingKinds)[number];
export type BillingStatus = (typeof billingStatuses)[number];
export type RecurringInterval = typeof RECURRING_INTERVAL;

export const billingKindLabels: Record<BillingKind, string> = {
  down_payment: "착수금",
  interim: "중도금",
  final: "잔금",
  recurring: "반복 청구",
};

export const billingStatusLabels: Record<BillingStatus, string> = {
  scheduled: "예정",
  deposited: "입금 확인",
};

function parseAmount(amount: string) {
  const value = Number(amount);
  if (!Number.isInteger(value) || value <= 0) throw new Error("Billing amount must be a positive integer");
  return value;
}

function parseIsoDate(value: string, message: string) {
  const date = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(message);
  if (Number.isNaN(new Date(`${date}T00:00:00.000Z`).getTime())) throw new Error(message);
  return date;
}

export function normalizeBillingDraft(input: {
  kind: string;
  amount: string;
  billingDate: string;
  dueDate: string;
  note?: string;
  billingNumber?: string;
  poNumber?: string;
}) {
  if (!billingKinds.includes(input.kind as (typeof billingKinds)[number])) throw new Error("Unsupported billing kind");
  const billingDate = parseIsoDate(input.billingDate, "Billing date is required");
  const dueDate = parseIsoDate(input.dueDate, "Due date is required");
  if (dueDate < billingDate) throw new Error("Due date cannot be earlier than billing date");
  const billingNumber = input.billingNumber?.trim() || null;
  const poNumber = input.poNumber?.trim() || null;
  if (billingNumber && billingNumber.length > 80) throw new Error("Billing number is too long");
  if (poNumber && poNumber.length > 80) throw new Error("PO number is too long");
  return {
    kind: input.kind as (typeof billingKinds)[number],
    amount: parseAmount(input.amount),
    currency: BILLING_CURRENCY,
    billingDate,
    dueDate,
    note: input.note?.trim() || null,
    billingNumber,
    poNumber,
  };
}

export function assertExecutedContractForBilling(status: string) {
  if (status !== "executed") throw new Error("Only an executed contract can be billed");
}

export function confirmBillingDeposit(input: { status: string; approved: boolean }) {
  if (!input.approved) throw new Error("Representative approval is required");
  if (input.status === "deposited") throw new Error("Deposited billings cannot be changed");
  if (input.status !== "scheduled") throw new Error("Unsupported billing status");
  return { status: "deposited" as const };
}

export function calculateBillingInvoiceAmounts(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("Billing amount must be a positive integer");
  const vatAmount = Math.round(amount * 0.1);
  return { subtotalAmount: amount, vatAmount, totalAmount: amount + vatAmount };
}

export function billingPdfDownloadPath(billingId: string) {
  return `/billings/${billingId}/download`;
}

function formatIsoDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function addCalendarMonths(isoDate: string, months: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0)).getUTCDate();
  return formatIsoDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, Math.min(day, lastDay));
}

export function addCalendarDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function buildMonthlyBillingDates(startDate: string, endDate: string) {
  const dates: string[] = [];
  let monthOffset = 0;
  while (true) {
    const current = addCalendarMonths(startDate, monthOffset);
    if (current > endDate) break;
    dates.push(current);
    if (dates.length > MAX_RECURRING_OCCURRENCES) throw new Error("Recurring series cannot exceed 24 months");
    monthOffset += 1;
    if (monthOffset > MAX_RECURRING_OCCURRENCES + 1) throw new Error("Recurring series cannot exceed 24 months");
  }
  if (dates.length === 0) throw new Error("Recurring series needs at least one billing date");
  return dates;
}

export function normalizeRecurringSeriesDraft(input: {
  amount: string;
  startDate: string;
  endDate: string;
  dueOffsetDays: string;
  note?: string;
  approved: boolean;
}) {
  if (!input.approved) throw new Error("Representative approval is required");
  const startDate = parseIsoDate(input.startDate, "Start date is required");
  const endDate = parseIsoDate(input.endDate, "End date is required");
  if (endDate < startDate) throw new Error("End date cannot be earlier than start date");
  const dueOffsetRaw = input.dueOffsetDays.trim();
  if (!/^\d+$/.test(dueOffsetRaw)) throw new Error("Due offset days must be a whole number");
  const dueOffsetDays = Number(dueOffsetRaw);
  if (dueOffsetDays > 31) throw new Error("Due offset days cannot exceed 31");
  const amount = parseAmount(input.amount);
  const note = input.note?.trim() || null;
  const billingDates = buildMonthlyBillingDates(startDate, endDate);
  return {
    amount,
    currency: BILLING_CURRENCY,
    interval: RECURRING_INTERVAL,
    startDate,
    endDate,
    dueOffsetDays,
    note,
    occurrences: billingDates.map((billingDate) => ({
      kind: recurringBillingKind,
      amount,
      currency: BILLING_CURRENCY,
      billingDate,
      dueDate: addCalendarDays(billingDate, dueOffsetDays),
      note,
    })),
  };
}
