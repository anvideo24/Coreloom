import { notFound, redirect } from "next/navigation";

import { AdminManualFrame } from "@/components/admin-manual-frame";
import { readAdminManualProgress } from "@/lib/admin-manual/repository";
import { founderSession } from "@/lib/auth/session";
import { buildAdminManualPage } from "@/lib/domain/admin-manual";

export const dynamic = "force-dynamic";

export default async function AdminManualProgressPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");

  let source: ReturnType<typeof readAdminManualProgress>;
  try {
    source = readAdminManualProgress();
  } catch {
    notFound();
  }
  const page = buildAdminManualPage(source);

  return (
    <AdminManualFrame
      blocks={page.blocks}
      deployCommit={page.deployCommit}
      deployVersion={page.deployVersion}
      intro="기능별 구현 상태를 추적합니다. 기능이 추가되거나 상태가 바뀌면 같은 커밋에서 이 표를 갱신합니다."
      manualCommit={page.manualCommit}
      sourceLabel="manual/system-progress.md"
      title={page.title}
    />
  );
}
