import { Suspense } from "react";
import { redirect } from "next/navigation";

import { ClientsPageClient } from "@/components/clients-page-client";
import { founderSession } from "@/lib/auth/session";
import { listFounderClients } from "@/lib/clients-projects/repository";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");

  const clients = await listFounderClients(session.founder.id);

  return (
    <main className="operations-shell">
      <Suspense fallback={<p className="empty-state">고객사를 불러오는 중…</p>}>
        <ClientsPageClient clients={clients} />
      </Suspense>
    </main>
  );
}
