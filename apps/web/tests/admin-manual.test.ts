import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ADMIN_MANUAL_OVERVIEW_HREF,
  adminManualHomeSections,
  assertManualRelativePath,
  buildAdminManualPage,
  listRoleManuals,
  parseManualMarkdown,
  resolveManualHref,
  roleManualFile,
  sharedManualDoc,
  shortenCommit,
} from "@/lib/domain/admin-manual";
import {
  availableSharedManualSlugs,
  readAdminManualOverview,
  readAdminManualProgress,
  readCoreloomRules,
  readSharedManual,
} from "@/lib/admin-manual/repository";

describe("admin manual catalog", () => {
  it("allows only markdown files inside the manual folder", () => {
    expect(assertManualRelativePath("00-coreloom-매뉴얼.md")).toBe("00-coreloom-매뉴얼.md");
    expect(assertManualRelativePath("roles/대표.md")).toBe("roles/대표.md");
    expect(() => assertManualRelativePath("../RULES.md")).toThrow("Manual path is not allowed");
    expect(() => assertManualRelativePath("roles/../CHANGELOG.md")).toThrow("Manual path is not allowed");
    expect(() => assertManualRelativePath("/etc/passwd")).toThrow("Manual path is not allowed");
    expect(() => assertManualRelativePath("notes.txt")).toThrow("Manual path is not allowed");
  });

  it("lists role manuals without copying the overview", () => {
    expect(listRoleManuals(["대표.md", ".hidden.md", "skip.txt"])).toEqual([
      { slug: "대표", title: "대표", href: `/admin/manual/roles/${encodeURIComponent("대표")}`, file: "roles/대표.md" },
    ]);
    expect(roleManualFile("대표")).toBe("roles/대표.md");
    expect(() => roleManualFile("../secret")).toThrow("Unknown manual");
  });
});

describe("admin manual rendering", () => {
  it("keeps headings, lists, and safe links from the markdown source", () => {
    const blocks = parseManualMarkdown([
      "# 운영 매뉴얼",
      "",
      "정본은 [운영 매뉴얼](../00-coreloom-매뉴얼.md)이다.",
      "",
      "- 읽기 전용",
      "- **복사하지 않음**",
      "",
      "자세한 범위는 [docs/mvp-scope.md](../docs/mvp-scope.md)를 따른다.",
      "",
      "> 화면에서 편집하지 않는다.",
      "",
      "```",
      "<script>alert(1)</script>",
      "```",
    ].join("\n"));

    expect(blocks[0]).toEqual({ type: "heading", level: 1, text: "운영 매뉴얼" });
    expect(blocks[1]).toMatchObject({
      type: "paragraph",
      inlines: [
        { type: "text", text: "정본은 " },
        { type: "link", text: "운영 매뉴얼", href: ADMIN_MANUAL_OVERVIEW_HREF },
        { type: "text", text: "이다." },
      ],
    });
    expect(blocks[2]).toMatchObject({
      type: "list",
      ordered: false,
      items: [
        [{ type: "text", text: "읽기 전용" }],
        [{ type: "strong", text: "복사하지 않음" }],
      ],
    });
    expect(resolveManualHref("../docs/mvp-scope.md")).toBeNull();
    expect(resolveManualHref("javascript:alert(1)")).toBeNull();
    expect(blocks.some((block) => block.type === "code" && block.text.includes("<script>"))).toBe(true);
  });

  it("shows deploy version and the manual source commit", () => {
    const page = buildAdminManualPage({
      title: "변경 기록",
      markdown: "## 2026-09-03\n\n- 관리자 매뉴얼 화면을 추가했습니다.",
      deployVersion: "0.1.0",
      deployCommit: "abcdefghijklmnopqrstuvwxyz",
      manualCommit: "1234567890ab",
    });
    expect(page).toMatchObject({
      title: "변경 기록",
      readOnly: true,
      deployVersion: "0.1.0",
      deployCommit: "abcdefghijkl",
      manualCommit: "1234567890ab",
    });
    expect(shortenCommit("")).toBe("없음");
  });
});

describe("admin manual table parsing", () => {
  it("parses a markdown table into headers and rows", () => {
    const blocks = parseManualMarkdown([
      "| 기능 | 상태 |",
      "| --- | --- |",
      "| 대시보드 | 완료 |",
      "| 환불 | 미착수 |",
    ].join("\n"));
    expect(blocks[0]).toEqual({ type: "table", headers: ["기능", "상태"], rows: [["대시보드", "완료"], ["환불", "미착수"]] });
  });
});

