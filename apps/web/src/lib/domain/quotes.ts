export const quoteVatModes = ["exclusive", "inclusive"] as const;
export type QuoteVatMode = (typeof quoteVatModes)[number];

export const quoteVatModeLabels: Record<QuoteVatMode, string> = {
  exclusive: "부가세 별도",
  inclusive: "부가세 포함",
};

/** 고객 PDF·화면에 나가는 항목. 내부 원가 필드는 넣지 않는다. */
export type QuoteCustomerItem = {
  title: string;
  customerDescription: string;
  quantity: number;
  unitPrice: number;
  amount: number;
};

/** 버전 JSON에 보관하는 작업 패키지(고객 항목 1:1). */
export type QuotePackage = {
  title: string;
  customerDescription: string;
  /** 고객 견적 금액. exclusive면 공급가, inclusive면 부가세 포함 금액. */
  amount: number;
  /** 고객 문서 수량. */
  quantity: number;
  role: string;
  monthlyRate: number;
  months: number;
  headcount: number;
  utilizationPercent: number;
  costAmount: number;
  /** true면 고객 금액을 수동으로 고친 상태. */
  amountLocked: boolean;
};

export type QuoteCostingSettings = {
  targetMarginPercent: number;
  operatingCostPercent: number;
};

export type QuoteCostingResult = {
  items: QuotePackage[];
  customerItems: QuoteCustomerItem[];
  costAmount: number;
  marginAmount: number;
  operatingCostAmount: number;
  subtotalAmount: number;
  vatAmount: number;
  totalAmount: number;
  vatMode: QuoteVatMode;
  targetMarginPercent: number;
  operatingCostPercent: number;
};

/** @deprecated 단순 항목 입력 호환용 */
export type QuoteItemInput = { description: string; amount: string };
export type QuoteItem = { description: string; amount: number };

export function normalizeQuoteVatMode(value: string | undefined): QuoteVatMode {
  const trimmed = value?.trim() || "exclusive";
  if (!(quoteVatModes as readonly string[]).includes(trimmed)) throw new Error("Unsupported VAT mode");
  return trimmed as QuoteVatMode;
}

function trimRequired(value: string, message: string, max: number, tooLong: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(message);
  if (trimmed.length > max) throw new Error(tooLong);
  return trimmed;
}

function asPositiveNumber(value: unknown, message: string) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(message);
  return number;
}

function asNonNegativeInteger(value: unknown, message: string) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(message);
  return number;
}

function clampPercent(value: number, max: number) {
  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new Error("Percent is out of range");
  }
  return Math.round(value);
}

export function calculatePackageCostAmount(input: {
  monthlyRate: number;
  months: number;
  headcount: number;
  utilizationPercent: number;
}) {
  const monthlyRate = asPositiveNumber(input.monthlyRate, "Monthly rate is required");
  const months = asPositiveNumber(input.months, "Months are required");
  const headcount = asPositiveNumber(input.headcount, "Headcount is required");
  const utilizationPercent = clampPercent(input.utilizationPercent, 100);
  if (utilizationPercent < 1) throw new Error("Utilization is required");
  return Math.round(monthlyRate * months * headcount * (utilizationPercent / 100));
}

/** 원가 → 운영비 가산 → 목표 마진을 반영한 고객 공급가(세전) 제안. */
export function suggestCustomerSupplyAmount(
  costAmount: number,
  targetMarginPercent: number,
  operatingCostPercent: number,
) {
  const cost = asNonNegativeInteger(costAmount, "Cost amount is invalid");
  const margin = clampPercent(targetMarginPercent, 90);
  const operating = clampPercent(operatingCostPercent, 50);
  if (margin >= 100) throw new Error("Margin percent is out of range");
  const withOperating = cost * (1 + operating / 100);
  return Math.max(0, Math.round(withOperating / (1 - margin / 100)));
}

/** 역할·등급별 월 단가(내부 원가용). 고객 PDF에는 나가지 않는다. */
export const quoteRoleRates = [
  { role: "주니어 개발", monthlyRate: 4_000_000 },
  { role: "미들 개발", monthlyRate: 5_000_000 },
  { role: "시니어 개발", monthlyRate: 6_000_000 },
  { role: "리드 개발", monthlyRate: 7_500_000 },
  { role: "주니어 디자인", monthlyRate: 3_500_000 },
  { role: "시니어 디자인", monthlyRate: 5_500_000 },
  { role: "기획", monthlyRate: 5_000_000 },
  { role: "PM", monthlyRate: 6_000_000 },
] as const;

