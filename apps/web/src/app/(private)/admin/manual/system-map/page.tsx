import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminManualFrame } from "@/components/admin-manual-frame";
import { ManualSystemMap } from "@/components/manual-system-map";
import { readAdminManualSystemMap } from "@/lib/admin-manual/repository";
import { founderSession } from "@/lib/auth/session";
import { parseSystemMap } from "@/lib/domain/manual-system-map";

export const dynamic = "force-dynamic";

export default async function SystemMapPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  let source: ReturnType<typeof readAdminManualSystemMap>;
  let map: ReturnType<typeof parseSystemMap>;
  try {
    source = readAdminManualSystemMap();
    map = parseSystemMap(source.markdown);
  } catch {
    return <main className="operations-shell"><Link href="/admin/manual">매뉴얼 홈</Link><h1>시스템 구조도</h1><p role="status">시스템 구조도 원본을 읽을 수 없습니다. 원본 문서와 형식을 확인해 주세요.</p></main>;
  }
  return (
    <AdminManualFrame title="무엇이 어디에 연결되나요?"
      intro="업무 지도는 ‘일의 순서’, 시스템 구조도는 ‘기능과 자료의 관계’입니다. 항목을 눌러 자세히 보세요."
      deployVersion={source.deployVersion} deployCommit={source.deployCommit} manualCommit={source.manualCommit}
      sourceLabel="manual/system-map.md" contentLayout="canvas">
      <ManualSystemMap {...map} />
    </AdminManualFrame>
  );
}
