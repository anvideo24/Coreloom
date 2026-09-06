import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ state: "authorized" }));
const workspace = vi.hoisted(() => vi.fn(async () => ({ id: "workspace-1" })));
const databaseFactory = vi.hoisted(() => vi.fn());
const io = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown> | null>, reads: 0, updates: 0, writes: 0, inserts: [] as unknown[], revalidate: vi.fn(), redirect: vi.fn() }));

function chain(row: Record<string, unknown> | null) {
  const result = async () => row ? [row] : [];
  const query = { where: () => query, orderBy: () => query, limit: result };
  return { from: () => query };
}
const database = vi.hoisted(() => ({
  select: () => { io.reads += 1; return chain(io.rows.shift() ?? null); },
  update: () => ({ set: () => { io.updates += 1; io.writes += 1; return { where: async () => undefined }; } }),
  insert: () => ({ values: async (value: unknown) => { io.writes += 1; io.inserts.push(value); } }),
}));

vi.mock("@/lib/auth/session", () => ({ founderSession: vi.fn(async () => auth.state === "authorized" ? { state: "authorized", founder: { id: "founder-1" } } : { state: auth.state }) }));
databaseFactory.mockImplementation(() => database);
vi.mock("@/lib/workspace/founder-workspace", () => ({ ensureFounderWorkspace: workspace }));
vi.mock("@/lib/db/client", () => ({ createDatabase: databaseFactory }));
vi.mock("next/cache", () => ({ revalidatePath: io.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { io.redirect(path); throw new Error(`redirect:${path}`); } }));

