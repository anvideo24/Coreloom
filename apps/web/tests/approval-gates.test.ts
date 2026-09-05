import { describe, expect, it } from "vitest";

import {
  approvalReviewIsComplete,
  assertFounderConfirmationGate,
  buildApprovalInbox,
  buildApprovalReviewSummary,
  summarizeApprovals,
} from "@/lib/domain/approvals";
import { confirmBillingDeposit } from "@/lib/domain/billings";
import { executeContract } from "@/lib/domain/contracts";
import { confirmExpenseEntry } from "@/lib/domain/expenses";
import { confirmAiProposal } from "@/lib/domain/ai-proposals";
import { confirmRevenueEntry } from "@/lib/domain/revenue";

describe("approval review before confirm (F03-03)", () => {
  it("always exposes subject, amount, evidence, and outcome labels", () => {
    const withAmount = buildApprovalReviewSummary({
      subject: "광고비",
      amount: 1000,
      evidence: "지급 예정일 2026-09-10 · 메모 없음",
      outcomeLabel: "비용 확정 — 금액 고정",
    });
    expect(withAmount).toEqual({
      subject: "광고비",
      amountLabel: "KRW · 1,000원",
      evidenceLabel: "지급 예정일 2026-09-10 · 메모 없음",
      outcomeLabel: "비용 확정 — 금액 고정",
    });
    expect(approvalReviewIsComplete(withAmount)).toBe(true);

    const withoutAmount = buildApprovalReviewSummary({
      subject: "조사 요청",
      amount: null,
      evidence: null,
      outcomeLabel: "에이전트 작업 승인",
    });
    expect(withoutAmount.amountLabel).toBe("금액 없음");
    expect(withoutAmount.evidenceLabel).toBe("증빙 없음");
    expect(approvalReviewIsComplete(withoutAmount)).toBe(true);
  });

  it("keeps inbox rows linkable to a detail href with kind and title", () => {
    const items = buildApprovalInbox({
      expenses: [
        {
          id: "e1",
          title: "광고비",
          counterparty: "광고사",
          amount: 1000,
          settlementDate: "2026-09-10",
          status: "scheduled",
        },
      ],
      revenueEntries: [],
      billings: [],
      contracts: [],
      proposals: [],
      agentWorks: [],
    });
    expect(items[0]?.href).toMatch(/^\/expenses\//);
    expect(items[0]?.title).toBe("광고비");
    expect(typeof items[0]?.amount).toBe("number");
    expect(summarizeApprovals(items).total).toBe(1);
  });
});

describe("confirmation gate (F03-04)", () => {
  it("rejects confirmation without founder approval across money and contract actions", () => {
    expect(() => confirmExpenseEntry({ status: "scheduled", approved: false })).toThrow(
      "Representative approval is required",
    );
    expect(() => confirmRevenueEntry({ status: "scheduled", approved: false })).toThrow(
      "Representative approval is required",
    );
    expect(() => confirmBillingDeposit({ status: "scheduled", approved: false })).toThrow(
      "Representative approval is required",
    );
    expect(() =>
      executeContract({ status: "original_recorded", originalReference: "docs/a.pdf", approved: false }),
    ).toThrow("Representative approval is required");
    expect(() => confirmAiProposal({ status: "proposed", approved: false })).toThrow(
      "Representative approval is required",
    );
  });

  it("rejects a second confirmation after the record is already confirmed", () => {
    expect(() => confirmExpenseEntry({ status: "confirmed", approved: true })).toThrow(
      "Confirmed expenses cannot be changed",
    );
    expect(() => confirmRevenueEntry({ status: "confirmed", approved: true })).toThrow(
      "Confirmed revenue cannot be changed",
    );
    expect(() => confirmBillingDeposit({ status: "deposited", approved: true })).toThrow(
      "Deposited billings cannot be changed",
    );
  });

  it("assertFounderConfirmationGate mirrors the shared rule", () => {
    expect(() =>
      assertFounderConfirmationGate({
        approved: false,
        status: "scheduled",
        confirmedStatus: "confirmed",
        alreadyConfirmedMessage: "Already confirmed",
      }),
    ).toThrow("Representative approval is required");
    expect(() =>
      assertFounderConfirmationGate({
        approved: true,
        status: "confirmed",
        confirmedStatus: "confirmed",
        alreadyConfirmedMessage: "Already confirmed",
      }),
    ).toThrow("Already confirmed");
  });
});
