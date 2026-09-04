import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminManualFrame } from "@/components/admin-manual-frame";
import { availableSharedManualSlugs, readAdminManualSource } from "@/lib/admin-manual/repository";
import { founderSession } from "@/lib/auth/session";
import { adminManualHomeSections, buildAdminManualPage, type ManualHomeCard } from "@/lib/domain/admin-manual";

export const dynamic = "force-dynamic";

function ManualCard({ card, availableShared }: { card: ManualHomeCard; availableShared: Set<string> }) {
  if (card.origin === "shared" && !availableShared.has(card.slug)) {
    return (
      <div className="manual-card manual-card-missing">
        <h3>{card.label}</h3>
        <p>{card.summary}</p>
        <p className="manual-card-note">
          공용 원본을 아직 찾지 못했습니다. working-method를 이 저장소와 같은 부모 폴더에 클론하면 여기서 열립니다.
        </p>
        <p className="manual-card-source">{card.source}</p>
      </div>
    );
  }

  return (
    <Link className="manual-card" href={card.href}>
      <h3>{card.label}</h3>
      <p>{card.summary}</p>
      <p className="manual-card-source">{card.source}</p>
    </Link>
  );
}

export default async function AdminManualHomePage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");

  let source: ReturnType<typeof readAdminManualSource>;
  try {
    source = readAdminManualSource();
  } catch {
    notFound();
  }
  const availableShared = availableSharedManualSlugs();
  const page = buildAdminManualPage({ ...source, title: "매뉴얼", markdown: "" });

  return (
    <AdminManualFrame
      deployCommit={page.deployCommit}
      deployVersion={page.deployVersion}
      home
      intro="필요한 칸을 고르면 저장소 원본이 열립니다. 이 화면은 입구이고, 규칙과 설명의 정본은 git 파일입니다."
      manualCommit={page.manualCommit}
      title={page.title}
    >
      {adminManualHomeSections.map((section) => (
        <section aria-label={section.title} className="manual-home-section" key={section.title}>
          <h2>{section.title}</h2>
          <p className="manual-home-lede">{section.description}</p>
          <div className="manual-home-grid">
            {section.cards.map((card) => (
              <ManualCard availableShared={availableShared} card={card} key={card.href} />
            ))}
          </div>
        </section>
      ))}
    </AdminManualFrame>
  );
}
