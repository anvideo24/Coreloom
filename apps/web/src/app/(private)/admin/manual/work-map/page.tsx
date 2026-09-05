import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminManualFrame } from "@/components/admin-manual-frame";
import { ManualWorkMap } from "@/components/manual-work-map";
import { readAdminManualWorkMap } from "@/lib/admin-manual/repository";
import { founderSession } from "@/lib/auth/session";
import { parseWorkMap } from "@/lib/domain/manual-work-map";

export const dynamic = "force-dynamic";

export default async function WorkMapPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  let source: ReturnType<typeof readAdminManualWorkMap>;
  let map: ReturnType<typeof parseWorkMap>;
  try {
    source = readAdminManualWorkMap();
    map = parseWorkMap(source.markdown);
  } catch {
    return <main className="operations-shell"><Link href="/admin/manual">매뉴얼 홈</Link><h1>업무 지도</h1><p role="status">업무 지도 원본을 읽을 수 없습니다. 원본 문서와 형식을 확인해 주세요.</p></main>;
  }
  return (
    <AdminManualFrame title="일은 이렇게 이어집니다"
      intro="고객을 만나는 순간부터 입금 확인까지. 업무를 누르면 무엇을 하고, 어디로 이어지는지 볼 수 있습니다."
      deployVersion={source.deployVersion} deployCommit={source.deployCommit} manualCommit={source.manualCommit}
      sourceLabel="manual/work-map.md" contentLayout="canvas">
      <ManualWorkMap {...map} />
    </AdminManualFrame>
  );
}
