import { notFound, redirect } from "next/navigation";

import { AdminManualFrame } from "@/components/admin-manual-frame";
import { readCoreloomRules } from "@/lib/admin-manual/repository";
import { founderSession } from "@/lib/auth/session";
import { buildAdminManualPage } from "@/lib/domain/admin-manual";

export const dynamic = "force-dynamic";

export default async function AdminManualProductRulesPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");

  let source: ReturnType<typeof readCoreloomRules>;
  try {
    source = readCoreloomRules();
  } catch {
    notFound();
  }
  const page = buildAdminManualPage(source);

  return (
    <AdminManualFrame
      blocks={page.blocks}
      deployCommit={page.deployCommit}
      deployVersion={page.deployVersion}
      intro="Coreloom만의 규칙입니다. 공용 규칙과 겹치면 이 문서가 이 제품의 정본입니다."
      manualCommit={page.manualCommit}
      sourceLabel="RULES.md"
      title={page.title}
    />
  );
}
