export const aiAgentAllowedWorkKinds = ["research", "draft", "task_update", "approval_request"] as const;
export const aiAgentForbiddenWorkKinds = [
  "expense_confirm",
  "contract_execute",
  "revenue_confirm",
  "refund",
  "permission_change",
  "public_publish",
] as const;
export const aiAgentStatuses = ["active", "inactive"] as const;
export const aiAgentWorkLogStatuses = ["pending", "approved", "rejected"] as const;
export const aiAgentModelProviders = ["claude_subscription", "gpt_codex_subscription", "cursor_agent"] as const;
export const aiAgentCapabilityKinds = [
  "save_records",
  "send_external",
  "confirm_money",
  "change_permissions",
] as const;

export type AiAgentAllowedWork = (typeof aiAgentAllowedWorkKinds)[number];
export type AiAgentStatus = (typeof aiAgentStatuses)[number];
export type AiAgentWorkLogStatus = (typeof aiAgentWorkLogStatuses)[number];
export type AiAgentModelProvider = (typeof aiAgentModelProviders)[number];
export type AiAgentCapability = (typeof aiAgentCapabilityKinds)[number];
export type AiAgentCapabilities = Record<AiAgentCapability, boolean>;

export const aiAgentAllowedWorkLabels: Record<AiAgentAllowedWork, string> = {
  research: "자료 조사",
  draft: "초안 작성",
  task_update: "업무 업데이트",
  approval_request: "승인 요청 초안",
};

export const aiAgentModelProviderLabels: Record<AiAgentModelProvider, string> = {
  claude_subscription: "Claude 구독",
  gpt_codex_subscription: "GPT·Codex 구독",
  cursor_agent: "Cursor",
};

export const aiAgentCapabilityLabels: Record<AiAgentCapability, string> = {
  save_records: "기록 저장",
  send_external: "외부 발송",
  confirm_money: "금액·계약 확정",
  change_permissions: "권한 변경",
};

export const defaultAiAgentCapabilities: AiAgentCapabilities = {
  save_records: false,
  send_external: false,
  confirm_money: false,
  change_permissions: false,
};

export const aiAgentStatusLabels: Record<AiAgentStatus, string> = {
  active: "활성",
  inactive: "중지",
};

export const aiAgentWorkLogStatusLabels: Record<AiAgentWorkLogStatus, string> = {
  pending: "대기",
  approved: "승인",
  rejected: "반려",
};

export const COMPANY_AGENT_SCOPE_LABEL = "회사 공통";

function trimRequired(value: string, message: string, max: number, tooLong: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(message);
  if (trimmed.length > max) throw new Error(tooLong);
  return trimmed;
}

export function normalizeAllowedWork(kinds: string[]) {
  const unique = [...new Set(kinds.map((kind) => kind.trim()).filter(Boolean))];
  if (unique.length === 0) throw new Error("Allowed work is required");
  for (const kind of unique) {
    if ((aiAgentForbiddenWorkKinds as readonly string[]).includes(kind)) {
      throw new Error("Agents cannot independently confirm money, contracts, permissions, or public publishing");
    }
    if (!(aiAgentAllowedWorkKinds as readonly string[]).includes(kind)) {
      throw new Error("Unsupported allowed work");
    }
  }
  return unique as AiAgentAllowedWork[];
}

export function formatAllowedWork(kinds: string[]) {
  return kinds
    .filter((kind): kind is AiAgentAllowedWork => (aiAgentAllowedWorkKinds as readonly string[]).includes(kind))
    .map((kind) => aiAgentAllowedWorkLabels[kind])
    .join(" · ");
}

export function agentAccessLabel(input: {
  accessScope: string;
  projectName?: string | null;
  clientName?: string | null;
  ventureName?: string | null;
}) {
  if (input.projectName && input.clientName) {
    return `${input.clientName} · ${input.projectName} · ${input.accessScope}`;
  }
  if (input.ventureName) return `${input.ventureName} · ${input.accessScope}`;
  return `${COMPANY_AGENT_SCOPE_LABEL} · ${input.accessScope}`;
}

export function isAgentAssignableToProject(agent: {
  status: string;
  projectId: string | null;
  ventureId: string | null;
}, projectId: string) {
  if (agent.status !== "active") return false;
  if (agent.ventureId) return false;
  if (agent.projectId && agent.projectId !== projectId) return false;
  return true;
}

export function normalizeOptionalText(value: string | undefined, max: number, tooLong: string) {
  const trimmed = value?.trim() || "";
  if (trimmed.length > max) throw new Error(tooLong);
  return trimmed || null;
}

export function normalizeAiAgentModelProvider(value: string | undefined): AiAgentModelProvider {
  const trimmed = value?.trim() || "claude_subscription";
  if (!(aiAgentModelProviders as readonly string[]).includes(trimmed)) {
    throw new Error("Unsupported agent model provider");
  }
  return trimmed as AiAgentModelProvider;
}

export function normalizeAiAgentCapabilities(kinds: string[] | undefined): AiAgentCapabilities {
  const enabled = new Set((kinds ?? []).map((kind) => kind.trim()).filter(Boolean));
  for (const kind of enabled) {
    if (!(aiAgentCapabilityKinds as readonly string[]).includes(kind)) {
      throw new Error("Unsupported agent capability");
    }
  }
  return {
    save_records: enabled.has("save_records"),
    send_external: enabled.has("send_external"),
    confirm_money: enabled.has("confirm_money"),
    change_permissions: enabled.has("change_permissions"),
  };
}

export function agentHasCapability(capabilities: AiAgentCapabilities | null | undefined, kind: AiAgentCapability) {
  return Boolean(capabilities?.[kind]);
}

