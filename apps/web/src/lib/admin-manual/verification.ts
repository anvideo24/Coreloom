import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import "server-only";

import { gitOutput, readAdminManualSource, repositoryRoot } from "@/lib/admin-manual/repository";
import {
  buildVerificationStatus,
  parseVerificationPlan,
  parseVerificationResults,
  VERIFICATION_PLAN_FILE,
  VERIFICATION_RESULTS_FILE,
  type FeatureStatus,
  type VerificationPlan,
} from "@/lib/domain/verification-plan";

export type VerificationStatus =
  | {
      available: true;
      directory: string;
      deployVersion: string;
      deployCommit: string;
      manualCommit: string;
      plan: VerificationPlan;
      statuses: FeatureStatus[];
      planCommit: string;
      resultsCommit: string;
      /**
       * 이 자리에 git 이력이 있나. 배포본처럼 `.git`이 없으면 관련 변경을 판정할 수 없어
       * 모든 통과가 「재검증 필요」로 보인다. 화면이 그 이유를 밝혀야 하므로 따로 알린다.
       */
      gitAvailable: boolean;
    }
  | {
      available: false;
      reason: "no-plan" | "no-results" | "invalid";
      message: string;
    };

/**
 * `git cat-file -e`는 존재 여부만 알려 준다(성공해도 표준출력이 비어 있다).
 * `gitOutput`은 stdout으로 성공/실패를 가르는 도구라 이 확인에는 못 쓴다 — 그래서 여기서만
 * 종료 코드를 직접 본다. gitRoot/repositoryRoot/gitOutput 자체는 새로 만들지 않고 그대로 재사용한다.
 */
function commitExists(commit: string, root: string): boolean {
  try {
    execFileSync("git", ["cat-file", "-e", commit], { cwd: root, stdio: ["ignore", "ignore", "ignore"] });
    return true;
  } catch {
    return false;
  }
}

/**
 * `commit` 이후 저장소 뿌리 기준으로 바뀐 경로. 커밋을 이 저장소에서 못 찾으면 null —
 * 판정 규칙(F07-03·F07-04)이 null을 「검증 코드 버전을 찾지 못함」으로 보수적으로 읽는다.
 */
export function changedPathsSince(commit: string, root?: string): string[] | null {
  const trimmed = commit.trim();
  if (!trimmed) return null;
  const base = root ?? repositoryRoot();
  if (!base) return null;
  if (!commitExists(trimmed, base)) return null;
  const output = gitOutput(["diff", "--name-only", trimmed, "HEAD"], base);
  if (!output) return [];
  return output
    .split("\n")
    .map((path) => path.trim())
    .filter(Boolean)
    .map((path) => path.replaceAll("\\", "/"));
}

function lastCommitFor(relativeFile: string, root: string): string {
  return gitOutput(["log", "-1", "--format=%H", "--", relativeFile], root);
}

/**
 * 개선 목표·검증 현황을 읽는다. 계획·결과 파일이 없거나 파싱이 던지면 그 이유를 돌려줄 뿐,
 * 절대 throw하지 않는다 — 던지면 화면이 빈 채로 죽는다.
 */
export function readVerificationStatus(root?: string): VerificationStatus {
  const base = root ?? repositoryRoot();
  if (!base) {
    return {
      available: false,
      reason: "no-plan",
      message: `저장소 뿌리를 찾지 못해 ${VERIFICATION_PLAN_FILE}을 읽을 수 없습니다.`,
    };
  }

  const planPath = resolve(base, VERIFICATION_PLAN_FILE);
  if (!existsSync(planPath)) {
    return {
      available: false,
      reason: "no-plan",
      message: `계획 파일을 찾지 못했습니다: ${VERIFICATION_PLAN_FILE}`,
    };
  }

  const resultsPath = resolve(base, VERIFICATION_RESULTS_FILE);
  if (!existsSync(resultsPath)) {
    return {
      available: false,
      reason: "no-results",
      message: `결과 파일을 찾지 못했습니다: ${VERIFICATION_RESULTS_FILE}`,
    };
  }

  try {
    const plan = parseVerificationPlan(readFileSync(planPath, "utf8"));
    const file = parseVerificationResults(readFileSync(resultsPath, "utf8"));
    const statuses = buildVerificationStatus({
      plan,
      file,
      changedPathsSince: (codeCommit) => changedPathsSince(codeCommit, base),
    });
    const source = readAdminManualSource();
    return {
      available: true,
      directory: source.directory,
      deployVersion: source.deployVersion,
      deployCommit: source.deployCommit,
      manualCommit: source.manualCommit,
      plan,
      statuses,
      planCommit: lastCommitFor(VERIFICATION_PLAN_FILE, base),
      resultsCommit: lastCommitFor(VERIFICATION_RESULTS_FILE, base),
      gitAvailable: gitOutput(["rev-parse", "--is-inside-work-tree"], base) === "true",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { available: false, reason: "invalid", message };
  }
}