export function monthlyRateForRole(role: string) {
  const matched = quoteRoleRates.find((item) => item.role === role);
  return matched?.monthlyRate;
}

export function createEmptyQuotePackage(): QuotePackage {
  const defaultRole = quoteRoleRates.find((item) => item.role === "시니어 개발") ?? quoteRoleRates[0];
  return {
    title: "",
    customerDescription: "",
    amount: 0,
    quantity: 1,
    role: defaultRole.role,
    monthlyRate: defaultRole.monthlyRate,
    months: 1,
    headcount: 1,
    utilizationPercent: 100,
    costAmount: 0,
    amountLocked: false,
  };
}

export function unitPriceFromAmount(amount: number, quantity: number) {
  const qty = quantity > 0 ? quantity : 1;
  return Math.round(amount / qty);
}

export function amountFromUnitPrice(unitPrice: number, quantity: number) {
  const qty = quantity > 0 ? quantity : 1;
  return Math.max(0, Math.round(unitPrice * qty));
}

export function defaultQuoteValidUntil(issuedOn: Date = new Date()) {
  const date = new Date(issuedOn);
  date.setDate(date.getDate() + 30);
  return date;
}

export function formatQuoteDocumentNumber(versionNumber: number, issuedOn: Date = new Date()) {
  const year = issuedOn.getFullYear();
  return `CL-${year}-${String(versionNumber).padStart(3, "0")}`;
}

export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateInputValue(value: string) {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) throw new Error("Date is invalid");
  const date = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Date is invalid");
  return date;
}

export function recalculateQuotePackage(
  packageInput: QuotePackage,
  settings: QuoteCostingSettings,
  vatMode: QuoteVatMode,
): QuotePackage {
  const costAmount = calculatePackageCostAmount(packageInput);
  const supply = suggestCustomerSupplyAmount(
    costAmount,
    settings.targetMarginPercent,
    settings.operatingCostPercent,
  );
  const suggestedAmount = vatMode === "inclusive" ? Math.round(supply * 1.1) : supply;
  return {
    ...packageInput,
    title: packageInput.title.trim(),
    customerDescription: packageInput.customerDescription.trim(),
    role: packageInput.role.trim(),
    quantity: packageInput.quantity > 0 ? packageInput.quantity : 1,
    costAmount,
    amount: packageInput.amountLocked && packageInput.amount > 0 ? packageInput.amount : suggestedAmount,
  };
}

export function normalizeQuoteCostingSettings(input: {
  targetMarginPercent?: unknown;
  operatingCostPercent?: unknown;
}): QuoteCostingSettings {
  return {
    targetMarginPercent: clampPercent(Number(input.targetMarginPercent ?? 30), 90),
    operatingCostPercent: clampPercent(Number(input.operatingCostPercent ?? 10), 50),
  };
}

export function calculateQuoteCosting(input: {
  packages: Array<Partial<QuotePackage> & { title?: string; amount?: number }>;
  vatMode?: string;
  targetMarginPercent?: unknown;
  operatingCostPercent?: unknown;
}): QuoteCostingResult {
  const vatMode = normalizeQuoteVatMode(input.vatMode);
  const settings = normalizeQuoteCostingSettings(input);
  if (!input.packages.length) throw new Error("At least one quote package is required");

  const items = input.packages.map((raw) => {
    const quantity = Number(raw.quantity ?? 1) > 0 ? Number(raw.quantity ?? 1) : 1;
    const base: QuotePackage = {
      title: String(raw.title ?? ""),
      customerDescription: String(raw.customerDescription ?? ""),
      amount: Number(raw.amount ?? 0),
      quantity,
      role: String(raw.role ?? ""),
      monthlyRate: Number(raw.monthlyRate ?? 0),
      months: Number(raw.months ?? 0),
      headcount: Number(raw.headcount ?? 0),
      utilizationPercent: Number(raw.utilizationPercent ?? 0),
      costAmount: Number(raw.costAmount ?? 0),
      amountLocked: Boolean(raw.amountLocked),
    };
    const calculated = recalculateQuotePackage(base, settings, vatMode);
    const title = trimRequired(calculated.title, "Package title is required", 120, "Package title is too long");
    const customerDescription = calculated.customerDescription.trim();
    if (customerDescription.length > 1000) throw new Error("Customer description is too long");
    if (!Number.isInteger(calculated.amount) || calculated.amount <= 0) {
      throw new Error("Customer amount must be a positive integer");
    }
    return {
      ...calculated,
      title,
      customerDescription,
      quantity: calculated.quantity,
      role: calculated.role.slice(0, 80),
    };
  });

  const costAmount = items.reduce((sum, item) => sum + item.costAmount, 0);
  const lineSum = items.reduce((sum, item) => sum + item.amount, 0);
  const operatingCostAmount = Math.round(costAmount * (settings.operatingCostPercent / 100));

  let subtotalAmount: number;
  let vatAmount: number;
  let totalAmount: number;
  if (vatMode === "inclusive") {
    totalAmount = lineSum;
    subtotalAmount = Math.round(totalAmount / 1.1);
    vatAmount = totalAmount - subtotalAmount;
  } else {
    subtotalAmount = lineSum;
    vatAmount = Math.round(subtotalAmount * 0.1);
    totalAmount = subtotalAmount + vatAmount;
  }

  const marginAmount = Math.max(0, subtotalAmount - costAmount - operatingCostAmount);

  return {
    items,
    customerItems: items.map((item) => ({
      title: item.title,
      customerDescription: item.customerDescription,
      quantity: item.quantity,
      unitPrice: unitPriceFromAmount(item.amount, item.quantity),
      amount: item.amount,
    })),
    costAmount,
    marginAmount,
    operatingCostAmount,
    subtotalAmount,
    vatAmount,
    totalAmount,
    vatMode,
    targetMarginPercent: settings.targetMarginPercent,
    operatingCostPercent: settings.operatingCostPercent,
  };
}

