import { Suspense } from "react";
import { redirect } from "next/navigation";

import { TasksPageClient } from "@/components/tasks-page-client";
import { founderSession } from "@/lib/auth/session";
import type { TaskStatus } from "@/lib/domain/tasks";
import { listFounderTasks } from "@/lib/tasks/repository";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { projects, ventures, agents, tasks, schedule } = await listFounderTasks(session.founder.id);

  return (
    <main className="operations-shell">
      <Suspense fallback={<p className="empty-state">업무를 불러오는 중…</p>}>
        <TasksPageClient
          agents={agents}
          projects={projects}
          ventures={ventures}
          schedule={schedule.map((group) => ({
            dueDate: group.dueDate,
            tasks: group.tasks.map((task) => ({
              ...task,
              status: task.status as TaskStatus,
            })),
          }))}
          tasks={tasks.map((task) => ({
            ...task,
            status: task.status as TaskStatus,
          }))}
        />
      </Suspense>
    </main>
  );
}
