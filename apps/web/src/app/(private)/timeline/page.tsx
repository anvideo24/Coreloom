import { Suspense } from "react";
import { redirect } from "next/navigation";

import { TimelinePageClient } from "@/components/timeline-page-client";
import { founderSession } from "@/lib/auth/session";
import type { RechoEvidenceKind } from "@/lib/domain/recho-evidence";
import { listFounderRechoEvidence } from "@/lib/recho-evidence/repository";

export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { projects, timeline } = await listFounderRechoEvidence(session.founder.id);

  return (
    <main className="operations-shell">
      <Suspense fallback={<p className="empty-state">근거 기록을 불러오는 중…</p>}>
        <TimelinePageClient
          projects={projects}
          timeline={timeline.map((group) => ({
            occurredOn: group.occurredOn,
            records: group.records.map((record) => ({
              ...record,
              kind: record.kind as RechoEvidenceKind,
            })),
          }))}
        />
      </Suspense>
    </main>
  );
}
