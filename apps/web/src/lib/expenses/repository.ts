import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { createDatabase } from "@/lib/db/client";
import { auditEvents, clientCompanies, expenseEntries, projects, ventures } from "@/lib/db/schema";
import {
  confirmExpenseEntry,
  ledgerRowFromExpenseEntry,
  normalizeExpenseEntry,
  sortExpenseRows,
  summarizeExpenses,
} from "@/lib/domain/expenses";
import { ensureFounderWorkspace } from "@/lib/workspace/founder-workspace";

export async function listFounderExpenseLedger(authUserId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "expenses");
  const database = createDatabase();
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

  const entryRows = await database.select({
    id: expenseEntries.id,
    amount: expenseEntries.amount,
    currency: expenseEntries.currency,
    occurredOn: expenseEntries.occurredOn,
    settlementDate: expenseEntries.settlementDate,
    status: expenseEntries.status,
    accountCategory: expenseEntries.accountCategory,
    supplierName: expenseEntries.supplierName,
    ventureName: ventures.name,
    ventureKind: ventures.kind,
    clientName: clientCompanies.name,
    projectName: projects.name,
  }).from(expenseEntries)
    .leftJoin(ventures, eq(expenseEntries.ventureId, ventures.id))
    .leftJoin(projects, eq(expenseEntries.projectId, projects.id))
    .leftJoin(clientCompanies, eq(expenseEntries.clientCompanyId, clientCompanies.id))
    .where(and(eq(expenseEntries.workspaceId, workspace.id), isNull(expenseEntries.deletedAt)))
    .orderBy(desc(expenseEntries.occurredOn));

  const rows = sortExpenseRows(entryRows.map((row) => ledgerRowFromExpenseEntry(row)));
  return {
    ventures: ventureRows,
    projects: projectRows,
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
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "expenses");
  const database = createDatabase();
  const draft = normalizeExpenseEntry(input);

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

  const [created] = await database.insert(expenseEntries).values({
    workspaceId: workspace.id,
    ventureId: draft.ventureId,
    clientCompanyId,
    projectId: draft.projectId,
    amount: draft.amount,
    currency: draft.currency,
    occurredOn: draft.occurredOn,
    settlementDate: draft.settlementDate,
    accountCategory: draft.accountCategory,
    supplierName: draft.supplierName,
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
