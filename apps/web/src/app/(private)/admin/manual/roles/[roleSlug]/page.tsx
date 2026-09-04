import { notFound, redirect } from "next/navigation";

import { AdminManualFrame } from "@/components/admin-manual-frame";
import { readAdminManualRole } from "@/lib/admin-manual/repository";
import { founderSession } from "@/lib/auth/session";
import { buildAdminManualPage } from "@/lib/domain/admin-manual";

export const dynamic = "force-dynamic";

export default async function AdminManualRolePage({ params }: { params: Promise<{ roleSlug: string }> }) {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { roleSlug } = await params;
  const slug = decodeURIComponent(roleSlug);

  let source: ReturnType<typeof readAdminManualRole>;
  try {
    source = readAdminManualRole(slug);
  } catch {
    notFound();
  }
  const page = buildAdminManualPage(source);

  return (
    <AdminManualFrame
      blocks={page.blocks}
      deployCommit={page.deployCommit}
      deployVersion={page.deployVersion}
      intro="이 문서는 역할 목록의 원본입니다. 운영 절차는 운영 매뉴얼을 정본으로 둡니다."
      manualCommit={page.manualCommit}
      sourceLabel={`manual/roles/${page.title}.md`}
      title={page.title}
    />
  );
}
