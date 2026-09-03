import { notFound, redirect } from "next/navigation";

import { AdminManualFrame } from "@/components/admin-manual-frame";
import { readAdminManualOverview } from "@/lib/admin-manual/repository";
import { founderSession } from "@/lib/auth/session";
import { buildAdminManualPage } from "@/lib/domain/admin-manual";

export const dynamic = "force-dynamic";

export default async function AdminManualOverviewPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");

  let source: ReturnType<typeof readAdminManualOverview>;
  try {
    source = readAdminManualOverview();
  } catch {
    notFound();
  }
  const page = buildAdminManualPage(source);

  return (
    <AdminManualFrame
      blocks={page.blocks}
      currentHref="/admin/manual"
      deployCommit={page.deployCommit}
      deployVersion={page.deployVersion}
      intro="저장소 manual/ 원본을 읽기 전용으로 보여 줍니다. 화면에서 고치지 않으며, 변경은 검토·커밋·배포로만 반영합니다."
      manualCommit={page.manualCommit}
      title={page.title}
    />
  );
}
