import { notFound, redirect } from "next/navigation";

import { AdminManualFrame, ManualBlocks } from "@/components/admin-manual-frame";
import { VerificationFeatureList } from "@/components/verification-sections";
import { readAdminManualProgress } from "@/lib/admin-manual/repository";
import { readVerificationStatus } from "@/lib/admin-manual/verification";
import { founderSession } from "@/lib/auth/session";
import { buildAdminManualPage, shortenCommit } from "@/lib/domain/admin-manual";
import { VERIFICATION_PLAN_FILE, VERIFICATION_RESULTS_FILE } from "@/lib/domain/verification-plan";

export const dynamic = "force-dynamic";

function VerificationUnavailable({
  reason,
  message,
}: {
  reason: "no-plan" | "no-results" | "invalid";
  message: string;
}) {
  return (
    <div className="verification-section">
      <p className="verification-note">{message}</p>
      {reason === "no-plan" ? <p>계획 원본은 저장소 뿌리의 {VERIFICATION_PLAN_FILE}입니다.</p> : null}
      {reason === "no-results" ? <p>결과 원본은 저장소 뿌리의 {VERIFICATION_RESULTS_FILE}입니다.</p> : null}
      {reason === "invalid" ? <p>계획 또는 결과 원본의 형식이 정본 규칙과 어긋납니다.</p> : null}
    </div>
  );
}

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
  const verification = readVerificationStatus();

  return (
    <AdminManualFrame
      deployCommit={page.deployCommit}
      deployVersion={page.deployVersion}
      intro="위는 기능별 개선 목표와 검증 현황, 아래는 기능별 구현 현황 표입니다. 둘은 다른 것입니다. 통과 수는 검사 현황이지 개발 완료율이 아니고, 구현 현황 표의 「완료」를 검증 통과로 읽지 않습니다."
      manualCommit={page.manualCommit}
      sourceLabel="manual/system-progress.md"
      title={page.title}
    >
      <section aria-label="개선 목표·검증 현황" className="verification-section">
        <h2>개선 목표·검증 현황</h2>
        {verification.available ? (
          <>
            <p className="verification-note">
              계획 원본 커밋 {shortenCommit(verification.planCommit)} · 결과 원본 커밋 {shortenCommit(verification.resultsCommit)} · 계획 버전 {verification.plan.version}
              {verification.gitAvailable ? "" : " · 이 자리에는 git 이력이 없어 관련 파일 변경을 판정하지 못하며, 통과는 전부 재검증 필요로 보입니다."}
            </p>
            <VerificationFeatureList statuses={verification.statuses} />
          </>
        ) : (
          <VerificationUnavailable message={verification.message} reason={verification.reason} />
        )}
      </section>

      <h2>구현 현황 표</h2>
      <ManualBlocks blocks={page.blocks} />
    </AdminManualFrame>
  );
}
