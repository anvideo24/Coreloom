import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSystemMap } from "@/lib/domain/manual-system-map";
import { resolveManualHref } from "@/lib/domain/admin-manual";

const markdown = () => readFileSync(resolve(process.cwd(), "../../manual/system-map.md"), "utf8");

describe("system map canonical source", () => {
  it("reads the five groups and all three explanations from Markdown", () => {
    const { nodes } = parseSystemMap(markdown());
    expect(nodes.map(node => node.id)).toEqual(["records", "files", "ai", "external", "manual"]);
    expect(nodes.every(node => node.details.length === 3)).toBe(true);
  });
  it("resolves its manual entry without linking to a raw file", () => {
    expect(resolveManualHref("system-map.md")).toBe("/admin/manual/system-map");
    expect(resolveManualHref("manual/system-map.md")).toBe("/admin/manual/system-map");
  });
  it.each([
    () => "",
    (s: string) => s.replace("| records |", "| files |"),
    (s: string) => s.replace("| ai |", "| unknown |"),
    (s: string) => s.replace("| DB에 저장 |", "|  |"),
    (s: string) => s.replace("| 설명 3 |", "| 다른 열 |"),
    (s: string) => s.split("\n").filter(line => !line.startsWith("| files |")).join("\n"),
  ])("rejects missing, malformed or incomplete content", transform => {
    expect(() => parseSystemMap(transform(markdown()))).toThrow();
  });
});
