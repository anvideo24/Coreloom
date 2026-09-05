import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { VerificationCheckTable, VerificationFeatureList } from "@/components/verification-sections";
import { changedPathsSince, readVerificationStatus } from "@/lib/admin-manual/verification";
import { gitOutput, repositoryRoot } from "@/lib/admin-manual/repository";
import { VERIFICATION_PLAN_FILE, VERIFICATION_RESULTS_FILE } from "@/lib/domain/verification-plan";

/**
 * 도메인 시험(verification-plan.test.ts)은 함수 단위다. 여기는 **실제 계획서·실제 결과 파일**을
 * 읽기 계층으로 끝까지 통과시키고, 화면 부품이 그 결과를 빠짐없이 그리는지 본다.
 * 브라우저·로그인은 없다. 실제 화면 확인은 대표가 개발 PC에서 한다(F07-01·05·06).
 */

const REPO_ROOT = resolve(__dirname, "../../..");

describe("개선 목표·검증 현황 — 실제 파일 끝까지", () => {
  const status = readVerificationStatus();

  it("실제 계획·결과 파일을 읽어 기능 7개를 돌려준다", () => {
    expect(status.available, status.available ? "" : status.message).toBe(true);
    if (!status.available) return;
    expect(status.plan.features.map((feature) => feature.id)).toEqual(["F01", "F02", "F03", "F04", "F05", "F06", "F07"]);
    expect(status.gitAvailable).toBe(true);
    expect(status.statuses.find((item) => item.feature.id === "F07")?.implementation?.stage).toBe("in-progress");
  });

  it("F07-02: 화면에 그려지는 검사 ID 집합이 계획서 ID 집합과 같다(결과 없는 검사 포함)", () => {
    if (!status.available) throw new Error(status.message);
    const planIds = status.plan.features.flatMap((feature) => feature.checks.map((check) => check.id));
    expect(planIds).toHaveLength(28);

    const html = status.statuses
      .map((item) => renderToStaticMarkup(<VerificationCheckTable checks={item.checks} />))
      .join("\n");
    const cell = (id: string) => new RegExp(`<td[^>]*>${id}</td>`);
    const missing = planIds.filter((id) => !cell(id).test(html) || !html.includes(`<h4>${id}</h4>`));
    expect(missing, "표(PC)와 카드(좁은 화면) 양쪽에 다 나와야 한다").toEqual([]);
    // 결과 없는 검사도 줄로 남는다.
    expect(html).toContain("결과 없음");
  });

  it("F07-01: 기능 목록의 링크가 각 기능 상세로 곧장 간다(한 번 클릭)", () => {
    if (!status.available) throw new Error(status.message);
    const html = renderToStaticMarkup(<VerificationFeatureList statuses={status.statuses} />);
    for (const feature of status.plan.features) {
      expect(html).toContain(`href="/admin/manual/progress/${feature.id}"`);
    }
  });

  it("기준 측정에서 재현된 실패 4건이 실패로 보이고, 통과로 세지 않는다", () => {
    if (!status.available) throw new Error(status.message);
    const f05 = status.statuses.find((item) => item.feature.id === "F05");
    expect(f05?.counts).toMatchObject({ pass: 0, fail: 3, none: 1, required: 4 });
    expect(f05?.nextAction).toBe("결과 없음 1건 측정");
    const f02 = status.statuses.find((item) => item.feature.id === "F02");
    expect(f02?.counts).toMatchObject({ pass: 0, fail: 1, none: 3 });
  });

  it("F07-04: 지금 HEAD 기준으로는 바뀐 파일이 없고, 없는 커밋은 null이다", () => {
    const root = repositoryRoot();
    expect(root).toBeTruthy();
    const head = gitOutput(["rev-parse", "HEAD"], root!);
    expect(changedPathsSince(head)).toEqual([]);
    expect(changedPathsSince("f".repeat(40))).toBeNull();
  });
});

describe("F07-05: 공개 산출물에 비밀이 없다", () => {
  const files = [
    VERIFICATION_PLAN_FILE,
    VERIFICATION_RESULTS_FILE,
    "docs/quality/baseline-2026-09-05.md",
    "manual/handoffs/2026-09-05-claude-measurable-improvements.md",
  ];
  const patterns: { name: string; pattern: RegExp }[] = [
    { name: "이메일", pattern: /[\w.+-]+@[\w-]+\.[\w.-]+/ },
    { name: "Funnel·tailnet 주소", pattern: /\.ts\.net\b/i },
    { name: "IPv4 주소", pattern: /\b\d{1,3}(?:\.\d{1,3}){3}\b/ },
    { name: "연결 문자열", pattern: /postgres(?:ql)?:\/\/|sk-[A-Za-z0-9]{10,}/ },
    { name: "github 아닌 절대 주소", pattern: /https?:\/\/(?!github\.com\/)[^\s)]+/ },
  ];

  for (const file of files) {
    it(`${file}`, () => {
      const text = readFileSync(resolve(REPO_ROOT, file), "utf8");
      const hits = patterns.filter(({ pattern }) => pattern.test(text)).map(({ name }) => name);
      expect(hits).toEqual([]);
    });
  }
});
