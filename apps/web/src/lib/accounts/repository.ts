import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { createDatabase } from "@/lib/db/client";
import { auditEvents, ledgerAccounts } from "@/lib/db/schema";
import {
  defaultLedgerAccounts,
  normalizeLedgerAccount,
  sortLedgerAccounts,
  type LedgerAccountClass,
} from "@/lib/domain/ledger-accounts";
import { ensureFounderWorkspace } from "@/lib/workspace/founder-workspace";

export async function ensureDefaultLedgerAccounts(workspaceId: string) {
  const database = createDatabase();
  const existing = await database
    .select({ id: ledgerAccounts.id })
    .from(ledgerAccounts)
    .where(and(eq(ledgerAccounts.workspaceId, workspaceId), isNull(ledgerAccounts.deletedAt)))
    .limit(1);
  if (existing.length > 0) return;

  await database.insert(ledgerAccounts).values(
    defaultLedgerAccounts.map((account) => ({
      workspaceId,
      code: account.code,
      name: account.name,
      accountClass: account.accountClass,
      categoryKey: account.categoryKey,
    })),
  );
}

export async function listFounderLedgerAccounts(authUserId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "accounts");
  await ensureDefaultLedgerAccounts(workspace.id);
  const database = createDatabase();
  const rows = await database
    .select({
      id: ledgerAccounts.id,
      code: ledgerAccounts.code,
      name: ledgerAccounts.name,
      accountClass: ledgerAccounts.accountClass,
      categoryKey: ledgerAccounts.categoryKey,
    })
    .from(ledgerAccounts)
    .where(and(eq(ledgerAccounts.workspaceId, workspace.id), isNull(ledgerAccounts.deletedAt)));
  return sortLedgerAccounts(rows);
}

export async function createFounderLedgerAccount(input: {
  actorUserId: string;
  code: string;
  name: string;
  accountClass: string;
  categoryKey?: string;
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "accounts");
  await ensureDefaultLedgerAccounts(workspace.id);
  const draft = normalizeLedgerAccount(input);
  const database = createDatabase();

  const [duplicate] = await database
    .select({ id: ledgerAccounts.id })
    .from(ledgerAccounts)
    .where(and(
      eq(ledgerAccounts.workspaceId, workspace.id),
      eq(ledgerAccounts.code, draft.code),
      isNull(ledgerAccounts.deletedAt),
    ))
    .limit(1);
  if (duplicate) throw new Error("Account code already exists");

  const [created] = await database
    .insert(ledgerAccounts)
    .values({
      workspaceId: workspace.id,
      code: draft.code,
      name: draft.name,
      accountClass: draft.accountClass,
      categoryKey: draft.categoryKey,
    })
    .returning({ id: ledgerAccounts.id });

  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "ledger_account.created",
    payload: {
      ledgerAccountId: created.id,
      code: draft.code,
      accountClass: draft.accountClass,
    },
  });

  return { id: created.id };
}

export async function resolveLedgerAccountForEntry(input: {
  workspaceId: string;
  ledgerAccountId: string | null;
  expectedClass: LedgerAccountClass;
}) {
  if (!input.ledgerAccountId) {
    return { ledgerAccountId: null as string | null, accountCategory: null as string | null };
  }
  const database = createDatabase();
  const [account] = await database
    .select({
      id: ledgerAccounts.id,
      accountClass: ledgerAccounts.accountClass,
      categoryKey: ledgerAccounts.categoryKey,
    })
    .from(ledgerAccounts)
    .where(and(
      eq(ledgerAccounts.id, input.ledgerAccountId),
      eq(ledgerAccounts.workspaceId, input.workspaceId),
      isNull(ledgerAccounts.deletedAt),
    ))
    .limit(1);
  if (!account) throw new Error("Ledger account was not found");
  if (account.accountClass !== input.expectedClass) {
    throw new Error(`Ledger account must be ${input.expectedClass}`);
  }
  return {
    ledgerAccountId: account.id,
    accountCategory: account.categoryKey,
  };
}
