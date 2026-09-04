import { Suspense } from "react";
import { redirect } from "next/navigation";

import { ProposalsPageClient } from "@/components/proposals-page-client";
import { listFounderAiProposals } from "@/lib/ai-proposals/repository";
import { founderSession } from "@/lib/auth/session";
import type { AiProposalKind, AiProposalStatus } from "@/lib/domain/ai-proposals";

export const dynamic = "force-dynamic";

export default async function ProposalsPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { evidence, pending, decided } = await listFounderAiProposals(session.founder.id);

  return (
    <main className="operations-shell">
      <Suspense fallback={<p className="empty-state">제안을 불러오는 중…</p>}>
        <ProposalsPageClient
          decided={decided.map((proposal) => ({
            ...proposal,
            kind: proposal.kind as AiProposalKind,
            status: proposal.status as AiProposalStatus,
          }))}
          evidence={evidence}
          pending={pending.map((proposal) => ({
            ...proposal,
            kind: proposal.kind as AiProposalKind,
            status: proposal.status as AiProposalStatus,
          }))}
        />
      </Suspense>
    </main>
  );
}
