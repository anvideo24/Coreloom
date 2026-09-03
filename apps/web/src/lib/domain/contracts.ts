export const contractStatuses = ["draft", "original_recorded", "executed"] as const;
export const contractExecutionMethods = ["stamped_original"] as const;
export const CONTRACT_CURRENCY = "KRW";

export type ContractStatus = (typeof contractStatuses)[number];
export type ContractExecutionMethod = (typeof contractExecutionMethods)[number];

export const contractStatusLabels: Record<ContractStatus, string> = {
  draft: "초안",
  original_recorded: "날인 원본 보관",
  executed: "체결",
};

export function nextContractVersionNumber(latestVersionNumber: number): number {
  return latestVersionNumber + 1;
}

export function normalizeStampedOriginal(input: { originalReference: string }) {
  const originalReference = input.originalReference.trim();
  if (!originalReference) throw new Error("Stamped original reference is required");
  return { originalReference };
}

export function recordContractOriginal(input: { status: string; originalReference: string }) {
  if (input.status === "executed") throw new Error("Executed contracts cannot be changed");
  if (input.status !== "draft" && input.status !== "original_recorded") {
    throw new Error("Unsupported contract status");
  }
  return {
    status: "original_recorded" as const,
    ...normalizeStampedOriginal(input),
  };
}

export function executeContract(input: { status: string; originalReference: string | null; approved: boolean }) {
  if (!input.approved) throw new Error("Representative approval is required");
  if (input.status === "executed") throw new Error("Executed contracts cannot be changed");
  if (input.status !== "original_recorded" || !input.originalReference?.trim()) {
    throw new Error("Stamped original is required before execution");
  }
  return { status: "executed" as const };
}

export function assertContractAmendmentSource(status: string) {
  if (status !== "executed") throw new Error("Only an executed contract can start an amendment");
}
