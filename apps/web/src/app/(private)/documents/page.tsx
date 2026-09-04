import { Suspense } from "react";
import { redirect } from "next/navigation";

import { DocumentsPageClient } from "@/components/documents-page-client";
import { founderSession } from "@/lib/auth/session";
import type { VaultDocumentKind } from "@/lib/domain/documents";
import { listFounderVaultDocuments } from "@/lib/documents/repository";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { projects, documents } = await listFounderVaultDocuments(session.founder.id);

  return (
    <main className="operations-shell">
      <Suspense fallback={<p className="empty-state">문서함을 불러오는 중…</p>}>
        <DocumentsPageClient
          documents={documents.map((document) => ({
            documentId: document.documentId,
            title: document.title,
            kind: document.kind as VaultDocumentKind,
            versionNumber: document.versionNumber,
            counterparty: document.counterparty,
            hasStoredFile: document.hasStoredFile,
          }))}
          projects={projects}
        />
      </Suspense>
    </main>
  );
}
