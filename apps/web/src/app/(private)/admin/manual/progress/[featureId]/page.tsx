import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminManualFrame, ManualBlocks } from "@/components/admin-manual-frame";
import { VerificationCheckTable } from "@/components/verification-sections";
import { readVerificationStatus } from "@/lib/admin-manual/verification";
import { founderSession } from "@/lib/auth/session";
import { ADMIN_MANUAL_HOME_HREF } from "@/lib/domain/admin-manual";
import {
  FEATURE_ID_PATTERN,
  stageLabel,
  VERIFICATION_HREF,
  VERIFICATION_PLAN_FILE,
  VERIFICATION_RESULTS_FILE,
} from "@/lib/domain/verification-plan";

export const dynamic = "force-dynamic";

function BackToVerification() {
  return (
    <nav aria-label="검증 현황 위치" className="verification-detail-nav">
      <Link className="verification-link" href={VERIFICATION_HREF}>개선 목표·검증 현황으로</Link>
    </nav>
  );
}

export default async function AdminManualFeatureVerificationPage({
  params,
}: {
  params: Promise<{ featureId: string }>;
}) {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");

  const { featureId: rawFeatureId } = await params;
  let featureId: string;
  try {
    featureId = decodeURIComponent(rawFeatureId);
  } catch {
    // 잘못 인코딩된 주소(`%E0%A4%A` 같은 것)는 500이 아니라 「없는 페이지」다.
    notFound();
  }
  if (!FEATURE_ID_PATTERN.test(featureId)) notFound();

  const verification = readVerificationStatus();

  if (!verification.available) {
    return (
      <AdminManualFrame
        deployCommit="없음"
        deployVersion="없음"
        intro="개선 목표·검증 현황을 읽지 못했습니다."
        manualCommit="없음"
        title={featureId}
      >
        <BackToVerification />
        <p className="verification-note">{verification.message}</p>
        {verification.reason === "no-plan" ? <p>계획 원본은 저장소 뿌리의 {VERIFICATION_PLAN_FILE}입니다.</p> : null}
        {verification.reason === "no-results" ? <p>결과 원본은 저장소 뿌리의 {VERIFICATION_RESULTS_FILE}입니다.</p> : null}
        {verification.reason === "invalid" ? <p>계획 또는 결과 원본의 형식이 정본 규칙과 어긋납니다.</p> : null}
      </AdminManualFrame>
    );
  }

  const status = verification.statuses.find((item) => item.feature.id === featureId);
  if (!status) notFound();

  // 절 원문의 첫 블록은 `## F05 · 이름` 제목이다. 화면 제목으로 이미 올렸으니 본문에서 한 번 더 찍지 않는다.
  // 원문의 검사 표도 뺀다. 아래 검사 표가 같은 행을 현재 상태까지 붙여 보여 주므로 두 번 말하는 셈이고,
  // 좁은 화면에서는 5열 표가 글자를 세로로 쪼갠다(360px 실측).
  const body = status.feature.blocks.filter((block, index) => !(index === 0 && block.type === "heading") && block.type !== "table");

  return (
    <AdminManualFrame
      deployCommit={verification.deployCommit}
      deployVersion={verification.deployVersion}
      intro={`구현 단계 · ${stageLabel(status.implementation?.stage ?? null)}`}
      manualCommit={verification.manualCommit}
      sourceLabel={VERIFICATION_PLAN_FILE}
      title={`${status.feature.id} · ${status.feature.name}`}
    >
      <BackToVerification />
      <ManualBlocks blocks={body} />
      <h3>검사 표</h3>
      <p className="verification-note">
        「계획 v1 당시 판정」은 계획서에 적힌 그때 값이고, 「현재 상태」는 결과 파일에서 계산한 지금 값입니다.
        결과 없는 검사도 줄로 남깁니다.
        {verification.gitAvailable ? null : " 이 자리에는 git 이력이 없어 관련 파일 변경을 판정하지 못하며, 통과는 전부 재검증 필요로 보입니다."}
      </p>
      <VerificationCheckTable checks={status.checks} />
    </AdminManualFrame>
  );
}
