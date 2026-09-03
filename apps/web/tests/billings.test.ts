import { describe, expect, it } from "vitest";

import {
  assertExecutedContractForBilling,
  confirmBillingDeposit,
  normalizeBillingDraft,
} from "@/lib/domain/billings";

describe("billing drafts", () => {
  it("keeps a down payment with currency, billing date, and due date", () => {
    expect(normalizeBillingDraft({
      kind: "down_payment",
      amount: "110000",
      billingDate: "2026-09-10",
      dueDate: "2026-09-20",
      note: " 착수금 ",
    })).toEqual({
      kind: "down_payment",
      amount: 110000,
      currency: "KRW",
      billingDate: "2026-09-10",
      dueDate: "2026-09-20",
      note: "착수금",
    });
  });

  it("rejects an invalid amount, kind, or due date before the billing date", () => {
    expect(() => normalizeBillingDraft({ kind: "down_payment", amount: "0", billingDate: "2026-09-10", dueDate: "2026-09-20" })).toThrow("Billing amount must be a positive integer");
    expect(() => normalizeBillingDraft({ kind: "subscription", amount: "1000", billingDate: "2026-09-10", dueDate: "2026-09-20" })).toThrow("Unsupported billing kind");
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