/** 저장된 JSON(구형 description 포함)을 고객 PDF 항목으로 정규화. */
export function normalizeStoredQuoteItemsForPdf(items: unknown): QuoteCustomerItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const title = String(record.title ?? record.description ?? "").trim();
    const customerDescription = String(record.customerDescription ?? "").trim();
    const amount = Number(record.amount ?? 0);
    const quantity = Number(record.quantity ?? 1) > 0 ? Number(record.quantity ?? 1) : 1;
    const unitPrice =
      Number(record.unitPrice ?? 0) > 0
        ? Math.round(Number(record.unitPrice))
        : unitPriceFromAmount(amount, quantity);
    return { title, customerDescription, quantity, unitPrice, amount };
  }).filter((item) => item.title && Number.isInteger(item.amount) && item.amount > 0);
}

/** 구형 단순 항목 입력 → 원가 없이 고객 금액만 있는 패키지로 저장. */
export function calculateQuoteAmounts(
  inputs: QuoteItemInput[],
  vatMode: QuoteVatMode = "exclusive",
): QuoteCostingResult {
  return calculateQuoteCosting({
    vatMode,
    targetMarginPercent: 0,
    operatingCostPercent: 0,
    packages: inputs.map((item) => ({
      title: item.description,
      customerDescription: "",
      amount: Number(item.amount),
      quantity: 1,
      role: "",
      monthlyRate: Number(item.amount) || 1,
      months: 1,
      headcount: 1,
      utilizationPercent: 100,
      amountLocked: true,
      costAmount: 0,
    })),
  });
}

export function nextQuoteVersionNumber(latestVersionNumber: number): number {
  return latestVersionNumber + 1;
}

export function parseQuotePackagesJson(value: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Quote packages JSON is invalid");
  }
  if (!Array.isArray(parsed)) throw new Error("Quote packages JSON is invalid");
  return parsed as Array<Partial<QuotePackage>>;
}

/** 저장된 버전 items(구형 description 포함)를 작성기용 패키지로 복원. */
export function packagesFromStoredItems(items: unknown): QuotePackage[] {
  if (!Array.isArray(items) || items.length === 0) return [createEmptyQuotePackage()];
  return items.map((raw) => {
    const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const amount = Number(record.amount ?? 0);
    const hasCostFields =
      Number(record.monthlyRate ?? 0) > 0 ||
      Number(record.months ?? 0) > 0 ||
      Number(record.headcount ?? 0) > 0;
    return {
      title: String(record.title ?? record.description ?? "").trim(),
      customerDescription: String(record.customerDescription ?? "").trim(),
      amount: Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0,
      quantity: Number(record.quantity ?? 1) > 0 ? Number(record.quantity ?? 1) : 1,
      role: String(record.role ?? "").trim(),
      monthlyRate: Number(record.monthlyRate ?? (hasCostFields ? 0 : Math.max(amount, 1))) || 6_000_000,
      months: Number(record.months ?? 1) || 1,
      headcount: Number(record.headcount ?? 1) || 1,
      utilizationPercent: Number(record.utilizationPercent ?? 100) || 100,
      costAmount: Number(record.costAmount ?? 0) || 0,
      amountLocked: record.amountLocked === true || !hasCostFields,
    };
  });
}