type Case = {
  name: string;
  load: () => Promise<(formData: FormData) => Promise<never>>;
  id: string;
  idKey: string;
  row: Record<string, unknown>;
  decided: Record<string, unknown>;
  decidedError: string;
  missingError: string;
  form: (approved?: FormDataEntryValue) => FormData;
  redirect: string;
  updates: number;
  audit: Record<string, unknown>;
};
const form = (values: Record<string, string | File>) => {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
};
const cases: Case[] = [
  { name: "expense", load: async () => (await import("@/app/(private)/expenses/actions")).confirmExpenseEntryAction as never, id: "expense-1", idKey: "entryId", row: { id: "expense-1", amount: 0, status: "scheduled" }, decided: { id: "expense-1", amount: 0, status: "confirmed" }, decidedError: "Confirmed expenses cannot be changed", missingError: "Expense entry was not found", form: approved => form({ entryId: "expense-1", actorUserId: "forged", approved: typeof approved === "string" ? approved : "true" }), redirect: "/expenses/expense-1", updates: 1, audit: { workspaceId: "workspace-1", actorUserId: "founder-1", eventType: "expense_entry.confirmed", payload: { expenseEntryId: "expense-1", amount: 0 } } },
  { name: "revenue", load: async () => (await import("@/app/(private)/revenue/actions")).confirmRevenueEntryAction as never, id: "revenue-1", idKey: "entryId", row: { id: "revenue-1", amount: 0, status: "scheduled" }, decided: { id: "revenue-1", amount: 0, status: "confirmed" }, decidedError: "Confirmed revenue cannot be changed", missingError: "Revenue entry was not found", form: approved => form({ entryId: "revenue-1", actorUserId: "forged", approved: typeof approved === "string" ? approved : "true" }), redirect: "/revenue/revenue-1", updates: 1, audit: { workspaceId: "workspace-1", actorUserId: "founder-1", eventType: "revenue_entry.confirmed", payload: { revenueEntryId: "revenue-1", amount: 0 } } },
  { name: "billing", load: async () => (await import("@/app/(private)/billings/actions")).confirmBillingDepositAction as never, id: "billing-1", idKey: "billingId", row: { id: "billing-1", contractId: "contract-1", amount: 0, status: "scheduled" }, decided: { id: "billing-1", contractId: "contract-1", amount: 0, status: "deposited" }, decidedError: "Deposited billings cannot be changed", missingError: "Billing was not found", form: approved => form({ billingId: "billing-1", actorUserId: "forged", approved: typeof approved === "string" ? approved : "true" }), redirect: "/billings/billing-1", updates: 1, audit: { workspaceId: "workspace-1", actorUserId: "founder-1", eventType: "billing.deposited", payload: { billingId: "billing-1", contractId: "contract-1" } } },
  { name: "contract", load: async () => (await import("@/app/(private)/contracts/actions")).executeContractAction as never, id: "contract-1", idKey: "contractId", row: { id: "contract-1" }, decided: { id: "contract-1", versionStatus: "executed" }, decidedError: "Executed contracts cannot be changed", missingError: "Contract was not found", form: approved => form({ contractId: "contract-1", actorUserId: "forged", approved: typeof approved === "string" ? approved : "true" }), redirect: "/contracts/contract-1", updates: 2, audit: { workspaceId: "workspace-1", actorUserId: "founder-1", eventType: "contract.executed", payload: { contractId: "contract-1", contractVersionId: "version-1" } } },
  { name: "proposal confirm", load: async () => (await import("@/app/(private)/proposals/actions")).confirmAiProposalAction as never, id: "proposal-1", idKey: "proposalId", row: { id: "proposal-1", evidenceId: "evidence-1", status: "proposed" }, decided: { id: "proposal-1", evidenceId: "evidence-1", status: "confirmed" }, decidedError: "Decided proposals cannot be changed", missingError: "Proposal was not found", form: approved => form({ proposalId: "proposal-1", actorUserId: "forged", approved: typeof approved === "string" ? approved : "true" }), redirect: "/proposals/proposal-1", updates: 1, audit: { workspaceId: "workspace-1", actorUserId: "founder-1", eventType: "ai_proposal.confirmed", payload: { aiProposalId: "proposal-1", evidenceId: "evidence-1" } } },
  { name: "proposal reject", load: async () => (await import("@/app/(private)/proposals/actions")).rejectAiProposalAction as never, id: "proposal-1", idKey: "proposalId", row: { id: "proposal-1", evidenceId: "evidence-1", status: "proposed" }, decided: { id: "proposal-1", evidenceId: "evidence-1", status: "rejected" }, decidedError: "Decided proposals cannot be changed", missingError: "Proposal was not found", form: approved => form({ proposalId: "proposal-1", actorUserId: "forged", approved: typeof approved === "string" ? approved : "true", reason: "사유" }), redirect: "/proposals/proposal-1", updates: 1, audit: { workspaceId: "workspace-1", actorUserId: "founder-1", eventType: "ai_proposal.rejected", payload: { aiProposalId: "proposal-1", evidenceId: "evidence-1" } } },
  { name: "agent approve", load: async () => (await import("@/app/(private)/agents/actions")).approveAgentWorkAction as never, id: "work-1", idKey: "workLogId", row: { id: "work-1", agentId: "agent-1", status: "pending", resultNote: "결과" }, decided: { id: "work-1", agentId: "agent-1", status: "approved", resultNote: "결과" }, decidedError: "Decided agent work cannot be changed", missingError: "Agent work was not found", form: approved => form({ agentId: "agent-1", workLogId: "work-1", actorUserId: "forged", approved: typeof approved === "string" ? approved : "true", resultNote: "결과" }), redirect: "/agents/agent-1", updates: 1, audit: { workspaceId: "workspace-1", actorUserId: "founder-1", eventType: "ai_agent.work_decided", payload: { workLogId: "work-1", agentId: "agent-1", status: "approved" } } },
  { name: "agent reject", load: async () => (await import("@/app/(private)/agents/actions")).rejectAgentWorkAction as never, id: "work-1", idKey: "workLogId", row: { id: "work-1", agentId: "agent-1", status: "pending", resultNote: null }, decided: { id: "work-1", agentId: "agent-1", status: "rejected", resultNote: null }, decidedError: "Decided agent work cannot be changed", missingError: "Agent work was not found", form: approved => form({ agentId: "agent-1", workLogId: "work-1", actorUserId: "forged", approved: typeof approved === "string" ? approved : "true", reason: "사유" }), redirect: "/agents/agent-1", updates: 1, audit: { workspaceId: "workspace-1", actorUserId: "founder-1", eventType: "ai_agent.work_decided", payload: { workLogId: "work-1", agentId: "agent-1", status: "rejected" } } },
];

function queued(caseItem: Case, row: Record<string, unknown> | null) {
  io.rows = caseItem.name === "contract" && row ? [row, { id: "version-1", status: row.versionStatus ?? "original_recorded", originalReference: "문서함/원본.pdf" }] : [row];
}
function reset() { auth.state = "authorized"; io.rows = []; io.reads = 0; io.updates = 0; io.writes = 0; io.inserts = []; workspace.mockClear(); databaseFactory.mockClear(); io.revalidate.mockReset(); io.redirect.mockReset(); }
afterEach(reset);

