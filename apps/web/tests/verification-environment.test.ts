import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VerificationCheckTable } from "@/components/verification-sections";
import {
  buildVerificationStatus, parseVerificationPlan, parseVerificationResults,
} from "@/lib/domain/verification-plan";

const markdown = [
  "계획 버전: 2 · 작성일: 2026-09-05", "",
  "## F09 · 환경 관문 시험", "", "목표: 다른 환경으로 통과시키지 않는다.", "",
  "| 완료 | ID | 목표·통과 기준 | 검증 방법 | 현재 판정 | 필수 검증 환경 |",
  "|---|---|---|---|---|---|",
  "| ☐ | F09-01 | 주요 조작 가림 0건 | PC와 실제 Fold 확인 | 미검증 | PC 브라우저, 실제 폴드 접힘, 실제 폴드 펼침 |",
].join("\n");

function result(environments?: string[]) {
  return {
    checkId: "F09-01", outcome: "pass", value: "가림 0건",
    evidence: { kind: "automated", ref: "tests/verification-environment.test.ts", checkedAt: "2026-09-06" },
    codeCommit: "a".repeat(40), planVersion: 2,
    environment: "가상 환경 관문 fixture (실제 기기 측정 아님)",
    ...(environments === undefined ? {} : { environments }),
  };
}

function evaluate(environments?: string[], source = markdown) {
  const plan = parseVerificationPlan(source);
  const file = parseVerificationResults(JSON.stringify({ schemaVersion: 1, implementation: [], results: [result(environments)] }));
  return buildVerificationStatus({ plan, file, changedPathsSince: () => [] })[0];
}

describe("F07-03 필수 환경 관문 — 전부 가상 증거", () => {
  it("옛 자유서술 환경 기록은 읽되 통과로 세지 않는다", () => {
    const status = evaluate();
    expect(status.checks[0].effective).toBe("unverified");
    expect(status.checks[0].reason).toContain("검증 환경 미달");
    expect(status.counts.pass).toBe(0);
    expect(status.checks[0].history).toHaveLength(1);
  });

  it.each([
    [], ["PC 브라우저"], ["PC 브라우저", "실제 폴드 접힘"],
    ["PC 브라우저", "폴드 폭 에뮬레이션"],
    ["PC 브라우저", "PC 브라우저", "PC 브라우저"],
  ].map((environments) => [environments]))("빈 환경·다른 환경·일부 환경·에뮬레이션·중복으로 통과하지 않는다: %j", (environments) => {
    const status = evaluate(environments);
    expect(status.checks[0].effective).toBe("unverified");
    expect(status.counts.pass).toBe(0);
  });

  it("순서와 관계없이 요구한 모든 환경을 측정했을 때만 통과한다", () => {
    expect(evaluate(["실제 폴드 펼침", "PC 브라우저", "실제 폴드 접힘"]).counts.pass).toBe(1);
  });

  it("계획에 환경 조건이 없으면 통과하지 않는다", () => {
    const legacyPlan = markdown.replaceAll(" | 필수 검증 환경", "").replaceAll("|---|---|---|---|---|---|", "|---|---|---|---|---|")
      .replace(" | PC 브라우저, 실제 폴드 접힘, 실제 폴드 펼침", "");
    expect(evaluate(["PC 브라우저"], legacyPlan).checks[0].reason).toContain("계획의 필수 검증 환경 없음");
  });

  it("환경이 맞아도 결과 없음·실패·증거 없음·다른 버전은 통과하지 않는다", () => {
    const plan = parseVerificationPlan(markdown);
    const valid = result(["PC 브라우저", "실제 폴드 접힘", "실제 폴드 펼침"]);
    for (const results of [[], [{ ...valid, outcome: "fail" }], [{ ...valid, planVersion: 1 }]]) {
      const file = parseVerificationResults(JSON.stringify({ schemaVersion: 1, implementation: [], results }));
      expect(buildVerificationStatus({ plan, file, changedPathsSince: () => [] })[0].counts.pass).toBe(0);
    }
    expect(() => parseVerificationResults(JSON.stringify({ schemaVersion: 1, implementation: [], results: [
      { ...valid, evidence: { ...valid.evidence, ref: "" } },
    ] }))).toThrow();
  });

  it("PC 표와 모바일 카드 모두 환경 미달 사유를 보여준다", () => {
    const status = evaluate(["PC 브라우저"]);
    const html = renderToStaticMarkup(createElement(VerificationCheckTable, { checks: status.checks }));
    expect(html.match(/검증 환경 미달: 실제 폴드 접힘 · 실제 폴드 펼침/g)).toHaveLength(2);
    expect(html.match(/미검증/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("실제 계획의 모든 28개 검사에 환경 조건이 있고 Fold 검사는 PC 증거만으로 통과하지 않는다", () => {
    const plan = parseVerificationPlan(readFileSync(resolve(__dirname, "../../../docs/superpowers/plans/2026-09-05-measurable-improvements.md"), "utf8"));
    for (const check of plan.features.flatMap((feature) => feature.checks)) {
      expect(check.requiredEnvironments.length, check.id).toBeGreaterThan(0);
    }
    const file = parseVerificationResults(JSON.stringify({ schemaVersion: 1, implementation: [], results: [{ ...result(["PC 브라우저"]), checkId: "F07-06" }] }));
    const status = buildVerificationStatus({ plan, file, changedPathsSince: () => [] }).find((feature) => feature.feature.id === "F07")!;
    expect(status.checks.find((check) => check.check.id === "F07-06")?.effective).toBe("unverified");
    expect(status.counts.pass).toBe(0);
  });
});
