import { parseManualMarkdown } from "@/lib/domain/admin-manual";

export type WorkMapStep = {
  id: string; label: string; question: string; purpose: string; record: string;
  relation: string; caution: string; href: string; linkLabel: string;
};
export type WorkMapSupport = {
  id: string; label: string; summary: string; relation: string; description: string;
  href: string; linkLabel: string;
};

const allowedDestinations = new Set([
  "/clients", "/clients-projects", "/quotes", "/contracts", "/billings",
  "/company-setup", "/documents", "/tasks", "/agents",
]);

/** Markdown is the content source; only known read-only navigation destinations are accepted. */
export function parseWorkMap(markdown: string): { steps: WorkMapStep[]; supports: WorkMapSupport[] } {
  const tables = parseManualMarkdown(markdown).filter(block => block.type === "table");
  if (tables.length !== 2) throw new Error("Invalid work map source");
  const [flow, support] = tables;
  if (flow.headers.join("|") !== "ID|업무|질문|역할|남기는 것|연결|주의|화면|경로" ||
      support.headers.join("|") !== "ID|업무|요약|연결|설명|화면|경로" ||
      flow.rows.length !== 6 || support.rows.length !== 4) throw new Error("Invalid work map source");
  const ids = new Set<string>();
  for (const [rows, length] of [[flow.rows, 9], [support.rows, 7]] as const) {
    for (const row of rows) {
      if (row.length !== length || row.some(cell => !cell.trim()) ||
          !/^[a-z][a-z-]*$/.test(row[0]) || ids.has(row[0]) ||
          !allowedDestinations.has(row.at(-1)!)) throw new Error("Invalid work map source");
      ids.add(row[0]);
    }
  }
  return {
    steps: flow.rows.map(([id,label,question,purpose,record,relation,caution,linkLabel,href]) =>
      ({id,label,question,purpose,record,relation,caution,linkLabel,href})),
    supports: support.rows.map(([id,label,summary,relation,description,linkLabel,href]) =>
      ({id,label,summary,relation,description,linkLabel,href})),
  };
}