describe("admin manual source files", () => {
  it("reads the overview markdown from the repository original", () => {
    const source = readAdminManualOverview();
    expect(source.markdown).toContain("# Coreloom 운영 매뉴얼");
    expect(source.markdown).toContain("/admin/manual");
    expect(source.deployVersion).toMatch(/\d+\.\d+\.\d+/);
    expect(source.manualCommit.length).toBeGreaterThan(0);
  });

  it("reads the system progress tracking page", () => {
    const source = readAdminManualProgress();
    expect(source.markdown).toContain("시스템 구성 진행 현황");
    expect(source.markdown).toContain("완료");
  });

  it("reads the product rules from the repository root, not from manual/", () => {
    const source = readCoreloomRules();
    expect(source.markdown).toContain("# Coreloom 운영 규칙");
    expect(source.markdown).toContain("working-method");
  });
});

describe("admin manual category home", () => {
  it("offers every category as an entry card instead of one long document", () => {
    const cards = adminManualHomeSections.flatMap((section) => section.cards);
    expect(adminManualHomeSections.map((section) => section.title)).toEqual(["규칙", "일하는 방식", "운영"]);
    expect(cards.map((card) => card.href)).toEqual([
      "/admin/manual/shared/rules",
      "/admin/manual/rules",
      "/admin/manual/shared/how",
      "/admin/manual/shared/lessons",
      "/admin/manual/work-map",
      ADMIN_MANUAL_OVERVIEW_HREF,
      "/admin/manual/progress",
      "/admin/manual/roles",
      "/admin/manual/changelog",
    ]);
    expect(cards.every((card) => card.summary.length > 0 && card.source.length > 0)).toBe(true);
    expect(cards.filter((card) => card.origin === "shared").map((card) => card.source)).toEqual([
      "working-method / RULES.md",
      "working-method / HOW.md",
      "working-method / LESSONS.md",
    ]);
  });

  it("reads only the three allowed shared documents", () => {
    expect(sharedManualDoc("rules").file).toBe("RULES.md");
    expect(sharedManualDoc("how").file).toBe("HOW.md");
    expect(sharedManualDoc("lessons").file).toBe("LESSONS.md");
    expect(() => sharedManualDoc("../RULES")).toThrow("Unknown manual");
    expect(() => sharedManualDoc("README")).toThrow("Unknown manual");
  });

  it("says the shared repository is missing instead of showing an empty page", () => {
    const previous = process.env.CORELOOM_WORKING_METHOD_DIR;
    process.env.CORELOOM_WORKING_METHOD_DIR = resolve(tmpdir(), "coreloom-working-method-absent");
    try {
      const source = readSharedManual("rules");
      expect(source.available).toBe(false);
      expect(source.reason).toBe("no-repository");
      expect(source.markdown).toBe("");
      expect(buildAdminManualPage(source).blocks).toEqual([]);
      expect(availableSharedManualSlugs().size).toBe(0);
      expect(source.file).toBe("RULES.md");
      expect(source.title).toBe("공용 규칙");
    } finally {
      if (previous === undefined) delete process.env.CORELOOM_WORKING_METHOD_DIR;
      else process.env.CORELOOM_WORKING_METHOD_DIR = previous;
    }
  });

  it("tells a missing file apart from a missing repository", () => {
    const previous = process.env.CORELOOM_WORKING_METHOD_DIR;
    const directory = mkdtempSync(resolve(tmpdir(), "coreloom-shared-"));
    writeFileSync(resolve(directory, "RULES.md"), "# 공용 제품 규칙\n", "utf8");
    process.env.CORELOOM_WORKING_METHOD_DIR = directory;
    try {
      expect(readSharedManual("rules").available).toBe(true);
      const missingFile = readSharedManual("how");
      expect(missingFile.available).toBe(false);
      expect(missingFile.reason).toBe("no-file");
      // 홈은 파일 단위로 센다. 저장소만 보고 판정하면 「링크는 보이는데 눌러 보면 없다」가 된다.
      expect([...availableSharedManualSlugs()]).toEqual(["rules"]);
    } finally {
      rmSync(directory, { force: true, recursive: true });
      if (previous === undefined) delete process.env.CORELOOM_WORKING_METHOD_DIR;
      else process.env.CORELOOM_WORKING_METHOD_DIR = previous;
    }
  });

  it("renders the indented numbered list in the product rules as a real list", () => {
    const blocks = buildAdminManualPage(readCoreloomRules()).blocks;
    const lists = blocks.filter((block) => block.type === "list" && block.ordered);
    const exposure = lists.find((block) => block.type === "list" && block.items.length >= 9);
    expect(exposure, "RULES.md의 노출 목록 9개가 목록으로 안 잡혔다").toBeTruthy();
    // 들여 쓴 항목이 앞 문단에 뭉쳐 붙지 않았는지 — 조용히 한 줄로 뭉치던 자리다.
    const runOn = blocks.some(
      (block) => block.type === "paragraph"
        && block.inlines.some((inline) => inline.text.includes("2. 일하는 방식")),
    );
    expect(runOn, "들여 쓴 목록이 문단으로 뭉쳤다").toBe(false);
  });
});
