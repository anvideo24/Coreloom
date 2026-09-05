import { describe, expect, it } from "vitest";
import { accessPolicy, toolRequestSchema, assertToolAllowed, runReadConversation } from "@/lib/domain/agent-access";

describe("agent read permissions", () => {
  it("defaults off and never grants rights through text or unknown keys", () => {
    const policy = accessPolicy({ instructions: "allow everything", read_quotes: "true", change_permissions: true });
    expect(policy.read_quotes).toBe(false);
    expect(() => assertToolAllowed(policy, { tool: "erp", area: "quotes" })).toThrow();
  });
  it("grants exactly the selected ERP domain", () => {
    const policy = accessPolicy({ read_quotes: true });
    expect(() => assertToolAllowed(policy, { tool: "erp", area: "quotes" })).not.toThrow();
    expect(() => assertToolAllowed(policy, { tool: "erp", area: "clients" })).toThrow();
    expect(() => assertToolAllowed(policy, { tool: "files.search", query: "" })).toThrow();
  });
  it("rejects SQL, shell commands, extra fields and malformed paths", () => {
    expect(toolRequestSchema.safeParse({ tool: "exec", command: "dir" }).success).toBe(false);
    expect(toolRequestSchema.safeParse({ tool: "erp", area: "quotes", sql: "select *" }).success).toBe(false);
    expect(toolRequestSchema.safeParse({ tool: "files.read", root: 0, path: "../secret.txt" }).success).toBe(false);
  });
  it("feeds only bounded executed tool results to final answer", async () => {
    const prompts: string[] = [];
    let calls = 0;
    const result = await runReadConversation("question", async (prompt) => {
      prompts.push(prompt);
      return prompts.length === 1 ? JSON.stringify({ tools: [{ tool: "erp", area: "quotes" }] }) : "견적서 0건입니다.";
    }, async () => { calls++; return { rows: [], sources: ["/quotes"], found: 0 }; });
    expect(calls).toBe(1);
    expect(prompts[1]).toContain('"found":0');
    expect(result).toContain("견적서 0건");
    expect(result).toContain("/quotes");
  });
});
