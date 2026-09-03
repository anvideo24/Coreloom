import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminManualFrame } from "@/components/admin-manual-frame";
import { listAdminManualRoles } from "@/lib/admin-manual/repository";
import { founderSession } from "@/lib/auth/session";
import { buildAdminManualPage } from "@/lib/domain/admin-manual";

export const dynamic = "force-dynamic";

export default async function AdminManualRolesPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");

  const source = listAdminManualRoles();
  const page = buildAdminManualPage({
    ...source,
    title: "역할별 운영 절차",
    markdown: "",
  });

  return (
    <AdminManualFrame
      currentHref="/admin/manual/roles"
      deployCommit={page.deployCommit}
      deployVersion={page.deployVersion}
      intro="역할별 운영 절차는 manual/roles/ 원본만 보여 줍니다. 같은 절차를 이 화면에 복사하지 않습니다."
      manualCommit={page.manualCommit}
      title={page.title}
    >
      {source.roles.length === 0 ? (
        <p>등록된 역할별 운영 절차 문서가 없습니다.</p>
      ) : source.roles.map((role) => (
        <p key={role.slug}><Link href={role.href}>{role.title}</Link></p>
      ))}
    </AdminManualFrame>
  );
}
