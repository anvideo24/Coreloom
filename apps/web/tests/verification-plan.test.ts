import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildVerificationStatus,
  parseVerificationPlan,
  parseVerificationResults,
  type VerificationResultsFile,
} from "@/lib/domain/verification-plan";

const REPO_ROOT = resolve(__dirname, "../../..");
const PLAN_PATH = resolve(REPO_ROOT, "docs/superpowers/plans/2026-09-05-measurable-improvements.md");
const RESULTS_PATH = resolve(REPO_ROOT, "docs/quality/verification-results.json");

function readPlanMarkdown() {
  return readFileSync(PLAN_PATH, "utf8");
}

function readResultsJson() {
  return readFileSync(RESULTS_PATH, "utf8");
}

describe("parseVerificationPlan — 실제 계획서", () => {
  const plan = parseVerificationPlan(readPlanMarkdown());

  it("계획 버전과 작성일을 읽는다", () => {
    expect(plan.version).toBe(1);
    expect(plan.date).toBe("2026-09-05");
  });

  it("기능 7개를 F01…F07 순서로 읽는다", () => {
    expect(plan.features.map((feature) => feature.id)).toEqual([
      "F01", "F02", "F03", "F04", "F05", "F06", "F07",
    ]);
  });

  it("검사 총 28개를 읽고 ID가 모두 고유하다", () => {
    const allIds = plan.features.flatMap((feature) => feature.checks.map((check) => check.id));
    expect(allIds).toHaveLength(28);
    expect(new Set(allIds).size).toBe(28);
  });

  it("F05.paths에 대시보드 도메인 파일이 들어 있다", () => {
    const f05 = plan.features.find((feature) => feature.id === "F05");
    expect(f05?.paths).toContain("apps/web/src/lib/domain/dashboard.ts");
  });

  it("F01.goal이 「같은 정보를」로 시작한다", () => {
    const f01 = plan.features.find((feature) => feature.id === "F01");
    expect(f01?.goal.startsWith("같은 정보를")).toBe(true);
  });
});

describe("parseVerificationResults — 실제 결과 파일", () => {
  it("파싱에 성공하고 기준 측정에서 재현된 실패 4건이 들어 있으며 F05-01은 fail이다", () => {
    const file = parseVerificationResults(readResultsJson());
    // 결과 파일은 덧붙이기만 하는 파일이라 총 건수를 못 박지 않는다. 처음 넣은 실패 4건이 남아 있는지만 본다.
    const baselineFailures = file.results.filter((result) => result.codeCommit.startsWith("866bb30") && result.outcome === "fail");
    expect(baselineFailures.map((result) => result.checkId)).toEqual(["F02-01", "F05-01", "F05-02", "F05-03"]);
    const f0501 = file.results.find((result) => result.checkId === "F05-01");
    expect(f0501?.outcome).toBe("fail");
  });
});

describe("buildVerificationStatus — 실제 계획 + 실제 결과", () => {
  const plan = parseVerificationPlan(readPlanMarkdown());
  const file = parseVerificationResults(readResultsJson());
  const statuses = buildVerificationStatus({ plan, file, changedPathsSince: () => [] });

  it("F07-02: 화면 검사 ID 집합이 계획서 ID 집합과 같고, 결과 없는 검사도 no-result로 남는다", () => {
    const planIds = new Set(plan.features.flatMap((feature) => feature.checks.map((check) => check.id)));
    const screenIds = new Set(statuses.flatMap((status) => status.checks.map((check) => check.check.id)));
    expect(screenIds).toEqual(planIds);

    const f0103 = statuses.find((status) => status.feature.id === "F01")
      ?.checks.find((check) => check.check.id === "F01-03");
    expect(f0103?.effective).toBe("no-result");
  });

  it("F01: pass 3건, none 1건", () => {
    const f01 = statuses.find((status) => status.feature.id === "F01");
    expect(f01?.counts.pass).toBe(3);
    expect(f01?.counts.fail).toBe(0);
    expect(f01?.counts.none).toBe(1);
  });

  it("F03: pass 2건, none 2건", () => {
    const f03 = statuses.find((status) => status.feature.id === "F03");
    expect(f03?.counts.pass).toBe(2);
    expect(f03?.counts.fail).toBe(0);
    expect(f03?.counts.none).toBe(2);
  });

  it("F05: pass 3건, none 1건", () => {
    const f05 = statuses.find((status) => status.feature.id === "F05");
    expect(f05?.counts.pass).toBe(3);
    expect(f05?.counts.fail).toBe(0);
    expect(f05?.counts.none).toBe(1);
  });
});

