import { describe, expect, it } from "vitest";

import {
  confirmExpenseEntry,
  ledgerRowFromExpenseEntry,
  normalizeExpenseEntry,
  sortExpenseRows,
  summarizeExpenses,
} from "@/lib/domain/expenses";
import { UNCLASSIFIED_LABEL } from "@/lib/domain/revenue";

describe("expense entries", () => {
  it("keeps a venture-linked amount with occurred and payment dates", () => {
    expect(normalizeExpenseEntry({
      ventureId: "venture-1",
      amount: "22000",
      occurredOn: "2026-09-01",
      settlementDate: "2026-09-05",
      note: " 광고비 ",
      accountCategory: "marketing",
      supplierName: " 광고사 ",
      supplierClientCompanyId: "supplier-1",
    })).toEqual({
      projectId: null,
      ventureId: "venture-1",
      amount: 22000,
      currency: "KRW",
      occurredOn: "2026-09-01",
      settlementDate: "2026-09-05",
      note: "광고비",
      accountCategory: "marketing",
      supplierName: "광고사",
      supplierClientCompanyId: "supplier-1",
      ledgerAccountId: null,
    });
  });

  it("allows an unclassified expense without a project or venture", () => {
    expect(normalizeExpenseEntry({
      amount: "4000",
      occurredOn: "2026-09-02",
      settlementDate: "2026-09-02",
    })).toEqual({
      projectId: null,
      ventureId: null,
      amount: 4000,
      currency: "KRW",
      occurredOn: "2026-09-02",
      settlementDate: "2026-09-02",
      note: null,
      accountCategory: null,
      supplierName: null,
      supplierClientCompanyId: null,
      ledgerAccountId: null,
    });
  });

  it("uses supplier client name as counterparty when the free-text name is empty", () => {
    expect(
      ledgerRowFromExpenseEntry({
        id: "expense-s",
        ventureName: null,
        ventureKind: null,
        clientName: null,
        projectName: null,
        supplierName: null,
        supplierClientName: "오피스디포",
        amount: 5000,
        currency: "KRW",
        occurredOn: "2026-09-04",
        settlementDate: "2026-09-05",
        status: "scheduled",
      }),
    ).toMatchObject({
      counterparty: "오피스디포",
      title: "오피스디포",
    });
  });

  it("rejects both links, a non-positive amount, or a payment date before the occurred date", () => {
    expect(() => normalizeExpenseEntry({
      projectId: "project-1",
      ventureId: "venture-1",
      amount: "1000",
      occurredOn: "2026-09-01",
      settlementDate: "2026-09-02",
    })).toThrow("Link to a project or a venture, not both");
    expect(() => normalizeExpenseEntry({
      amount: "0",
      occurredOn: "2026-09-01",
      settlementDate: "2026-09-02",
    })).toThrow("Expense amount must be a positive integer");
    expect(() => normalizeExpenseEntry({
      amount: "1000",
      occurredOn: "2026-09-05",
      settlementDate: "2026-09-01",
    })).toThrow("Settlement date cannot be earlier than occurred date");
  });

  it("confirms scheduled expenses only with representative approval", () => {
    expect(confirmExpenseEntry({ status: "scheduled", approved: true })).toEqual({ status: "confirmed" });
    expect(() => confirmExpenseEntry({ status: "scheduled", approved: false })).toThrow("Representative approval is required");
    expect(() => confirmExpenseEntry({ status: "confirmed", approved: true })).toThrow("Confirmed expenses cannot be changed");
  });
});

describe("expense ledger", () => {
  it("marks an unlinked row as unclassified and sorts newest first", () => {
    const unclassified = ledgerRowFromExpenseEntry({
      id: "expense-1",
      ventureName: null,
      ventureKind: null,
      clientName: null,
      projectName: null,
      amount: 4000,
      currency: "KRW",
      occurredOn: "2026-09-04",
      settlementDate: "2026-09-10",
      status: "scheduled",
    });
    const venture = ledgerRowFromExpenseEntry({
      id: "expense-2",
      ventureName: "구독 서비스",
      ventureKind: "subscription",
      clientName: null,
      projectName: null,
      amount: 8000,
      currency: "KRW",
      occurredOn: "2026-09-01",
      settlementDate: "2026-09-03",
      status: "confirmed",
    });

    const project = ledgerRowFromExpenseEntry({
      id: "expense-3",
      ventureName: null,
      ventureKind: null,
      clientName: "고객A",
      projectName: "사이트",
      amount: 12000,
      currency: "KRW",
      occurredOn: "2026-09-03",
      settlementDate: "2026-09-08",
      status: "scheduled",
    });
    expect(unclassified).toMatchObject({
      href: "/expenses/expense-1",
      counterparty: UNCLASSIFIED_LABEL,
      unclassified: true,
    });
    expect(project).toMatchObject({
      sourceLabel: "고객사 프로젝트",
      counterparty: "고객A · 사이트",
      unclassified: false,
    });
    expect(sortExpenseRows([venture, unclassified]).map((row) => row.id)).toEqual(["expense-1", "expense-2"]);
    expect(summarizeExpenses([unclassified, venture])).toEqual({
      confirmedAmount: 8000,
      scheduledAmount: 4000,
      unclassifiedCount: 1,
    });
  });
});
