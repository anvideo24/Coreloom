export const BILLING_CURRENCY = "KRW";
export const billingKinds = ["down_payment", "interim", "final"] as const;
export const billingStatuses = ["scheduled", "deposited"] as const;

export type BillingKind = (typeof billingKinds)[number];
export type BillingStatus = (typeof billingStatuses)[number];

export const billingKindLabels: Record<BillingKind, string> = {
  down_payment: "착수금",
  interim: "중도금",
  final: "잔금",
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
}) {
  if (!billingKinds.includes(input.kind as BillingKind)) throw new Error("Unsupported billing kind");
  const billingDate = parseIsoDate(input.billingDate, "Billing date is required");
  const dueDate = parseIsoDate(input.dueDate, "Due date is required");
  if (dueDate < billingDate) throw new Error("Due date cannot be earlier than billing date");
  return {
    kind: input.kind as BillingKind,
    amount: parseAmount(input.amount),
    currency: BILLING_CURRENCY,
    billingDate,
    dueDate,
    note: input.note?.trim() || null,
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