describe("buildVerificationStatus — F07-03 음성 사례(가상 데이터)", () => {
  const SYNTHETIC_PLAN_MARKDOWN = [
    "계획 버전: 1 · 작성일: 2026-09-05",
    "",
    "## F09 · 가상 기능",
    "",
    "목표: 가상 목표.",
    "",
    "후속 구현 대상: apps/web/src/lib/domain/synthetic.ts.",
    "",
    "| 완료 | ID | 목표·통과 기준 | 검증 방법 | 현재 판정 |",
    "|---|---|---|---|---|",
    "| ☐ | F09-01 | 첫 번째 가상 검사 | 가상 방법 | 미검증 |",
    "| ☐ | F09-02 | 두 번째 가상 검사 | 가상 방법 | 미검증 |",
  ].join("\n");

  function syntheticResultsFile(overrides: {
    checkId: string;
    outcome?: "pass" | "fail" | "unverified" | "excluded";
    planVersion?: number;
    environment?: string;
    note?: string;
  }): VerificationResultsFile {
    return {
      schemaVersion: 1,
      implementation: [],
      results: [
        {
          checkId: overrides.checkId,
          outcome: overrides.outcome ?? "pass",
          value: "가상 실측값",
          evidence: { kind: "automated", ref: "tests/verification-plan.test.ts", checkedAt: "2026-09-05" },
          codeCommit: "a".repeat(40),
          planVersion: overrides.planVersion ?? 1,
          environment: overrides.environment ?? "도메인 함수 직접 실행",
          note: overrides.note,
        },
      ],
    };
  }

  const plan = parseVerificationPlan(SYNTHETIC_PLAN_MARKDOWN);

  it("(a) pass인데 planVersion이 다르면 unverified + reason", () => {
    const file = syntheticResultsFile({ checkId: "F09-01", planVersion: 2 });
    const statuses = buildVerificationStatus({ plan, file, changedPathsSince: () => [] });
    const check = statuses[0].checks.find((item) => item.check.id === "F09-01");
    expect(check?.effective).toBe("unverified");
    expect(check?.reason).toContain("다른 계획 버전");
  });

  it("(b) pass인데 changedPathsSince가 null이면 needs-recheck", () => {
    const file = syntheticResultsFile({ checkId: "F09-01" });
    const statuses = buildVerificationStatus({ plan, file, changedPathsSince: () => null });
    const check = statuses[0].checks.find((item) => item.check.id === "F09-01");
    expect(check?.effective).toBe("needs-recheck");
  });

  it("(c) pass인데 environment가 빈칸이면 parseVerificationResults가 throw한다", () => {
    const json = JSON.stringify(syntheticResultsFile({ checkId: "F09-01", environment: "" }));
    expect(() => parseVerificationResults(json)).toThrow();
  });

  it("(d) fail은 fail 그대로", () => {
    const file = syntheticResultsFile({ checkId: "F09-01", outcome: "fail" });
    const statuses = buildVerificationStatus({ plan, file, changedPathsSince: () => [] });
    const check = statuses[0].checks.find((item) => item.check.id === "F09-01");
    expect(check?.effective).toBe("fail");
  });

  it("(e) excluded는 required 분모에서 빠진다", () => {
    const file = syntheticResultsFile({ checkId: "F09-01", outcome: "excluded", note: "가상 사유로 이번 단계 제외" });
    const statuses = buildVerificationStatus({ plan, file, changedPathsSince: () => [] });
    const feature = statuses[0];
    expect(feature.checks.find((item) => item.check.id === "F09-01")?.effective).toBe("excluded");
    // F09-01(excluded) 1건 + F09-02(no-result) 1건 = required는 no-result 1건만
    expect(feature.counts.required).toBe(1);
    expect(feature.counts.excluded).toBe(1);
  });

  it("(f) 계획에 없는 checkId는 throw한다", () => {
    const file = syntheticResultsFile({ checkId: "F99-01" });
    expect(() => buildVerificationStatus({ plan, file, changedPathsSince: () => [] })).toThrow();
  });
});

