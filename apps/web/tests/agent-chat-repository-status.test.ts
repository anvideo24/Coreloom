import { afterEach, describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const state = vi.hoisted(() => ({ rows: [] as unknown[][], inserts: [] as unknown[], conflict: undefined as Record<string, unknown> | undefined }));
function query(rows: unknown[]) {
  const current = { where: () => current, orderBy: () => current, innerJoin: () => current, limit: async () => rows };
  return { from: () => current };
}
const db = vi.hoisted(() => ({
  select: () => query(state.rows.shift() || []),
  update: () => ({ set: () => ({ where: () => ({ returning: async () => [{ id: "locked" }] }) }) }),
  insert: () => ({ values: (value: unknown) => {
    state.inserts.push(value);
    if (state.inserts.length === 2) return { onConflictDoUpdate: (config: Record<string, unknown>) => { state.conflict = config; } };
    return Promise.resolve();
  } }),
}));

vi.mock("@/lib/db/client", () => ({ createDatabase: () => db }));
vi.mock("@/lib/workspace/founder-workspace", () => ({ ensureFounderWorkspace: vi.fn(async () => ({ id: "workspace-1" })) }));
vi.mock("@/lib/agents/subscription", () => ({ generateSubscriptionReply: vi.fn(async () => { throw new Error("subscription failure"); }) }));

import { sendAgentChat } from "@/lib/agents/chat-repository";

function reset() { state.rows = []; state.inserts = []; state.conflict = undefined; }
afterEach(reset);
function conflictParams() {
  const query = new PgDialect().sqlToQuery(state.conflict?.setWhere as SQL);
  expect(query.sql).toBe('"agent_chat_messages"."status" in ($1, $2)');
  return query.params;
}

async function fail(signal: AbortSignal) {
  state.rows = [
    [{ id: "agent-1", status: "active", capabilities: {}, name: "도우미", purpose: "초안", instructions: null, workStyle: null, answerStyle: null, procedure: null, accessScope: "전체", allowedWork: [] }],
    [],
    [],
  ];
  await expect(sendAgentChat("founder-1", { agentId: "agent-1", threadId: "thread-1", requestId: "request-1", message: "질문", model: "gpt-5.4-mini", pathname: "/agents" }, signal, () => {})).rejects.toThrow("subscription failure");
}

describe("stored chat failure status", () => {
  it("stores explicit user-stop and builds an update predicate limited to failed or stopped records", async () => {
    const controller = new AbortController(); controller.abort("user-stop");
    await fail(controller.signal);
    expect(state.inserts[1]).toMatchObject({ status: "stopped", clientRequestId: "request-1" });
    expect(state.inserts[2]).toMatchObject({ eventType: "ai_agent.chat_failed", payload: expect.objectContaining({ reason: "user_stop", requestId: "request-1" }) });
    expect(state.conflict).toMatchObject({ set: expect.objectContaining({ status: "stopped" }) });
    expect(conflictParams()).toEqual(["failed", "stopped"]);
  });

  it("keeps generic aborts failed and never configures conflict replacement for complete rows", async () => {
    const controller = new AbortController(); controller.abort();
    await fail(controller.signal);
    expect(state.inserts[1]).toMatchObject({ status: "failed" });
    expect(state.inserts[2]).toMatchObject({ payload: expect.objectContaining({ reason: "generation_failed" }) });
    expect(conflictParams()).toEqual(["failed", "stopped"]);
    expect(conflictParams()).not.toContain("complete");
  });
});
