import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";

import { ClientDetailPageClient } from "@/components/client-detail-page-client";
import { founderSession } from "@/lib/auth/session";
import { getFounderClient } from "@/lib/clients-projects/repository";
import type { ContactRelationStatus, ProjectStatus } from "@/lib/domain/clients-projects";

export const dynamic = "force-dynamic";

type ClientDetailPageProps = {
  params: Promise<{ clientId: string }>;
};

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");

  const { clientId } = await params;
  const detail = await getFounderClient(session.founder.id, clientId);
  if (!detail) notFound();

  return (
    <main className="operations-shell">
      <Suspense fallback={<p className="empty-state">고객사를 불러오는 중…</p>}>
        <ClientDetailPageClient
          client={detail.client}
          contacts={detail.contacts.map((contact) => ({
            ...contact,
            relationStatus: contact.relationStatus as ContactRelationStatus,
          }))}
          projects={detail.projects.map((project) => ({
            ...project,
            status: project.status as ProjectStatus,
          }))}
        />
      </Suspense>
    </main>
  );
}
