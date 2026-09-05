import { sql, type SQL } from "drizzle-orm";
import type { ReadTool } from "@/lib/domain/agent-access";

const queries = {
  quotes: { table: "quotes", title: "v.title", fields: "t.id, v.title, v.version_number, v.subtotal_amount, v.vat_amount, v.total_amount, v.issued_on, v.valid_until", detail: ", v.items, v.note", join: "JOIN quote_versions v ON v.quote_id=t.id AND v.workspace_id=t.workspace_id AND v.version_number=(SELECT max(qv.version_number) FROM quote_versions qv WHERE qv.quote_id=t.id AND qv.workspace_id=t.workspace_id)", route: "/quotes/" },
  clients: { table: "client_companies", title: "t.name", fields: "t.id, t.name, t.business_type, t.business_item, t.trade_kind", detail: "", join: "", route: "/clients-projects" },
  projects: { table: "projects", title: "t.name", fields: "t.id, t.name, t.status, t.progress_percent, t.start_on, t.target_end_on", detail: ", t.summary", join: "", route: "/clients-projects" },
  tasks: { table: "tasks", title: "t.title", fields: "t.id, t.title, t.status, t.due_date", detail: ", t.completion_condition", join: "", route: "/tasks" },
  documents: { table: "vault_documents", title: "t.title", fields: "t.id, t.title, t.kind, v.version_number, v.stored_filename", detail: ", v.note", join: "LEFT JOIN vault_document_versions v ON v.document_id=t.id AND v.workspace_id=t.workspace_id AND v.version_number=(SELECT max(dv.version_number) FROM vault_document_versions dv WHERE dv.document_id=t.id AND dv.workspace_id=t.workspace_id)", route: "/documents/" },
} as const;

export function erpReadQuery(workspaceId: string, projectId: string | null, ventureId: string | null, tool: Extract<ReadTool, { tool: "erp" }>): { query: SQL; route: string } {
  // Venture-only agents cannot read customer-project records via an unrelated scope.
  if (ventureId) throw new Error("앱·구독 사업 전용 에이전트에는 이 고객사 자료를 제공하지 않습니다.");
  const definition = queries[tool.area];
  let scope = sql`TRUE`;
  if (projectId) scope = tool.area === "projects" ? sql`t.id=${projectId}` : tool.area === "clients" ? sql`t.id IN (SELECT client_company_id FROM projects WHERE id=${projectId} AND workspace_id=${workspaceId} AND deleted_at IS NULL)` : sql`t.project_id=${projectId}`;
  const search = tool.id ? sql`t.id=${tool.id}` : sql`${sql.raw(definition.title)} ILIKE ${`%${tool.query.replace(/[\\%_]/g, "\\$&")}%`}`;
  return { route: definition.route, query: sql`SELECT ${sql.raw(definition.fields + (tool.id ? definition.detail : ""))} FROM ${sql.identifier(definition.table)} t ${sql.raw(definition.join)} WHERE t.workspace_id=${workspaceId} AND t.deleted_at IS NULL AND ${scope} AND ${search} ORDER BY t.updated_at DESC, t.id LIMIT 21 OFFSET ${tool.offset}` };
}