describe("buildVerificationStatus — F07-04 흐름(가상 데이터)", () => {
  const SYNTHETIC_PLAN_MARKDOWN = [
    "계획 버전: 1 · 작성일: 2026-09-05",
    "",
    "## F09 · 가상 기능",
    "",
    "목표: 가상 목표.",
    "",
    "후속 구현 대상: apps/web/src/lib/domain/synthetic.ts.",
    "",
    "| 완료 | ID | 목표·통과 기준 | 검증 방법 | 현재 판정 |",
    "|---|---|---|---|---|",
    "| ☐ | F09-01 | 첫 번째 가상 검사 | 가상 방법 | 미검증 |",
  ].join("\n");
  const plan = parseVerificationPlan(SYNTHETIC_PLAN_MARKDOWN);

  it("pass(커밋 A) → 관련 변경 → needs-recheck → 새 pass(커밋 B) → pass, history 2건(최신 먼저)", () => {
    const commitA = "a".repeat(40);
    const commitB = "b".repeat(40);
    const passAtCommitA = {
      checkId: "F09-01",
      outcome: "pass" as const,
      value: "1차 가상 실측값",
      evidence: { kind: "automated" as const, ref: "tests/verification-plan.test.ts", checkedAt: "2026-09-05T00:00:00Z" },
      codeCommit: commitA,
      planVersion: 1,
      environment: "도메인 함수 직접 실행",
    };

    const fileAfterFirstPass: VerificationResultsFile = {
      schemaVersion: 1,
      implementation: [],
      results: [passAtCommitA],
    };
    const relatedChange = () => ["apps/web/src/lib/domain/synthetic.ts"];
    const afterFirstPass = buildVerificationStatus({ plan, file: fileAfterFirstPass, changedPathsSince: relatedChange });
    const checkAfterFirstPass = afterFirstPass[0].checks.find((item) => item.check.id === "F09-01");
    expect(checkAfterFirstPass?.effective).toBe("needs-recheck");

    const passAtCommitB = {
      ...passAtCommitA,
      value: "2차 가상 실측값",
      evidence: { ...passAtCommitA.evidence, checkedAt: "2026-09-06T00:00:00Z" },
      codeCommit: commitB,
    };
    const fileAfterSecondPass: VerificationResultsFile = {
      schemaVersion: 1,
      implementation: [],
      results: [passAtCommitA, passAtCommitB],
    };
    const noFurtherChange = () => [] as string[];
    const afterSecondPass = buildVerificationStatus({ plan, file: fileAfterSecondPass, changedPathsSince: noFurtherChange });
    const checkAfterSecondPass = afterSecondPass[0].checks.find((item) => item.check.id === "F09-01");
    expect(checkAfterSecondPass?.effective).toBe("pass");
    expect(checkAfterSecondPass?.history).toHaveLength(2);
    expect(checkAfterSecondPass?.history[0].codeCommit).toBe(commitB);
    expect(checkAfterSecondPass?.history[1].codeCommit).toBe(commitA);
  });
});

describe("buildVerificationStatus — complete 판정(가상 데이터)", () => {
  const SYNTHETIC_PLAN_MARKDOWN = [
    "계획 버전: 1 · 작성일: 2026-09-05",
    "",
    "## F09 · 가상 기능",
    "",
    "목표: 가상 목표.",
    "",
    "후속 구현 대상: apps/web/src/lib/domain/synthetic.ts.",
    "",
    "| 완료 | ID | 목표·통과 기준 | 검증 방법 | 현재 판정 |",
    "|---|---|---|---|---|",
    "| ☐ | F09-01 | 첫 번째 가상 검사 | 가상 방법 | 미검증 |",
  ].join("\n");
  const plan = parseVerificationPlan(SYNTHETIC_PLAN_MARKDOWN);

  it("required 전부 pass여도 implementation.stage가 in-use가 아니면 complete는 false다", () => {
    const file: VerificationResultsFile = {
      schemaVersion: 1,
      implementation: [{ featureId: "F09", stage: "on-main", recordedAt: "2026-09-05" }],
      results: [
        {
          checkId: "F09-01",
          outcome: "pass",
          value: "가상 실측값",
          evidence: { kind: "automated", ref: "tests/verification-plan.test.ts", checkedAt: "2026-09-05" },
          codeCommit: "a".repeat(40),
          planVersion: 1,
          environment: "도메인 함수 직접 실행",
        },
      ],
    };
    const statuses = buildVerificationStatus({ plan, file, changedPathsSince: () => [] });
    expect(statuses[0].counts.pass).toBe(statuses[0].counts.required);
    expect(statuses[0].complete).toBe(false);
  });
});

describe("parseVerificationPlan — 중복 검사 ID", () => {
  it("검사 ID가 겹치는 계획서는 throw한다", () => {
    const duplicateIdMarkdown = [
      "계획 버전: 1 · 작성일: 2026-09-05",
      "",
      "## F09 · 가상 기능",
      "",
      "목표: 가상 목표.",
      "",
      "| 완료 | ID | 목표·통과 기준 | 검증 방법 | 현재 판정 |",
      "|---|---|---|---|---|",
      "| ☐ | F09-01 | 첫 번째 가상 검사 | 가상 방법 | 미검증 |",
      "| ☐ | F09-01 | 중복된 가상 검사 | 가상 방법 | 미검증 |",
    ].join("\n");
    expect(() => parseVerificationPlan(duplicateIdMarkdown)).toThrow();
  });

  it("기능 ID가 겹치는 계획서도 throw한다", () => {
    const duplicateFeatureMarkdown = [
      "계획 버전: 1 · 작성일: 2026-09-05",
      "",
      "## F09 · 가상 기능 A",
      "",
      "목표: 가상 목표 A.",
      "",
      "## F09 · 가상 기능 B",
      "",
      "목표: 가상 목표 B.",
    ].join("\n");
    expect(() => parseVerificationPlan(duplicateFeatureMarkdown)).toThrow();
  });
});
