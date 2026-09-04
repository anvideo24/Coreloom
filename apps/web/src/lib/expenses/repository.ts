import "server-only";

import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { ensureDefaultLedgerAccounts, listFounderLedgerAccounts, resolveLedgerAccountForEntry } from "@/lib/accounts/repository";
import { createDatabase } from "@/lib/db/client";
import { auditEvents, clientCompanies, expenseEntries, projects, ventures } from "@/lib/db/schema";
import { clientAllowsPurchase } from "@/lib/domain/clients-projects";
import { ledgerAccountsForClass } from "@/lib/domain/ledger-accounts";
import {
  confirmExpenseEntry,
  ledgerRowFromExpenseEntry,
  normalizeExpenseEntry,
  sortExpenseRows,
  summarizeExpenses,
} from "@/lib/domain/expenses";
import { ensureFounderWorkspace } from "@/lib/workspace/founder-workspace";

const supplierClients = alias(clientCompanies, "supplier_clients");

export async function listFounderExpenseLedger(authUserId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "expenses");
  await ensureDefaultLedgerAccounts(workspace.id);
  const database = createDatabase();
  const accounts = ledgerAccountsForClass(await listFounderLedgerAccounts(authUserId), "expense");
  const ventureRows = await database.select({
    id: ventures.id,
    name: ventures.name,
    kind: ventures.kind,
  }).from(ventures)
    .where(and(eq(ventures.workspaceId, workspace.id), isNull(ventures.deletedAt)))
    .orderBy(asc(ventures.name));

  const projectRows = await database.select({
    id: projects.id,
    name: projects.name,
    clientName: clientCompanies.name,
  }).from(projects)
    .innerJoin(clientCompanies, eq(projects.clientCompanyId, clientCompanies.id))
    .where(and(eq(projects.workspaceId, workspace.id), isNull(projects.deletedAt), isNull(clientCompanies.deletedAt)))
    .orderBy(asc(clientCompanies.name), asc(projects.name));

  const supplierRows = await database.select({
    id: clientCompanies.id,
    name: clientCompanies.name,
    tradeKind: clientCompanies.tradeKind,
  }).from(clientCompanies)
    .where(and(
      eq(clientCompanies.workspaceId, workspace.id),
      isNull(clientCompanies.deletedAt),
      inArray(clientCompanies.tradeKind, ["purchase", "both"]),
    ))
    .orderBy(asc(clientCompanies.name));

  const entryRows = await database.select({
    id: expenseEntries.id,
    amount: expenseEntries.amount,
    currency: expenseEntries.currency,
    occurredOn: expenseEntries.occurredOn,
    settlementDate: expenseEntries.settlementDate,
    status: expenseEntries.status,
    accountCategory: expenseEntries.accountCategory,
    supplierName: expenseEntries.supplierName,
    supplierClientName: supplierClients.name,
    ventureName: ventures.name,
    ventureKind: ventures.kind,
    clientName: clientCompanies.name,
    projectName: projects.name,
  }).from(expenseEntries)
    .leftJoin(ventures, eq(expenseEntries.ventureId, ventures.id))
    .leftJoin(projects, eq(expenseEntries.projectId, projects.id))
    .leftJoin(clientCompanies, eq(expenseEntries.clientCompanyId, clientCompanies.id))
    .leftJoin(supplierClients, eq(expenseEntries.supplierClientCompanyId, supplierClients.id))
    .where(and(eq(expenseEntries.workspaceId, workspace.id), isNull(expenseEntries.deletedAt)))
    .orderBy(desc(expenseEntries.occurredOn));

  const rows = sortExpenseRows(entryRows.map((row) => ledgerRowFromExpenseEntry(row)));
  return {
    ventures: ventureRows,
    projects: projectRows,
    suppliers: supplierRows.filter((row) => clientAllowsPurchase(row.tradeKind)),
    accounts,
    rows,
    summary: summarizeExpenses(rows),
  };
}

export async function getFounderExpenseEntryDetail(authUserId: string, entryId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "expenses");
  const database = createDatabase();
  const [entry] = await database.select({
    id: expenseEntries.id,
    amount: expenseEntries.amount,
    currency: expenseEntries.currency,
    occurredOn: expenseEntries.occurredOn,
    settlementDate: expenseEntries.settlementDate,
    status: expenseEntries.status,
    note: expenseEntries.note,
    confirmedAt: expenseEntries.confirmedAt,
    ventureName: ventures.name,
    ventureKind: ventures.kind,
    clientName: clientCompanies.name,
    projectName: projects.name,
  }).from(expenseEntries)
    .leftJoin(ventures, eq(expenseEntries.ventureId, ventures.id))
    .leftJoin(projects, eq(expenseEntries.projectId, projects.id))
    .leftJoin(clientCompanies, eq(expenseEntries.clientCompanyId, clientCompanies.id))
    .where(and(eq(expenseEntries.id, entryId), eq(expenseEntries.workspaceId, workspace.id), isNull(expenseEntries.deletedAt)))
    .limit(1);
  return entry ?? null;
}