describe("approval actions", () => {
  it.each(cases)("blocks signed-out and denied $name before reads or writes", async (caseItem) => {
    const action = await caseItem.load();
    for (const state of ["signed-out", "denied"]) {
      auth.state = state;
      await expect(action(caseItem.form())).rejects.toThrow("Founder access is required");
    }
    expect(io.reads).toBe(0);
    expect(databaseFactory).not.toHaveBeenCalled();
    expect(workspace).not.toHaveBeenCalled();
    expect(io.writes).toBe(0);
    expect(io.updates).toBe(0);
    expect(io.inserts).toHaveLength(0);
    expect(io.revalidate).not.toHaveBeenCalled();
    expect(io.redirect).not.toHaveBeenCalled();
  });

  it.each(cases)("rejects non-true approval for $name without writes", async (caseItem) => {
    const action = await caseItem.load();
    for (const approved of [undefined, "false", "on", new File(["x"], "approval.txt")]) {
      queued(caseItem, caseItem.row);
      const data = caseItem.form();
      if (approved === undefined) data.delete("approved"); else data.set("approved", approved);
      await expect(action(data)).rejects.toThrow("Representative approval is required");
      expect(io.writes).toBe(0);
      expect(io.updates).toBe(0);
      expect(io.inserts).toHaveLength(0);
      expect(io.revalidate).not.toHaveBeenCalled();
      expect(io.redirect).not.toHaveBeenCalled();
    }
  });

  it.each(cases)("rejects decided and missing $name without writes", async (caseItem) => {
    const action = await caseItem.load();
    queued(caseItem, caseItem.decided);
    await expect(action(caseItem.form())).rejects.toThrow(caseItem.decidedError);
    expect(io.writes).toBe(0);
    expect(io.updates).toBe(0);
    expect(io.inserts).toHaveLength(0);
    queued(caseItem, null);
    await expect(action(caseItem.form())).rejects.toThrow(caseItem.missingError);
    expect(io.writes).toBe(0);
    expect(io.updates).toBe(0);
    expect(io.inserts).toHaveLength(0);
    expect(io.revalidate).not.toHaveBeenCalled();
    expect(io.redirect).not.toHaveBeenCalled();
  });

  it("rejects blank rejection reasons, missing agent result, and contract without original", async () => {
    const proposalReject = await cases[5].load(); queued(cases[5], cases[5].row);
    await expect(proposalReject(form({ proposalId: "proposal-1", approved: "true", reason: " " }))).rejects.toThrow("Rejection reason is required");
    const agentReject = await cases[7].load(); queued(cases[7], cases[7].row);
    await expect(agentReject(form({ agentId: "agent-1", workLogId: "work-1", approved: "true", reason: " " }))).rejects.toThrow("Rejection reason is required");
    const agentApprove = await cases[6].load(); queued(cases[6], { ...cases[6].row, resultNote: null });
    await expect(agentApprove(form({ agentId: "agent-1", workLogId: "work-1", approved: "true", resultNote: "" }))).rejects.toThrow("Work result is required");
    const contractExecute = await cases[3].load();
    io.rows = [{ id: "contract-1" }, { id: "version-1", status: "original_recorded", originalReference: null }];
    await expect(contractExecute(cases[3].form())).rejects.toThrow("Stamped original is required before execution");
    expect(io.writes).toBe(0);
    expect(io.updates).toBe(0);
    expect(io.inserts).toHaveLength(0);
    expect(io.revalidate).not.toHaveBeenCalled();
    expect(io.redirect).not.toHaveBeenCalled();
  });

  it.each(cases)("writes and passes founder and target for valid $name", async (caseItem) => {
    const action = await caseItem.load();
    queued(caseItem, caseItem.row);
    await expect(action(caseItem.form())).rejects.toThrow(`redirect:${caseItem.redirect}`);
    expect(io.writes).toBe(caseItem.updates + 1);
    expect(io.updates).toBe(caseItem.updates);
    expect(io.revalidate).toHaveBeenCalled();
    expect(io.redirect).toHaveBeenCalledExactlyOnceWith(caseItem.redirect);
    expect(io.inserts).toContainEqual(caseItem.audit);
  });
});
