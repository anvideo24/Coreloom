import { describe, expect, it } from "vitest";

import {
  confirmRevenueEntry,
  ledgerRowFromBilling,
  ledgerRowFromRevenueEntry,
  normalizeRefund,
  normalizeRevenueEntry,
  normalizeVentureRegistration,
  sortLedgerRows,
  summarizeLedger,
  UNCLASSIFIED_LABEL,
} from "@/lib/domain/revenue";

describe("venture registration", () => {
  it("keeps an app or subscription venture name", () => {
    expect(normalizeVentureRegistration({ name: " 예시 앱 ", kind: "app" })).toEqual({ name: "예시 앱", kind: "app" });
  });

  it("rejects a missing name or unsupported kind", () => {
    expect(() => normalizeVentureRegistration({ name: " ", kind: "app" })).toThrow("Venture name is required");
    expect(() => normalizeVentureRegistration({ name: "예시 앱", kind: "course" })).toThrow("Unsupported venture kind");
  });
});

describe("revenue entries", () => {
  it("keeps a venture-linked amount with occurred and settlement dates", () => {
    expect(normalizeRevenueEntry({
      ventureId: "venture-1",
      amount: "15000",
      occurredOn: "2026-09-01",
      settlementDate: "2026-09-05",
      note: " 9월 정산 ",
      accountCategory: "subscription",
    })).toEqual({
      projectId: null,
      ventureId: "venture-1",
      amount: 15000,
      currency: "KRW",
      occurredOn: "2026-09-01",
      settlementDate: "2026-09-05",
      note: "9월 정산",
      accountCategory: "subscription",
      ledgerAccountId: null,
    });
  });

  it("allows an unclassified entry without a project or venture", () => {
    expect(normalizeRevenueEntry({
      amount: "3000",
      occurredOn: "2026-09-02",
      settlementDate: "2026-09-02",
    })).toEqual({
      projectId: null,
      ventureId: null,
      amount: 3000,
      currency: "KRW",
      occurredOn: "2026-09-02",
      settlementDate: "2026-09-02",
      note: null,
      accountCategory: null,
      ledgerAccountId: null,
    });
  });

  it("rejects both links, a non-positive amount, or a settlement before the occurred date", () => {
    expect(() => normalizeRevenueEntry({
      projectId: "project-1",
      ventureId: "venture-1",
      amount: "1000",
      occurredOn: "2026-09-01",
      settlementDate: "2026-09-02",
    })).toThrow("Link to a project or a venture, not both");
    expect(() => normalizeRevenueEntry({
      amount: "0",
      occurredOn: "2026-09-01",
      settlementDate: "2026-09-02",
    })).toThrow("Revenue amount must be a positive integer");
    expect(() => normalizeRevenueEntry({
      amount: "1000",
      occurredOn: "2026-09-05",
      settlementDate: "2026-09-01",
    })).toThrow("Settlement date cannot be earlier than occurred date");
  });

  it("confirms scheduled revenue only with representative approval", () => {
    expect(confirmRevenueEntry({ status: "scheduled", approved: true })).toEqual({ status: "confirmed" });
    expect(() => confirmRevenueEntry({ status: "scheduled", approved: false })).toThrow("Representative approval is required");
    expect(() => confirmRevenueEntry({ status: "confirmed", approved: true })).toThrow("Confirmed revenue cannot be changed");
  });
});

describe("revenue refunds", () => {
  const base = {
    amount: "3000",
    refundedOn: "2026-09-05",
    reason: " 고객 요청 ",
    originalAmount: 10000,
    existingRefundTotal: 0,
    status: "confirmed",
    approved: true,
  };

  it("registers a refund on a confirmed entry with representative approval", () => {
    expect(normalizeRefund(base)).toEqual({ amount: 3000, refundedOn: "2026-09-05", reason: "고객 요청" });
  });

  it("rejects without approval, on unconfirmed entries, or exceeding the original amount", () => {
    expect(() => normalizeRefund({ ...base, approved: false })).toThrow("Representative approval is required");
    expect(() => normalizeRefund({ ...base, status: "scheduled" })).toThrow("Only confirmed revenue can be refunded");
    expect(() => normalizeRefund({ ...base, amount: "11000" })).toThrow("Refund total cannot exceed the original amount");
    expect(() => normalizeRefund({ ...base, existingRefundTotal: 8000, amount: "3000" })).toThrow("Refund total cannot exceed the original amount");
  });

  it("rejects a missing reason or invalid date", () => {
    expect(() => normalizeRefund({ ...base, reason: " " })).toThrow("Refund reason is required");
    expect(() => normalizeRefund({ ...base, refundedOn: "09-05" })).toThrow("Refund date is required");
  });

  it("allows partial refunds that sum up to the original amount", () => {
    expect(normalizeRefund({ ...base, existingRefundTotal: 7000, amount: "3000" })).toEqual({
      amount: 3000,
      refundedOn: "2026-09-05",
      reason: "고객 요청",
    });
  });
});

describe("revenue ledger", () => {
  it("maps a deposited billing and an unclassified entry into one newest-first ledger", () => {
    const billing = ledgerRowFromBilling({
      id: "billing-1",
      kindLabel: "착수금",
      contractTitle: "사이트 구축",
      clientName: "예시 고객사",
      projectName: "브랜드 사이트",
      amount: 3000,
      currency: "KRW",
      billingDate: "2026-09-01",
      dueDate: "2026-09-03",
      status: "deposited",
    });
    const unclassified = ledgerRowFromRevenueEntry({
      id: "entry-1",
      ventureName: null,
      ventureKind: null,
      clientName: null,
      projectName: null,
      amount: 5000,
      currency: "KRW",
      occurredOn: "2026-09-04",
      settlementDate: "2026-09-10",
      status: "scheduled",
    });

    expect(billing).toMatchObject({
      href: "/billings/billing-1",
      source: "billing",
      status: "confirmed",
      unclassified: false,
    });
    expect(unclassified).toMatchObject({
      href: "/revenue/entry-1",
      counterparty: UNCLASSIFIED_LABEL,
      unclassified: true,
      status: "scheduled",
    });
    expect(sortLedgerRows([billing, unclassified]).map((row) => row.id)).toEqual(["revenue:entry-1", "billing:billing-1"]);
    expect(summarizeLedger([billing, unclassified])).toEqual({
      confirmedAmount: 3000,
      scheduledAmount: 5000,
      refundedAmount: 0,
      unclassifiedCount: 1,
    });
    expect(summarizeLedger([billing, unclassified], 1000)).toMatchObject({ refundedAmount: 1000 });
  });
});