export async function createFounderExpenseEntry(input: {
  actorUserId: string;
  projectId?: string;
  ventureId?: string;
  amount: string;
  occurredOn: string;
  settlementDate: string;
  note?: string;
  accountCategory?: string;
  supplierName?: string;
  supplierClientCompanyId?: string;
  ledgerAccountId?: string;
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "expenses");
  await ensureDefaultLedgerAccounts(workspace.id);
  const database = createDatabase();
  const draft = normalizeExpenseEntry(input);
  const resolvedAccount = await resolveLedgerAccountForEntry({
    workspaceId: workspace.id,
    ledgerAccountId: draft.ledgerAccountId,
    expectedClass: "expense",
  });
  const accountCategory = draft.accountCategory ?? (
    resolvedAccount.accountCategory &&
    ["subcontract", "software", "travel", "office", "marketing", "other"].includes(resolvedAccount.accountCategory)
      ? resolvedAccount.accountCategory as "subcontract" | "software" | "travel" | "office" | "marketing" | "other"
      : null
  );

  let clientCompanyId: string | null = null;
  if (draft.projectId) {
    const [project] = await database.select({
      id: projects.id,
      clientCompanyId: projects.clientCompanyId,
    }).from(projects)
      .innerJoin(clientCompanies, eq(projects.clientCompanyId, clientCompanies.id))
      .where(and(
        eq(projects.id, draft.projectId),
        eq(projects.workspaceId, workspace.id),
        isNull(projects.deletedAt),
        isNull(clientCompanies.deletedAt),
      ))
      .limit(1);
    if (!project) throw new Error("Project was not found");
    clientCompanyId = project.clientCompanyId;
  }

  if (draft.ventureId) {
    const [venture] = await database.select({ id: ventures.id }).from(ventures)
      .where(and(eq(ventures.id, draft.ventureId), eq(ventures.workspaceId, workspace.id), isNull(ventures.deletedAt)))
      .limit(1);
    if (!venture) throw new Error("Venture was not found");
  }

  let supplierName = draft.supplierName;
  let supplierClientCompanyId = draft.supplierClientCompanyId;
  if (supplierClientCompanyId) {
    const [supplier] = await database.select({
      id: clientCompanies.id,
      name: clientCompanies.name,
      tradeKind: clientCompanies.tradeKind,
    }).from(clientCompanies)
      .where(and(
        eq(clientCompanies.id, supplierClientCompanyId),
        eq(clientCompanies.workspaceId, workspace.id),
        isNull(clientCompanies.deletedAt),
      ))
      .limit(1);
    if (!supplier) throw new Error("Supplier client was not found");
    if (!clientAllowsPurchase(supplier.tradeKind)) {
      throw new Error("Supplier client must allow purchase trade");
    }
    supplierClientCompanyId = supplier.id;
    if (!supplierName) supplierName = supplier.name;
  }

  const [created] = await database.insert(expenseEntries).values({
    workspaceId: workspace.id,
    ventureId: draft.ventureId,
    clientCompanyId,
    projectId: draft.projectId,
    amount: draft.amount,
    currency: draft.currency,
    occurredOn: draft.occurredOn,
    settlementDate: draft.settlementDate,
    accountCategory,
    ledgerAccountId: resolvedAccount.ledgerAccountId,
    supplierName,
    supplierClientCompanyId,
    note: draft.note,
  }).returning({ id: expenseEntries.id });

  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "expense_entry.created",
    payload: {
      expenseEntryId: created.id,
      projectId: draft.projectId,
      ventureId: draft.ventureId,
      amount: draft.amount,
      supplierClientCompanyId,
      ledgerAccountId: resolvedAccount.ledgerAccountId,
    },
  });

  return { entryId: created.id };
}

export async function confirmFounderExpenseEntry(input: { actorUserId: string; entryId: string; approved: boolean }) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "expenses");
  const database = createDatabase();
  const [entry] = await database.select().from(expenseEntries)
    .where(and(eq(expenseEntries.id, input.entryId), eq(expenseEntries.workspaceId, workspace.id), isNull(expenseEntries.deletedAt)))
    .limit(1);
  if (!entry) throw new Error("Expense entry was not found");
  const update = confirmExpenseEntry({ status: entry.status, approved: input.approved });
  await database.update(expenseEntries).set({
    ...update,
    confirmedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(expenseEntries.id, entry.id));
  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "expense_entry.confirmed",
    payload: { expenseEntryId: entry.id, amount: entry.amount },
  });
  return { entryId: entry.id };
}
