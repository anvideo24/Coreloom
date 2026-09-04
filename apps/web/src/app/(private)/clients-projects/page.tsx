import { Suspense } from "react";
import { redirect } from "next/navigation";

import { ProjectsPageClient } from "@/components/projects-page-client";
import { founderSession } from "@/lib/auth/session";
import { listFounderClientsAndProjects } from "@/lib/clients-projects/repository";
import type { ProjectStatus } from "@/lib/domain/clients-projects";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");

  const { clients, projects } = await listFounderClientsAndProjects(session.founder.id);

  return (
    <main className="operations-shell">
      <Suspense fallback={<p className="empty-state">프로젝트를 불러오는 중…</p>}>
        <ProjectsPageClient
          clients={clients.map((client) => ({ id: client.id, name: client.name }))}
          projects={projects.map((project) => ({
            ...project,
            status: project.status as ProjectStatus,
          }))}
        />
      </Suspense>
    </main>
  );
}
