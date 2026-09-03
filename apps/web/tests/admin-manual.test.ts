import { describe, expect, it } from "vitest";

import {
  assertManualRelativePath,
  buildAdminManualPage,
  listRoleManuals,
  parseManualMarkdown,
  resolveManualHref,
  roleManualFile,
  shortenCommit,
} from "@/lib/domain/admin-manual";
import { readAdminManualOverview, readAdminManualProgress } from "@/lib/admin-manual/repository";

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
        { type: "link", text: "운영 매뉴얼", href: "/admin/manual" },
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
});
