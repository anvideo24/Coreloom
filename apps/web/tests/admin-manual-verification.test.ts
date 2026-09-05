import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { CHECK_ID_PATTERN, FEATURE_ID_PATTERN, VERIFICATION_PLAN_FILE, VERIFICATION_RESULTS_FILE } from "@/lib/domain/verification-plan";
import { changedPathsSince, readVerificationStatus } from "@/lib/admin-manual/verification";

/**
 * 이 파일이 시험하는 것은 읽기 계층(`readVerificationStatus`·`changedPathsSince`)이
 * 파일 없음·파싱 실패를 throw 없이 이유로 돌려주는가다. `verification-plan.ts`의
 * `parseVerificationPlan`·`parseVerificationResults`·`buildVerificationStatus`는 지금
 * `not implemented`로 스텁이라 실제 통과 판정 시나리오(정상 파싱 → 상태 계산)는 넣지 않는다.
 * 스텁이 채워지면 통합 시험은 이 파일을 만든 사람이 아니라 도메인 구현자가 추가한다.
 */

function makeTempRoot() {
  return mkdtempSync(resolve(tmpdir(), "coreloom-verification-"));
}

/** VERIFICATION_PLAN_FILE·VERIFICATION_RESULTS_FILE은 저장소 뿌리 기준 중첩 경로라 폴더부터 만든다. */
function writeNested(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

describe("readVerificationStatus — file presence", () => {
  it("reports no-plan instead of throwing when the plan file is missing", () => {
    const root = makeTempRoot();
    try {
      const status = readVerificationStatus(root);
      expect(status.available).toBe(false);
      if (status.available) throw new Error("unreachable");
      expect(status.reason).toBe("no-plan");
      expect(status.message).toContain(VERIFICATION_PLAN_FILE);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("reports no-results instead of throwing when the plan exists but the results file is missing", () => {
    const root = makeTempRoot();
    try {
      writeNested(resolve(root, VERIFICATION_PLAN_FILE), "계획 버전: 1\n작성일: 2026-01-01\n");
      const status = readVerificationStatus(root);
      expect(status.available).toBe(false);
      if (status.available) throw new Error("unreachable");
      expect(status.reason).toBe("no-results");
      expect(status.message).toContain(VERIFICATION_RESULTS_FILE);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("reports invalid instead of throwing when the plan markdown fails the documented rules", () => {
    const root = makeTempRoot();
    try {
      // 기능 ID가 겹치면 throw하는 게 정본 규칙(F07-03 정본 주석)이다 — 스텁이든 실제 구현이든
      // 이 입력은 항상 잘못된 입력이라 이 시험은 구현이 채워진 뒤에도 그대로 유효하다.
      writeNested(
        resolve(root, VERIFICATION_PLAN_FILE),
        [
          "계획 버전: 1",
          "작성일: 2026-01-01",
          "",
          "## F01 · 중복 기능 하나",
          "",
          "목표: 예시",
          "",
          "## F01 · 중복 기능 둘",
          "",
          "목표: 예시",
        ].join("\n"),
      );
      writeNested(resolve(root, VERIFICATION_RESULTS_FILE), JSON.stringify({ schemaVersion: 1, implementation: [], results: [] }));
      const status = readVerificationStatus(root);
      expect(status.available).toBe(false);
      if (status.available) throw new Error("unreachable");
      expect(status.reason).toBe("invalid");
      expect(status.message.length).toBeGreaterThan(0);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("reports invalid instead of throwing when the results JSON fails the documented rules", () => {
    const root = makeTempRoot();
    try {
      writeNested(resolve(root, VERIFICATION_PLAN_FILE), "계획 버전: 1\n작성일: 2026-01-01\n");
      // outcome이 pass인데 value·evidence.ref·environment가 비어 있다 — 정본 주석이 명시적으로
      // throw 대상으로 문서화한 자리라, 스텁 이후에도 계속 무효한 입력이다.
      writeNested(
        resolve(root, VERIFICATION_RESULTS_FILE),
        JSON.stringify({
          schemaVersion: 1,
          implementation: [],
          results: [
            {
              checkId: "F01-01",
              outcome: "pass",
              value: "",
              evidence: { kind: "human", ref: "", checkedAt: "2026-01-01" },
              codeCommit: "0".repeat(40),
              planVersion: 1,
              environment: "",
            },
          ],
        }),
      );
      const status = readVerificationStatus(root);
      expect(status.available).toBe(false);
      if (status.available) throw new Error("unreachable");
      expect(status.reason).toBe("invalid");
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });
});

describe("changedPathsSince", () => {
  it("returns null for a commit this repository doesn't have", () => {
    expect(changedPathsSince("0".repeat(40))).toBeNull();
  });

  it("returns null for an empty commit reference", () => {
    expect(changedPathsSince("")).toBeNull();
    expect(changedPathsSince("   ")).toBeNull();
  });

  it("returns null when the root itself isn't a git repository", () => {
    const root = makeTempRoot();
    try {
      expect(changedPathsSince("0".repeat(40), root)).toBeNull();
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });
});

describe("feature and check id patterns used for route validation", () => {
  it("accepts only the documented feature id shape", () => {
    expect(FEATURE_ID_PATTERN.test("F01")).toBe(true);
    expect(FEATURE_ID_PATTERN.test("F07")).toBe(true);
    expect(FEATURE_ID_PATTERN.test("F1")).toBe(false);
    expect(FEATURE_ID_PATTERN.test("F01-01")).toBe(false);
    expect(FEATURE_ID_PATTERN.test("../secret")).toBe(false);
    expect(FEATURE_ID_PATTERN.test("")).toBe(false);
  });

  it("accepts only the documented check id shape", () => {
    expect(CHECK_ID_PATTERN.test("F01-01")).toBe(true);
    expect(CHECK_ID_PATTERN.test("F07-06")).toBe(true);
    expect(CHECK_ID_PATTERN.test("F01")).toBe(false);
    expect(CHECK_ID_PATTERN.test("F01-1")).toBe(false);
  });
});
