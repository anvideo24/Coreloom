export const ledgerAccountClasses = ["asset", "liability", "equity", "revenue", "expense"] as const;

export type LedgerAccountClass = (typeof ledgerAccountClasses)[number];

export const ledgerAccountClassLabels: Record<LedgerAccountClass, string> = {
  asset: "자산",
  liability: "부채",
  equity: "자본",
  revenue: "수익",
  expense: "비용",
};

/** 기존 원장 enum과 맞추는 선택 키. 새 과목은 비울 수 있다. */
export type LedgerCategoryKey =
  | "service"
  | "subscription"
  | "license"
  | "other"
  | "subcontract"
  | "software"
  | "travel"
  | "office"
  | "marketing";

export type LedgerAccountDraft = {
  code: string;
  name: string;
  accountClass: LedgerAccountClass;
  categoryKey: string | null;
};

/** 워크스페이스에 처음 둘 기본 과목. 분개·복식 전표는 포함하지 않는다. */
export const defaultLedgerAccounts: ReadonlyArray<LedgerAccountDraft> = [
  { code: "1100", name: "보통예금", accountClass: "asset", categoryKey: null },
  { code: "2100", name: "미지급금", accountClass: "liability", categoryKey: null },
  { code: "3100", name: "자본금", accountClass: "equity", categoryKey: null },
  { code: "4100", name: "용역 매출", accountClass: "revenue", categoryKey: "service" },
  { code: "4200", name: "구독 매출", accountClass: "revenue", categoryKey: "subscription" },
  { code: "4300", name: "라이선스", accountClass: "revenue", categoryKey: "license" },
  { code: "4900", name: "기타 매출", accountClass: "revenue", categoryKey: "other" },
  { code: "5100", name: "외주비", accountClass: "expense", categoryKey: "subcontract" },
  { code: "5200", name: "소프트웨어", accountClass: "expense", categoryKey: "software" },
  { code: "5300", name: "여비·교통", accountClass: "expense", categoryKey: "travel" },
  { code: "5400", name: "사무·비품", accountClass: "expense", categoryKey: "office" },
  { code: "5500", name: "마케팅", accountClass: "expense", categoryKey: "marketing" },
  { code: "5900", name: "기타 비용", accountClass: "expense", categoryKey: "other" },
];

export function normalizeLedgerAccountCode(value: string) {
  const code = value.trim();
  if (!code) throw new Error("Account code is required");
  if (code.length > 20) throw new Error("Account code is too long");
  if (!/^[A-Za-z0-9.-]+$/.test(code)) throw new Error("Account code is invalid");
  return code;
}

export function normalizeLedgerAccount(input: {
  code: string;
  name: string;
  accountClass: string;
  categoryKey?: string;
}): LedgerAccountDraft {
  const name = input.name.trim();
  if (!name) throw new Error("Account name is required");
  if (name.length > 120) throw new Error("Account name is too long");
  if (!ledgerAccountClasses.includes(input.accountClass as LedgerAccountClass)) {
    throw new Error("Unsupported ledger account class");
  }
  const categoryKey = input.categoryKey?.trim() || null;
  if (categoryKey && categoryKey.length > 40) throw new Error("Category key is too long");
  return {
    code: normalizeLedgerAccountCode(input.code),
    name,
    accountClass: input.accountClass as LedgerAccountClass,
    categoryKey,
  };
}

export function formatLedgerAccountLabel(account: { code: string; name: string }) {
  return `${account.code} · ${account.name}`;
}

export function formatLedgerAccountListMeta(account: {
  accountClass: LedgerAccountClass;
  categoryKey?: string | null;
}) {
  const parts = [ledgerAccountClassLabels[account.accountClass]];
  if (account.categoryKey) parts.push(`키 ${account.categoryKey}`);
  return parts.join(" · ");
}

export function ledgerAccountsForClass<T extends { accountClass: LedgerAccountClass }>(
  accounts: readonly T[],
  accountClass: LedgerAccountClass,
) {
  return accounts.filter((account) => account.accountClass === accountClass);
}

export function sortLedgerAccounts<T extends { code: string; accountClass: LedgerAccountClass }>(accounts: readonly T[]) {
  const classOrder = new Map(ledgerAccountClasses.map((value, index) => [value, index]));
  return [...accounts].sort((left, right) => {
    const byClass = (classOrder.get(left.accountClass) ?? 0) - (classOrder.get(right.accountClass) ?? 0);
    if (byClass !== 0) return byClass;
    return left.code.localeCompare(right.code, "en");
  });
}
