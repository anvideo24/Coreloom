import { notFound, redirect } from "next/navigation";

import { AdminManualFrame } from "@/components/admin-manual-frame";
import { readSharedManual } from "@/lib/admin-manual/repository";
import { founderSession } from "@/lib/auth/session";
import { buildAdminManualPage } from "@/lib/domain/admin-manual";

export const dynamic = "force-dynamic";

export default async function AdminManualSharedPage({ params }: { params: Promise<{ doc: string }> }) {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { doc } = await params;

  let source: ReturnType<typeof readSharedManual>;
  try {
    // 허용 목록에 없는 이름이면 readSharedManual이 던진다.
    source = readSharedManual(doc);
  } catch {
    notFound();
  }

  const page = buildAdminManualPage(source);
  const sourceLabel = `working-method/${source.file}`;

  if (!source.available) {
    return (
      <AdminManualFrame
        deployCommit={page.deployCommit}
        deployVersion={page.deployVersion}
        intro="공용 정본을 읽지 못했습니다. 대신 보여 줄 사본을 이 제품에 두지 않습니다."
        manualCommit={page.manualCommit}
        sourceLabel={sourceLabel}
        title={page.title}
      >
        {source.reason === "no-repository" ? (
          <>
            <p>공용 저장소를 찾지 못했습니다.</p>
            <p>
              working-method를 이 저장소와 같은 부모 폴더에 클론하면 이 화면에서 열립니다. 다른 자리에 두었으면
              환경 변수 CORELOOM_WORKING_METHOD_DIR에 그 폴더 경로를 넣습니다.
            </p>
          </>
        ) : (
          <>
            <p>공용 저장소는 찾았는데 {source.file} 파일이 없습니다.</p>
            <p>그 저장소에서 파일 이름이 바뀌었는지 확인하고, 최신 상태로 받아 옵니다.</p>
          </>
        )}
        <p>정본은 GitHub anvideo24/working-method 입니다.</p>
      </AdminManualFrame>
    );
  }

  return (
    <AdminManualFrame
      blocks={page.blocks}
      deployCommit={page.deployCommit}
      deployVersion={page.deployVersion}
      intro="공용 정본 저장소의 원본입니다. 이 화면은 읽기만 하며, 고치려면 working-method를 고칩니다."
      manualCommit={page.manualCommit}
      sourceLabel={sourceLabel}
      title={page.title}
    />
  );
}
