import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { erpReadQuery } from "@/lib/agents/erp-read-query";
import { erpAreas, toolRequestSchema } from "@/lib/domain/agent-access";

describe("ERP scope and query boundary", () => {
  for (const area of erpAreas) it(`${area} scopes workspace and project and binds search`, () => {
    const tool = toolRequestSchema.parse({ tool: "erp", area, query: "' OR 1=1 --" });
    if (tool.tool !== "erp") throw new Error();
    const compiled = new PgDialect().sqlToQuery(erpReadQuery("workspace-a", "project-a", null, tool).query);
    expect(compiled.sql).toContain("t.workspace_id=");
    expect(compiled.sql).toContain("deleted_at IS NULL");
    expect(compiled.params).toContain("workspace-a");
    expect(compiled.params).toContain("project-a");
    expect(compiled.sql).not.toContain("OR 1=1");
    expect(compiled.sql).not.toMatch(/bank_account|email|password|storage_key/);
  });
  it("does not let venture-bound agents read unrelated client records", () => {
    const tool = toolRequestSchema.parse({ tool: "erp", area: "quotes" });
    if (tool.tool !== "erp") throw new Error();
    expect(() => erpReadQuery("workspace-a", null, "venture-a", tool)).toThrow();
  });
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/agents/chat-repository", () => ({ chatAgent: vi.fn() }));
import { chatAgent } from "@/lib/agents/chat-repository";
import { executeReadTool } from "@/lib/agents/read-tools";
it("rechecks permissions on every call and denies before data access", async () => {
  const execute = vi.fn().mockResolvedValue({ rows: [] });
  const values = vi.fn().mockResolvedValue(undefined);
  const fake = { db: { execute, insert: () => ({ values }) }, workspace: { id: "workspace-a" }, agent: { id: "agent-a", capabilities: { read_quotes: true }, projectId: null, ventureId: null } };
  vi.mocked(chatAgent).mockResolvedValue(fake as never);
  const tool = toolRequestSchema.parse({ tool: "erp", area: "quotes" });
  await executeReadTool("owner", "agent-a", "thread-a", tool);
  fake.agent.capabilities.read_quotes = false;
  await expect(executeReadTool("owner", "agent-a", "thread-a", tool)).rejects.toThrow();
  expect(execute).toHaveBeenCalledTimes(1);
  expect(chatAgent).toHaveBeenCalledTimes(2);
  expect(values).toHaveBeenLastCalledWith(expect.objectContaining({ payload: expect.objectContaining({ status: "denied_or_failed" }) }));
});
