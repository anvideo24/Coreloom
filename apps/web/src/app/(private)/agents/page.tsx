import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AgentsPageClient } from "@/components/agents-page-client";
import { listFounderAgents } from "@/lib/agents/repository";
import { founderSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { projects, ventures, agents } = await listFounderAgents(session.founder.id);

  return (
    <main className="operations-shell">
      <Suspense fallback={<p className="empty-state">에이전트를 불러오는 중…</p>}>
        <AgentsPageClient agents={agents} projects={projects} ventures={ventures} />
      </Suspense>
    </main>
  );
}
