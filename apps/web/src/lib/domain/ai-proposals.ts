export const aiProposalKinds = ["agreement", "next_action", "risk"] as const;
export const aiProposalStatuses = ["proposed", "confirmed", "rejected"] as const;

export type AiProposalKind = (typeof aiProposalKinds)[number];
export type AiProposalStatus = (typeof aiProposalStatuses)[number];

export const aiProposalKindLabels: Record<AiProposalKind, string> = {
  agreement: "현재 합의",
  next_action: "다음 할 일",
  risk: "위험",
};

export const aiProposalStatusLabels: Record<AiProposalStatus, string> = {
  proposed: "제안 (미확정)",
  confirmed: "확정",
  rejected: "반려",
};

export function isOfficialDecision(status: string) {
  return status === "confirmed";
}

export function normalizeAiProposalDraft(input: {
  evidenceId: string;
  kind: string;
  body: string;
}): { evidenceId: string; kind: AiProposalKind; body: string } {
  const evidenceId = input.evidenceId.trim();
  const body = input.body.trim();

  if (!evidenceId) throw new Error("Evidence is required");
  if (!aiProposalKinds.includes(input.kind as AiProposalKind)) throw new Error("Unsupported proposal kind");
  if (!body) throw new Error("Proposal body is required");
  if (body.length > 2000) throw new Error("Proposal body is too long");

  return { evidenceId, kind: input.kind as AiProposalKind, body };
}

export function confirmAiProposal(input: { status: string; approved: boolean }) {
  if (!input.approved) throw new Error("Representative approval is required");
  if (input.status !== "proposed") throw new Error("Decided proposals cannot be changed");
  return { status: "confirmed" as const };
}

export function rejectAiProposal(input: { status: string; approved: boolean; reason: string }) {
  if (!input.approved) throw new Error("Representative approval is required");
  if (input.status !== "proposed") throw new Error("Decided proposals cannot be changed");
  const decisionReason = input.reason.trim();
  if (!decisionReason) throw new Error("Rejection reason is required");
  if (decisionReason.length > 500) throw new Error("Rejection reason is too long");
  return { status: "rejected" as const, decisionReason };
}

export function partitionAiProposals<T extends { status: string }>(proposals: T[]) {
  return {
    pending: proposals.filter((item) => item.status === "proposed"),
    decided: proposals.filter((item) => item.status !== "proposed"),
  };
}
