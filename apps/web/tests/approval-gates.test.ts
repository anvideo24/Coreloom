import { describe, expect, it } from "vitest";

import {
  approvalReviewIsComplete,
  assertFounderConfirmationGate,
  buildApprovalInbox,
  buildApprovalReviewSummary,
  summarizeApprovals,
} from "@/lib/domain/approvals";
import { billingKindLabels, confirmBillingDeposit } from "@/lib/domain/billings";
import { executeContract } from "@/lib/domain/contracts";
import { confirmExpenseEntry, ledgerRowFromExpenseEntry } from "@/lib/domain/expenses";
import { confirmAiProposal } from "@/lib/domain/ai-proposals";
import { rechoEvidenceKindLabels } from "@/lib/domain/recho-evidence";
import { confirmRevenueEntry, ledgerRowFromRevenueEntry } from "@/lib/domain/revenue";

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

/**
 * F03-03 — docs/quality/approval-review-cases.md의 5사례를 그대로 fixture로 만들어
 * 각 화면이 실제로 만드는 리뷰 요약(대상·금액·증빙·결과)을 재구성하고 대조한다.
 * "라벨이 있다"가 아니라 "그 사례의 실제 값이 맞게 나온다"를 잰다.
 */
describe("F03-03: 5 fixed answer cases from docs/quality/approval-review-cases.md", () => {
  it("사례 1 — 비용 확정(expense): 정상 증빙이 있으면 그대로 드러난다", () => {
    const entry = {
      id: "exp-1",
      ventureName: null,
      ventureKind: null,
      clientName: null,
      projectName: null,
      supplierName: "가상 광고사 A",
      accountCategory: "marketing",
      amount: 1_200_000,
      currency: "KRW",
      occurredOn: "2026-08-20",
      settlementDate: "2026-09-10",
      status: "scheduled" as const,
      note: "세금계산서 수령 완료, 발주서 첨부 확인함",
    };
    const row = ledgerRowFromExpenseEntry(entry);
    const review = buildApprovalReviewSummary({
      subject: `${row.title} · ${row.counterparty}`,
      amount: entry.amount,
      currency: entry.currency,
      evidence: entry.note?.trim() || null,
      outcomeLabel: "비용 확정 — 금액 고정, 자동 이체·세금계산서 없음",
    });

    expect(review.subject).toContain("가상 광고사 A");
    expect(review.amountLabel).toBe("KRW · 1,200,000원");
    expect(review.evidenceLabel).toBe("세금계산서 수령 완료, 발주서 첨부 확인함");
    expect(review.evidenceLabel).not.toBe("증빙 없음");
    expect(review.outcomeLabel).toBe("비용 확정 — 금액 고정, 자동 이체·세금계산서 없음");
    expect(approvalReviewIsComplete(review)).toBe(true);
  });

  it("사례 2 — 매출 확정(revenue): 화면 금액과 증빙에 적힌 계약 금액이 다르면 대조로 드러나야 한다", () => {
    const entry = {
      id: "rev-2",
      ventureName: null,
      ventureKind: null,
      clientName: "가상 고객사 B",
      projectName: "가상 프로젝트 베타",
      accountCategory: "service",
      amount: 3_300_000,
      currency: "KRW",
      occurredOn: "2026-08-25",
      settlementDate: "2026-09-15",
      status: "scheduled" as const,
      note: "견적서 v2 기준 계약 금액 3,000,000원(부가세 별도)",
    };
    const row = ledgerRowFromRevenueEntry(entry);
    const review = buildApprovalReviewSummary({
      subject: `${row.title} · ${row.counterparty}`,
      amount: entry.amount,
      currency: entry.currency,
      evidence: entry.note?.trim() || null,
      outcomeLabel: "매출 확정 — 금액 고정, 세금계산서 발행 없음",
    });

    // 정답: 반려. 화면 금액(3,300,000)과 증빙에 적힌 계약 금액(3,000,000)이 서로 다르다.
    // 시험이 "실제 값"을 재는지 확인 — 두 금액이 서로 다른 문자열로 각각 드러나야 한다.
    expect(review.amountLabel).toBe("KRW · 3,300,000원");
    expect(review.evidenceLabel).toContain("3,000,000원");
    expect(review.amountLabel).not.toContain("3,000,000원");
    expect(approvalReviewIsComplete(review)).toBe(true);
  });

  it("사례 3 — 입금 확인(billing): 진짜 증빙이 없으면 예정일로 채워지지 않고 '증빙 없음'이 뜬다", () => {
    const billing = {
      clientName: "가상 고객사 C",
      contractTitle: "가상 계약 감마",
      kind: "interim" as const,
      amount: 5_000_000,
      currency: "KRW",
      billingDate: "2026-08-01",
      dueDate: "2026-09-01",
      note: null as string | null,
      billingNumber: null as string | null,
    };
    const review = buildApprovalReviewSummary({
      subject: `${billing.clientName} · ${billing.contractTitle} · ${billingKindLabels[billing.kind]}`,
      amount: billing.amount,
      currency: billing.currency,
      evidence:
        [billing.note?.trim() || null, billing.billingNumber ? `청구번호 ${billing.billingNumber}` : null]
          .filter(Boolean)
          .join(" · ") || null,
      outcomeLabel: "입금 확정 — 금액 고정, 세금계산서 발행 없음",
    });

    // 정답: 반려(보류). 예정일이 지났어도 그것은 증빙이 아니다.
    // 이전에는 evidence 배열에 dueDate가 섞여 들어가 이 분기가 절대 뜨지 않았다(정정됨).
    expect(review.evidenceLabel).toBe("증빙 없음");
    expect(review.evidenceLabel).not.toContain(billing.dueDate);
    expect(review.amountLabel).toBe("KRW · 5,000,000원");
    expect(approvalReviewIsComplete(review)).toBe(true);
  });

  it("사례 4 — 계약 체결(contract): 이미 체결된 건은 재확정을 막고, 정보는 여전히 확인 가능하다", () => {
    const latest = {
      title: "가상 계약 델타",
      clientName: "가상 고객사 D",
      totalAmount: 8_000_000,
      currency: "KRW",
      originalReference: "회사 문서함/계약/가상고객사D-날인본.pdf",
      status: "executed" as const,
    };
    const review = buildApprovalReviewSummary({
      subject: `${latest.title} · ${latest.clientName}`,
      amount: latest.totalAmount,
      currency: latest.currency,
      evidence: latest.originalReference?.trim()
        ? `날인 원본 위치: ${latest.originalReference}`
        : "날인 원본 위치 없음",
      outcomeLabel: "이미 최종 계약으로 체결됨 — 재확정 불가",
    });

    // 대상·금액·증빙은 여전히 확인 가능해야 한다(F03-03).
    expect(review.subject).toContain("가상 계약 델타");
    expect(review.amountLabel).toBe("KRW · 8,000,000원");
    expect(review.evidenceLabel).toContain("가상고객사D-날인본.pdf");
    expect(review.outcomeLabel).toBe("이미 최종 계약으로 체결됨 — 재확정 불가");
    // 정답: 반려. 중복 확정 시도는 코드가 직접 막는다(F03-04와 연결).
    expect(() =>
      executeContract({ status: latest.status, originalReference: latest.originalReference, approved: true }),
    ).toThrow("Executed contracts cannot be changed");
  });

  it("사례 5 — AI 제안(proposal): 제안 대상과 근거 기록의 대상이 다르면 요약에서 함께 드러나야 한다", () => {
    const proposal = {
      clientName: "가상 고객사 E",
      projectName: "가상 프로젝트 제타",
      body: "다음 할 일: 가상 고객사 E에 v2 견적서를 이번 주 금요일까지 발송",
      evidenceKind: "call" as const,
      evidenceTitle: "가상 고객사 F 정기 통화",
      occurredOn: "2026-09-02",
      occurredTime: "14:00",
      originalUrl: null as string | null,
    };
    const review = buildApprovalReviewSummary({
      subject: `${proposal.clientName} · ${proposal.projectName}`,
      amount: null,
      evidence: `${rechoEvidenceKindLabels[proposal.evidenceKind]} · ${proposal.occurredOn} ${proposal.occurredTime} · ${proposal.evidenceTitle}${proposal.originalUrl ? "" : " (원문 링크 없음)"}`,
      outcomeLabel: "제안 확정 — 공식 결정으로 남음",
    });

    // 정답: 반려. 대상 고객사(E)와 근거 기록 제목(F)이 서로 다른 고객사를 가리킨다.
    expect(review.subject).toContain("가상 고객사 E");
    expect(review.evidenceLabel).toContain("가상 고객사 F");
    expect(review.subject).not.toContain("가상 고객사 F");
    expect(review.amountLabel).toBe("금액 없음");
    expect(review.evidenceLabel).toContain("원문 링크 없음");
    expect(approvalReviewIsComplete(review)).toBe(true);
    // 현재 /proposals/[proposalId] 화면은 이 요약을 만들지 않는다(Task C에 기록).
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
