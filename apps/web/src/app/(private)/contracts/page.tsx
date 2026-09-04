import { Suspense } from "react";
import { redirect } from "next/navigation";

import { ContractsPageClient } from "@/components/contracts-page-client";
import { founderSession } from "@/lib/auth/session";
import { listFounderContracts } from "@/lib/contracts/repository";
import type { ContractStatus } from "@/lib/domain/contracts";

export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { contracts, convertibleQuotes } = await listFounderContracts(session.founder.id);

  return (
    <main className="operations-shell">
      <Suspense fallback={<p className="empty-state">계약을 불러오는 중…</p>}>
        <ContractsPageClient
          contracts={contracts.map((contract) => ({
            ...contract,
            status: contract.status as ContractStatus,
          }))}
          convertibleQuotes={convertibleQuotes}
        />
      </Suspense>
    </main>
  );
}
