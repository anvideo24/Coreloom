import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AccountsPageClient } from "@/components/accounts-page-client";
import { listFounderLedgerAccounts } from "@/lib/accounts/repository";
import { founderSession } from "@/lib/auth/session";
import type { LedgerAccountClass } from "@/lib/domain/ledger-accounts";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");

  const accounts = await listFounderLedgerAccounts(session.founder.id);

  return (
    <main className="operations-shell">
      <Suspense fallback={<p className="empty-state">계정과목을 불러오는 중…</p>}>
        <AccountsPageClient
          accounts={accounts.map((account) => ({
            ...account,
            accountClass: account.accountClass as LedgerAccountClass,
          }))}
        />
      </Suspense>
    </main>
  );
}
