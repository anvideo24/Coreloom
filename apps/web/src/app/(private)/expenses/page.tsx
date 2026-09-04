import { Suspense } from "react";
import { redirect } from "next/navigation";

import { ExpensesPageClient } from "@/components/expenses-page-client";
import { founderSession } from "@/lib/auth/session";
import type { ExpenseEntryStatus } from "@/lib/domain/expenses";
import type { VentureKind } from "@/lib/domain/revenue";
import { listFounderExpenseLedger } from "@/lib/expenses/repository";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { ventures, projects, suppliers, rows, summary } = await listFounderExpenseLedger(session.founder.id);

  return (
    <main className="operations-shell">
      <Suspense fallback={<p className="empty-state">비용 원장을 불러오는 중…</p>}>
        <ExpensesPageClient
          projects={projects}
          rows={rows.map((row) => ({
            ...row,
            status: row.status as ExpenseEntryStatus,
          }))}
          summary={summary}
          suppliers={suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name }))}
          ventures={ventures.map((venture) => ({
            ...venture,
            kind: venture.kind as VentureKind,
          }))}
        />
      </Suspense>
    </main>
  );
}
