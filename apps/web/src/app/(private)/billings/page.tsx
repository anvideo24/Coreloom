import { Suspense } from "react";
import { redirect } from "next/navigation";

import { BillingsPageClient } from "@/components/billings-page-client";
import { founderSession } from "@/lib/auth/session";
import { listFounderBillings } from "@/lib/billings/repository";
import type { BillingKind, BillingStatus } from "@/lib/domain/billings";

export const dynamic = "force-dynamic";

export default async function BillingsPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { billings, executableContracts, series } = await listFounderBillings(session.founder.id);

  return (
    <main className="operations-shell">
      <Suspense fallback={<p className="empty-state">청구를 불러오는 중…</p>}>
        <BillingsPageClient
          billings={billings.map((billing) => ({
            ...billing,
            kind: billing.kind as BillingKind,
            status: billing.status as BillingStatus,
          }))}
          executableContracts={executableContracts}
          series={series}
        />
      </Suspense>
    </main>
  );
}
