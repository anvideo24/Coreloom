export const taskStatuses = ["open", "done"] as const;

export type TaskStatus = (typeof taskStatuses)[number];

export const taskStatusLabels: Record<TaskStatus, string> = {
  open: "진행",
  done: "완료",
};

/** 업무가 어디에 속하는가(F06). 고객사 프로젝트만 있던 자리에 회사 운영·자체 사업을 더한다. */
export const workKinds = ["company", "internal", "client"] as const;
export type WorkKind = (typeof workKinds)[number];

export const workKindLabels: Record<WorkKind, string> = {
  company: "회사 운영",
  internal: "자체 사업",
  client: "고객사 프로젝트",
};

export function isWorkKind(value: string): value is WorkKind {
  return (workKinds as readonly string[]).includes(value);
}

export type TaskLink = { kind: WorkKind; projectId: string | null; clientCompanyId: string | null; ventureId: string | null };

/**
 * 유형과 연결을 맞춘다. 데이터베이스에도 같은 규칙이 `tasks_kind_link_ck`로 걸려 있다 —
 * 두 곳에 적힌 규칙은 어긋나기 쉬우니, 문구를 바꿀 때 반드시 그 제약도 같이 본다.
 *
 * 에이전트에는 이미 「프로젝트 또는 사업 중 하나에만」 규칙이 있다(`normalizeAgentDraft`).
 * 여기서는 유형이 셋이라 어느 쪽도 아닌 「회사 운영」이 더해진다.
 */
export function normalizeTaskLink(input: {
  kind: string;
  projectId?: string | null;
  clientCompanyId?: string | null;
  ventureId?: string | null;
}): TaskLink {
  const kind = input.kind.trim();
  if (!isWorkKind(kind)) throw new Error("Unsupported work kind");
  const projectId = input.projectId?.trim() || null;
  const clientCompanyId = input.clientCompanyId?.trim() || null;
  const ventureId = input.ventureId?.trim() || null;

  if (kind === "client") {
    if (!projectId || !clientCompanyId) throw new Error("고객사 프로젝트 업무는 프로젝트와 고객사가 있어야 합니다.");
    if (ventureId) throw new Error("고객사 프로젝트 업무에는 자체 사업을 붙일 수 없습니다.");
    return { kind, projectId, clientCompanyId, ventureId: null };
  }
  if (kind === "internal") {
    if (!ventureId) throw new Error("자체 사업 업무는 사업이 있어야 합니다.");
    if (projectId || clientCompanyId) throw new Error("자체 사업 업무에는 프로젝트·고객사를 붙일 수 없습니다.");
    return { kind, projectId: null, clientCompanyId: null, ventureId };
  }
  if (projectId || clientCompanyId || ventureId) {
    throw new Error("회사 운영 업무에는 프로젝트·고객사·사업을 붙일 수 없습니다.");
  }
  return { kind, projectId: null, clientCompanyId: null, ventureId: null };
}

/** 화면에 「어디에 속한 일인가」를 한 줄로. 연결이 없으면 유형 이름만 보인다. */
export function taskLinkLabel(input: {
  kind: string;
  projectName?: string | null;
  clientName?: string | null;
  ventureName?: string | null;
}): string {
  if (input.kind === "client") {
    return [input.clientName, input.projectName].filter(Boolean).join(" · ") || workKindLabels.client;
  }
  if (input.kind === "internal") return input.ventureName?.trim() || workKindLabels.internal;
  return workKindLabels.company;
}

function parseIsoDate(value: string, message: string) {
  const date = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(message);
  if (Number.isNaN(new Date(`${date}T00:00:00.000Z`).getTime())) throw new Error(message);
  return date;
}

export function normalizeTaskDraft(input: { title: string; dueDate: string; completionCondition: string }) {
  const title = input.title.trim();
  const completionCondition = input.completionCondition.trim();
  if (!title) throw new Error("Task title is required");
  if (!completionCondition) throw new Error("Completion condition is required");
  return {
    title,
    dueDate: parseIsoDate(input.dueDate, "Due date is required"),
    completionCondition,
  };
}

export function completeTask(input: { status: string; approved: boolean }) {
  if (!input.approved) throw new Error("Representative approval is required");
  if (input.status === "done") throw new Error("Completed tasks cannot be changed");
  if (input.status !== "open") throw new Error("Unsupported task status");
  return { status: "done" as const };
}

export function groupOpenTasksByDueDate<T extends { dueDate: string; status: string }>(tasks: T[]) {
  const groups = new Map<string, T[]>();
  for (const task of tasks.filter((item) => item.status === "open").sort((left, right) => left.dueDate.localeCompare(right.dueDate))) {
    const existing = groups.get(task.dueDate) ?? [];
    existing.push(task);
    groups.set(task.dueDate, existing);
  }
  return [...groups.entries()].map(([dueDate, items]) => ({ dueDate, tasks: items }));
}
