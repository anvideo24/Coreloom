import { notFound, redirect } from "next/navigation";

import { AdminManualFrame } from "@/components/admin-manual-frame";
import { readAdminManualChangelog } from "@/lib/admin-manual/repository";
import { founderSession } from "@/lib/auth/session";
import { buildAdminManualPage } from "@/lib/domain/admin-manual";

export const dynamic = "force-dynamic";

export default async function AdminManualChangelogPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");

  let source: ReturnType<typeof readAdminManualChangelog>;
  try {
    source = readAdminManualChangelog();
  } catch {
    notFound();
  }
  const page = buildAdminManualPage(source);

  return (
    <AdminManualFrame
      blocks={page.blocks}
      currentHref="/admin/manual/changelog"
      deployCommit={page.deployCommit}
      deployVersion={page.deployVersion}
      intro="매뉴얼 변경 기록의 저장소 원본입니다. 화면에서 고치지 않습니다."
      manualCommit={page.manualCommit}
      title={page.title}
    />
  );
}
