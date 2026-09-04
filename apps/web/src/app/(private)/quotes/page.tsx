import { Suspense } from "react";
import { redirect } from "next/navigation";

import { QuotesPageClient } from "@/components/quotes-page-client";
import { founderSession } from "@/lib/auth/session";
import { listFounderQuotes } from "@/lib/quotes/repository";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { clients, projects, contacts, versions, issuer } = await listFounderQuotes(session.founder.id);

  return (
    <main className="operations-shell">
      <Suspense fallback={<p className="empty-state">견적서를 불러오는 중…</p>}>
        <QuotesPageClient
          clients={clients}
          contacts={contacts}
          issuer={issuer}
          projects={projects}
          versions={versions}
        />
      </Suspense>
    </main>
  );
}
