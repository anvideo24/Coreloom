import { describe, expect, it } from "vitest";

import {
  assertExecutedContractForBilling,
  billingPdfDownloadPath,
  calculateBillingInvoiceAmounts,
  confirmBillingDeposit,
  normalizeBillingDraft,
  normalizeRecurringSeriesDraft,
} from "@/lib/domain/billings";

describe("billing drafts", () => {
  it("keeps a down payment with currency, billing date, and due date", () => {
    expect(normalizeBillingDraft({
      kind: "down_payment",
      amount: "110000",
      billingDate: "2026-09-10",
      dueDate: "2026-09-20",
      note: " 착수금 ",
      billingNumber: " INV-001 ",
      poNumber: " PO-9 ",
    })).toEqual({
      kind: "down_payment",
      amount: 110000,
      currency: "KRW",
      billingDate: "2026-09-10",
      dueDate: "2026-09-20",
      note: "착수금",
      billingNumber: "INV-001",
      poNumber: "PO-9",
    });
  });

  it("rejects an invalid amount, kind, or due date before the billing date", () => {
    expect(() => normalizeBillingDraft({ kind: "down_payment", amount: "0", billingDate: "2026-09-10", dueDate: "2026-09-20" })).toThrow("Billing amount must be a positive integer");
    expect(() => normalizeBillingDraft({ kind: "subscription", amount: "1000", billingDate: "2026-09-10", dueDate: "2026-09-20" })).toThrow("Unsupported billing kind");
    expect(() => normalizeBillingDraft({ kind: "recurring", amount: "1000", billingDate: "2026-09-10", dueDate: "2026-09-20" })).toThrow("Unsupported billing kind");
    expect(() => normalizeBillingDraft({ kind: "final", amount: "1000", billingDate: "2026-09-20", dueDate: "2026-09-10" })).toThrow("Due date cannot be earlier than billing date");
  });
});

describe("billing deposits", () => {
  it("requires representative approval on a scheduled billing", () => {
    expect(confirmBillingDeposit({ status: "scheduled", approved: true })).toEqual({ status: "deposited" });
    expect(() => confirmBillingDeposit({ status: "scheduled", approved: false })).toThrow("Representative approval is required");
    expect(() => confirmBillingDeposit({ status: "deposited", approved: true })).toThrow("Deposited billings cannot be changed");
  });

  it("allows billing only after a contract is executed", () => {
    expect(() => assertExecutedContractForBilling("draft")).toThrow("Only an executed contract can be billed");
    expect(() => assertExecutedContractForBilling("executed")).not.toThrow();
  });
});

describe("billing invoices", () => {
  it("keeps supply amount VAT-exclusive like quotes", () => {
    expect(calculateBillingInvoiceAmounts(3000)).toEqual({
      subtotalAmount: 3000,
      vatAmount: 300,
      totalAmount: 3300,
    });
    expect(() => calculateBillingInvoiceAmounts(0)).toThrow("Billing amount must be a positive integer");
  });

  it("builds a founder-only PDF download path", () => {
    expect(billingPdfDownloadPath("billing-1")).toBe("/billings/billing-1/download");
  });
});

describe("recurring billing series", () => {
  it("builds monthly occurrences from start to end with a due-date offset", () => {
    const draft = normalizeRecurringSeriesDraft({
      amount: "3000000",
      startDate: "2026-09-01",
      endDate: "2027-08-01",
      dueOffsetDays: "10",
      note: " 월 유지보수 ",
      approved: true,
    });
    expect(draft.interval).toBe("monthly");
    expect(draft.occurrences).toHaveLength(12);
    expect(draft.occurrences[0]).toEqual({
      kind: "recurring",
      amount: 3000000,
      currency: "KRW",
      billingDate: "2026-09-01",
      dueDate: "2026-09-11",
      note: "월 유지보수",
    });
    expect(draft.occurrences.at(-1)).toMatchObject({
      billingDate: "2027-08-01",
      dueDate: "2027-08-11",
    });
  });

  it("clamps month-end dates and rejects an unapproved or oversized series", () => {
    expect(normalizeRecurringSeriesDraft({
      amount: "1000",
      startDate: "2026-01-31",
      endDate: "2026-03-31",
      dueOffsetDays: "0",
      approved: true,
    }).occurrences.map((item) => item.billingDate)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(normalizeRecurringSeriesDraft({
      amount: "1000",
      startDate: "2024-01-31",
      endDate: "2024-03-31",
      dueOffsetDays: "0",
      approved: true,
    }).occurrences.map((item) => item.billingDate)).toEqual(["2024-01-31", "2024-02-29", "2024-03-31"]);
    expect(() => normalizeRecurringSeriesDraft({
      amount: "1000",
      startDate: "2026-01-01",
      endDate: "2026-12-01",
      dueOffsetDays: "0",
      approved: false,
    })).toThrow("Representative approval is required");
    expect(() => normalizeRecurringSeriesDraft({
      amount: "1000",
      startDate: "2026-01-01",
      endDate: "2028-01-01",
      dueOffsetDays: "0",
      approved: true,
    })).toThrow("Recurring series cannot exceed 24 months");
    expect(() => normalizeRecurringSeriesDraft({
      amount: "1000",
      startDate: "2026-09-01",
      endDate: "2026-08-01",
      dueOffsetDays: "0",
      approved: true,
    })).toThrow("End date cannot be earlier than start date");
  });
});
