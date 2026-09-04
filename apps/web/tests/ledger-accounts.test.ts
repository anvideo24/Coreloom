import { describe, expect, it } from "vitest";

import {
  defaultLedgerAccounts,
  formatLedgerAccountLabel,
  formatLedgerAccountListMeta,
  ledgerAccountsForClass,
  normalizeLedgerAccount,
  sortLedgerAccounts,
} from "@/lib/domain/ledger-accounts";

describe("ledger accounts", () => {
  it("keeps a code, name, and class", () => {
    expect(
      normalizeLedgerAccount({
        code: " 5600 ",
        name: " 교육비 ",
        accountClass: "expense",
        categoryKey: " other ",
      }),
    ).toEqual({
      code: "5600",
      name: "교육비",
      accountClass: "expense",
      categoryKey: "other",
    });
  });

  it("rejects a blank code, unsupported class, or invalid characters", () => {
    expect(() => normalizeLedgerAccount({ code: " ", name: "교육비", accountClass: "expense" })).toThrow(
      "Account code is required",
    );
    expect(() => normalizeLedgerAccount({ code: "5600", name: "교육비", accountClass: "income" })).toThrow(
      "Unsupported ledger account class",
    );
    expect(() => normalizeLedgerAccount({ code: "56 00", name: "교육비", accountClass: "expense" })).toThrow(
      "Account code is invalid",
    );
  });

  it("seeds defaults covering all five classes and sorts by class then code", () => {
    const classes = new Set(defaultLedgerAccounts.map((account) => account.accountClass));
    expect([...classes].sort()).toEqual(["asset", "equity", "expense", "liability", "revenue"]);
    expect(ledgerAccountsForClass(defaultLedgerAccounts, "revenue").every((row) => row.accountClass === "revenue")).toBe(
      true,
    );
    expect(sortLedgerAccounts([{ code: "5900", accountClass: "expense" as const }, { code: "1100", accountClass: "asset" as const }]).map(
      (row) => row.code,
    )).toEqual(["1100", "5900"]);
    expect(formatLedgerAccountLabel({ code: "4100", name: "용역 매출" })).toBe("4100 · 용역 매출");
    expect(formatLedgerAccountListMeta({ accountClass: "revenue", categoryKey: "service" })).toBe("수익 · 키 service");
  });
});
