export type ProgressTask = { completedAt: string | null };

export function calculateProgress(tasks: ProgressTask[]): number {
  if (tasks.length === 0) return 0;

  const completedCount = tasks.filter(
    (task) => task.completedAt !== null,
  ).length;

  return Math.round((completedCount / tasks.length) * 100);
}
