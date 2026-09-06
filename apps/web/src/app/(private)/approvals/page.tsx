import { Suspense } from "react";
import { redirect } from "next/navigation";

import { ApprovalsPageClient } from "@/components/approvals-page-client";
import { listFounderApprovalInbox } from "@/lib/approvals/repository";
import { founderSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");

  const { items, summary } = await listFounderApprovalInbox(session.founder.id);

  return (
    <main className="operations-shell">
      <Suspense fallback={<p className="empty-state">승인함을 불러오는 중…</p>}>
        <ApprovalsPageClient items={items} scopeId={session.founder.id} summary={summary} />
      </Suspense>
    </main>
  );
}
