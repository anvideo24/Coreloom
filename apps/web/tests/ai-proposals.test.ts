import { describe, expect, it } from "vitest";

import {
  aiProposalKinds,
  confirmAiProposal,
  isOfficialDecision,
  normalizeAiProposalDraft,
  partitionAiProposals,
  rejectAiProposal,
} from "@/lib/domain/ai-proposals";

describe("ai proposal drafts", () => {
  it("keeps an evidence-linked proposal kind and body", () => {
    expect(normalizeAiProposalDraft({
      evidenceId: "evidence-1",
      kind: "agreement",
      body: " 착수일을 다음 주 월요일로 본다 ",
    })).toEqual({
      evidenceId: "evidence-1",
      kind: "agreement",
      body: "착수일을 다음 주 월요일로 본다",
    });
  });

  it("rejects a missing evidence, unsupported kind, or empty body", () => {
    expect(() => normalizeAiProposalDraft({ evidenceId: " ", kind: "risk", body: "일정 지연" })).toThrow("Evidence is required");
    expect(() => normalizeAiProposalDraft({ evidenceId: "evidence-1", kind: "summary", body: "일정 지연" })).toThrow("Unsupported proposal kind");
    expect(() => normalizeAiProposalDraft({ evidenceId: "evidence-1", kind: "risk", body: " " })).toThrow("Proposal body is required");
  });

  it("exposes only agreement, next action, and risk kinds", () => {
    expect(aiProposalKinds).toEqual(["agreement", "next_action", "risk"]);
  });
});

describe("ai proposal decisions", () => {
  it("confirms a proposed item only with representative approval", () => {
    expect(confirmAiProposal({ status: "proposed", approved: true })).toEqual({ status: "confirmed" });
    expect(() => confirmAiProposal({ status: "proposed", approved: false })).toThrow("Representative approval is required");
    expect(() => confirmAiProposal({ status: "confirmed", approved: true })).toThrow("Decided proposals cannot be changed");
    expect(() => confirmAiProposal({ status: "rejected", approved: true })).toThrow("Decided proposals cannot be changed");
  });

  it("rejects a proposed item with a reason and approval", () => {
    expect(rejectAiProposal({ status: "proposed", approved: true, reason: " 원문과 다름 " })).toEqual({
      status: "rejected",
      decisionReason: "원문과 다름",
    });
    expect(() => rejectAiProposal({ status: "proposed", approved: true, reason: " " })).toThrow("Rejection reason is required");
    expect(() => rejectAiProposal({ status: "proposed", approved: false, reason: "원문과 다름" })).toThrow("Representative approval is required");
    expect(() => rejectAiProposal({ status: "confirmed", approved: true, reason: "원문과 다름" })).toThrow("Decided proposals cannot be changed");
  });

  it("treats only confirmed proposals as official decisions", () => {
    expect(isOfficialDecision("confirmed")).toBe(true);
    expect(isOfficialDecision("proposed")).toBe(false);
    expect(isOfficialDecision("rejected")).toBe(false);
  });
});

describe("ai proposal lists", () => {
  it("splits pending proposals from decided history", () => {
    expect(partitionAiProposals([
      { status: "confirmed", body: "확정됨" },
      { status: "proposed", body: "대기" },
      { status: "rejected", body: "반려됨" },
    ])).toEqual({
      pending: [{ status: "proposed", body: "대기" }],
      decided: [
        { status: "confirmed", body: "확정됨" },
        { status: "rejected", body: "반려됨" },
      ],
    });
  });
});
