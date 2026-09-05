export type SystemMapNode = {
  id: string; label: string; summary: string; title: string; route: string; details: string[];
};

/** The five approved groups are content, not a live integration inventory. */
export function parseSystemMap(markdown: string): { nodes: SystemMapNode[] } {
  const tables = parseManualMarkdown(markdown).filter(block => block.type === "table");
  const ids = ["records", "files", "ai", "external", "manual"];
  const table = tables[0];
  if (tables.length !== 1 || table.headers.join("|") !== "ID|구성|요점|상세 제목|관계|설명 1|설명 2|설명 3" ||
      table.rows.length !== ids.length || table.rows.some((row, index) =>
        row.length !== 8 || row.some(cell => !cell.trim()) || row[0] !== ids[index])) {
    throw new Error("Invalid system map source");
  }
  return { nodes: table.rows.map(([id, label, summary, title, route, ...details]) =>
    ({ id, label, summary, title, route, details })) };
}
import { parseManualMarkdown } from "@/lib/domain/admin-manual";