export function normalizeAiAgentDraft(input: {
  name: string;
  purpose: string;
  allowedWork: string[];
  accessScope: string;
  projectId?: string;
  ventureId?: string;
  workStyle?: string;
  answerStyle?: string;
  procedure?: string;
  instructions?: string;
  modelProvider?: string;
  capabilities?: string[];
}): {
  name: string;
  purpose: string;
  allowedWork: AiAgentAllowedWork[];
  accessScope: string;
  projectId: string | null;
  ventureId: string | null;
  workStyle: string | null;
  answerStyle: string | null;
  procedure: string | null;
  instructions: string | null;
  modelProvider: AiAgentModelProvider;
  capabilities: AiAgentCapabilities;
  status: "active";
} {
  const projectId = input.projectId?.trim() || null;
  const ventureId = input.ventureId?.trim() || null;
  if (projectId && ventureId) throw new Error("Link to a project or a venture, not both");
  return {
    name: trimRequired(input.name, "Agent name is required", 80, "Agent name is too long"),
    purpose: trimRequired(input.purpose, "Agent purpose is required", 500, "Agent purpose is too long"),
    allowedWork: normalizeAllowedWork(input.allowedWork),
    accessScope: trimRequired(input.accessScope, "Agent access scope is required", 500, "Agent access scope is too long"),
    projectId,
    ventureId,
    workStyle: normalizeOptionalText(input.workStyle, 2000, "Work style is too long"),
    answerStyle: normalizeOptionalText(input.answerStyle, 2000, "Answer style is too long"),
    procedure: normalizeOptionalText(input.procedure, 4000, "Procedure is too long"),
    instructions: normalizeOptionalText(input.instructions, 8000, "Instructions are too long"),
    modelProvider: normalizeAiAgentModelProvider(input.modelProvider),
    capabilities: normalizeAiAgentCapabilities(input.capabilities),
    status: "active",
  };
}

export function deactivateAiAgent(input: { status: string }) {
  if (input.status !== "active") throw new Error("Inactive agents cannot be changed");
  return { status: "inactive" as const };
}

/**
 * `taskProjectId`는 F06 이후 null일 수 있다(회사 운영·자체 사업 업무는 프로젝트가 없다).
 * 프로젝트 범위 에이전트는 그 경우 항상 범위 밖이라 배정을 거부한다 — `agentProjectId !== null`이면 걸린다.
 */
export function assignTaskAgent(input: {
  status: string;
  assignedAgentId?: string | null;
  agentStatus?: string | null;
  agentProjectId?: string | null;
  agentVentureId?: string | null;
  taskProjectId: string | null;
}) {
  if (input.status === "done") throw new Error("Completed tasks cannot be changed");
  if (input.status !== "open") throw new Error("Unsupported task status");
  const assignedAgentId = input.assignedAgentId?.trim() || null;
  if (!assignedAgentId) return { assignedAgentId: null };
  if (input.agentStatus !== "active") throw new Error("Inactive agents cannot be assigned");
  if (input.agentVentureId) throw new Error("Venture-scoped agents cannot be assigned to project tasks");
  if (input.agentProjectId && input.agentProjectId !== input.taskProjectId) {
    throw new Error("Task is outside the agent access scope");
  }
  return { assignedAgentId };
}

export function normalizeAiAgentWorkLog(input: {
  requestNote: string;
  inputNote: string;
  resultNote?: string;
  taskId?: string;
}) {
  const requestNote = trimRequired(input.requestNote, "Work request is required", 2000, "Work request is too long");
  const inputNote = trimRequired(input.inputNote, "Work input is required", 2000, "Work input is too long");
  const resultNote = input.resultNote?.trim() || null;
  if (resultNote && resultNote.length > 2000) throw new Error("Work result is too long");
  return {
    requestNote,
    inputNote,
    resultNote,
    taskId: input.taskId?.trim() || null,
  };
}

export function assertAgentCanRecordWork(input: {
  agentStatus: string;
  agentProjectId: string | null;
  agentVentureId: string | null;
  taskProjectId?: string | null;
}) {
  if (input.agentStatus !== "active") throw new Error("Inactive agents cannot record work");
  if (!input.taskProjectId) return;
  if (input.agentVentureId) throw new Error("Venture-scoped agents cannot record project task work");
  if (input.agentProjectId && input.agentProjectId !== input.taskProjectId) {
    throw new Error("Task is outside the agent access scope");
  }
}

export function approveAiAgentWork(input: { status: string; approved: boolean; resultNote?: string | null }) {
  if (!input.approved) throw new Error("Representative approval is required");
  if (input.status !== "pending") throw new Error("Decided agent work cannot be changed");
  const resultNote = input.resultNote?.trim() || "";
  if (!resultNote) throw new Error("Work result is required");
  if (resultNote.length > 2000) throw new Error("Work result is too long");
  return { status: "approved" as const, resultNote };
}

export function rejectAiAgentWork(input: { status: string; approved: boolean; reason: string }) {
  if (!input.approved) throw new Error("Representative approval is required");
  if (input.status !== "pending") throw new Error("Decided agent work cannot be changed");
  const decisionReason = input.reason.trim();
  if (!decisionReason) throw new Error("Rejection reason is required");
  if (decisionReason.length > 500) throw new Error("Rejection reason is too long");
  return { status: "rejected" as const, decisionReason };
}

export function partitionAgentWorkLogs<T extends { status: string }>(logs: T[]) {
  return {
    pending: logs.filter((item) => item.status === "pending"),
    decided: logs.filter((item) => item.status !== "pending"),
  };
}
