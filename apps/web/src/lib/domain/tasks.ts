export const taskStatuses = ["open", "done"] as const;

export type TaskStatus = (typeof taskStatuses)[number];

export const taskStatusLabels: Record<TaskStatus, string> = {
  open: "진행",
  done: "완료",
};

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
