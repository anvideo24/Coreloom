import { Suspense } from "react";
import { redirect } from "next/navigation";

import { RevenuePageClient } from "@/components/revenue-page-client";
import { founderSession } from "@/lib/auth/session";
import type { RevenueEntryStatus, VentureKind } from "@/lib/domain/revenue";
import { listFounderRevenueLedger } from "@/lib/revenue/repository";

export const dynamic = "force-dynamic";

export default async function RevenuePage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { ventures, projects, accounts, rows, summary } = await listFounderRevenueLedger(session.founder.id);

  return (
    <main className="operations-shell">
      <Suspense fallback={<p className="empty-state">매출 원장을 불러오는 중…</p>}>
        <RevenuePageClient
          accounts={accounts.map((account) => ({
            id: account.id,
            code: account.code,
            name: account.name,
          }))}
          projects={projects}
          rows={rows.map((row) => ({
            ...row,
            status: row.status as RevenueEntryStatus,
          }))}
          summary={summary}
          ventures={ventures.map((venture) => ({
            ...venture,
            kind: venture.kind as VentureKind,
          }))}
        />
      </Suspense>
    </main>
  );
}
