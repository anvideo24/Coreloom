import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { ensureDefaultLedgerAccounts, listFounderLedgerAccounts, resolveLedgerAccountForEntry } from "@/lib/accounts/repository";
import { createDatabase } from "@/lib/db/client";
import { auditEvents, billings, clientCompanies, contracts, contractVersions, projects, revenueEntries, revenueRefunds, ventures } from "@/lib/db/schema";
import { billingKindLabels } from "@/lib/domain/billings";
import { ledgerAccountsForClass } from "@/lib/domain/ledger-accounts";
import {
  confirmRevenueEntry,
  ledgerRowFromBilling,
  ledgerRowFromRevenueEntry,
  normalizeRefund,
  normalizeRevenueEntry,
  normalizeVentureRegistration,
  sortLedgerRows,
  summarizeLedger,
} from "@/lib/domain/revenue";
import { ensureFounderWorkspace } from "@/lib/workspace/founder-workspace";

export async function listFounderRevenueLedger(authUserId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "revenue");
  await ensureDefaultLedgerAccounts(workspace.id);
  const database = createDatabase();
  const accounts = ledgerAccountsForClass(await listFounderLedgerAccounts(authUserId), "revenue");
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

  const billingRows = await database.select({
    id: billings.id,
    contractId: billings.contractId,
    kind: billings.kind,
    amount: billings.amount,
    currency: billings.currency,
    billingDate: billings.billingDate,
    dueDate: billings.dueDate,
    status: billings.status,
    clientName: clientCompanies.name,
    projectName: projects.name,
  }).from(billings)
    .innerJoin(clientCompanies, eq(billings.clientCompanyId, clientCompanies.id))
    .innerJoin(contracts, eq(billings.contractId, contracts.id))
    .leftJoin(projects, eq(billings.projectId, projects.id))
    .where(and(eq(billings.workspaceId, workspace.id), isNull(billings.deletedAt), isNull(contracts.deletedAt), isNull(clientCompanies.deletedAt)))
    .orderBy(desc(billings.billingDate));

  const latestTitleByContract = new Map<string, string>();
  const versionRows = await database.select({
    contractId: contractVersions.contractId,
    title: contractVersions.title,
    versionNumber: contractVersions.versionNumber,
  }).from(contractVersions)
    .innerJoin(contracts, eq(contractVersions.contractId, contracts.id))
    .where(and(eq(contracts.workspaceId, workspace.id), isNull(contracts.deletedAt)))
    .orderBy(desc(contractVersions.versionNumber));
  for (const row of versionRows) {
    if (!latestTitleByContract.has(row.contractId)) latestTitleByContract.set(row.contractId, row.title);
  }

  const entryRows = await database.select({
    id: revenueEntries.id,
    amount: revenueEntries.amount,
    currency: revenueEntries.currency,
    occurredOn: revenueEntries.occurredOn,
    settlementDate: revenueEntries.settlementDate,
    status: revenueEntries.status,
    accountCategory: revenueEntries.accountCategory,
    ventureName: ventures.name,
    ventureKind: ventures.kind,
    clientName: clientCompanies.name,
    projectName: projects.name,
  }).from(revenueEntries)
    .leftJoin(ventures, eq(revenueEntries.ventureId, ventures.id))
    .leftJoin(projects, eq(revenueEntries.projectId, projects.id))
    .leftJoin(clientCompanies, eq(revenueEntries.clientCompanyId, clientCompanies.id))
    .where(and(eq(revenueEntries.workspaceId, workspace.id), isNull(revenueEntries.deletedAt)))
    .orderBy(desc(revenueEntries.occurredOn));

  const rows = sortLedgerRows([
    ...billingRows.map((row) => ledgerRowFromBilling({
      id: row.id,
      kindLabel: billingKindLabels[row.kind],
      contractTitle: latestTitleByContract.get(row.contractId) ?? billingKindLabels[row.kind],
      clientName: row.clientName,
      projectName: row.projectName,
      amount: row.amount,
      currency: row.currency,
      billingDate: row.billingDate,
      dueDate: row.dueDate,
      status: row.status,
    })),
    ...entryRows.map((row) => ledgerRowFromRevenueEntry(row)),
  ]);

  const refundRows = await database.select({
    amount: revenueRefunds.amount,
  }).from(revenueRefunds)
    .innerJoin(revenueEntries, eq(revenueRefunds.revenueEntryId, revenueEntries.id))
    .where(eq(revenueEntries.workspaceId, workspace.id));
  const refundedTotal = refundRows.reduce((sum, row) => sum + row.amount, 0);

  return {
    ventures: ventureRows,
    projects: projectRows,
    accounts,
    rows,
    summary: summarizeLedger(rows, refundedTotal),
  };
}

export async function getFounderRevenueEntryDetail(authUserId: string, entryId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "revenue");
  const database = createDatabase();
  const [entry] = await database.select({
    id: revenueEntries.id,
    amount: revenueEntries.amount,
    currency: revenueEntries.currency,
    occurredOn: revenueEntries.occurredOn,
    settlementDate: revenueEntries.settlementDate,
    status: revenueEntries.status,
    note: revenueEntries.note,
    confirmedAt: revenueEntries.confirmedAt,
    ventureName: ventures.name,
    ventureKind: ventures.kind,
    clientName: clientCompanies.name,
    projectName: projects.name,
  }).from(revenueEntries)
    .leftJoin(ventures, eq(revenueEntries.ventureId, ventures.id))
    .leftJoin(projects, eq(revenueEntries.projectId, projects.id))
    .leftJoin(clientCompanies, eq(revenueEntries.clientCompanyId, clientCompanies.id))
    .where(and(eq(revenueEntries.id, entryId), eq(revenueEntries.workspaceId, workspace.id), isNull(revenueEntries.deletedAt)))
    .limit(1);
  if (!entry) return null;

  const refunds = await database.select({
    id: revenueRefunds.id,
    amount: revenueRefunds.amount,
    refundedOn: revenueRefunds.refundedOn,
    reason: revenueRefunds.reason,
    createdAt: revenueRefunds.createdAt,
  }).from(revenueRefunds)
    .where(eq(revenueRefunds.revenueEntryId, entry.id))
    .orderBy(desc(revenueRefunds.createdAt));

  return { ...entry, refunds, refundedTotal: refunds.reduce((sum, row) => sum + row.amount, 0) };
}

export async function createFounderVenture(input: { actorUserId: string; name: string; kind: string }) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "revenue");
  const database = createDatabase();
  const venture = normalizeVentureRegistration(input);
  const [created] = await database.insert(ventures).values({
    workspaceId: workspace.id,
    name: venture.name,
    kind: venture.kind,
  }).onConflictDoNothing().returning({ id: ventures.id });

  if (created) {
    await database.insert(auditEvents).values({
      workspaceId: workspace.id,
      actorUserId: input.actorUserId,
      eventType: "venture.created",
      payload: { ventureId: created.id, kind: venture.kind },
    });
  }
}

export async function createFounderRevenueEntry(input: {
  actorUserId: string;
  projectId?: string;
  ventureId?: string;
  amount: string;
  occurredOn: string;
  settlementDate: string;
  note?: string;
  accountCategory?: string;
  ledgerAccountId?: string;
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "revenue");
  await ensureDefaultLedgerAccounts(workspace.id);
  const database = createDatabase();
  const draft = normalizeRevenueEntry(input);
  const resolvedAccount = await resolveLedgerAccountForEntry({
    workspaceId: workspace.id,
    ledgerAccountId: draft.ledgerAccountId,
    expectedClass: "revenue",
  });
  const accountCategory = draft.accountCategory ?? (
    resolvedAccount.accountCategory &&
    ["service", "subscription", "license", "other"].includes(resolvedAccount.accountCategory)
      ? resolvedAccount.accountCategory as "service" | "subscription" | "license" | "other"
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

  const [created] = await database.insert(revenueEntries).values({
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
    note: draft.note,
  }).returning({ id: revenueEntries.id });

  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "revenue_entry.created",
    payload: {
      revenueEntryId: created.id,
      projectId: draft.projectId,
      ventureId: draft.ventureId,
      amount: draft.amount,
      ledgerAccountId: resolvedAccount.ledgerAccountId,
    },
  });

  return { entryId: created.id };
}

export async function confirmFounderRevenueEntry(input: { actorUserId: string; entryId: string; approved: boolean }) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "revenue");
  const database = createDatabase();
  const [entry] = await database.select().from(revenueEntries)
    .where(and(eq(revenueEntries.id, input.entryId), eq(revenueEntries.workspaceId, workspace.id), isNull(revenueEntries.deletedAt)))
    .limit(1);
  if (!entry) throw new Error("Revenue entry was not found");
  const update = confirmRevenueEntry({ status: entry.status, approved: input.approved });
  await database.update(revenueEntries).set({
    ...update,
    confirmedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(revenueEntries.id, entry.id));
  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "revenue_entry.confirmed",
    payload: { revenueEntryId: entry.id, amount: entry.amount },
  });
  return { entryId: entry.id };
}

export async function refundFounderRevenueEntry(input: {
  actorUserId: string;
  entryId: string;
  amount: string;
  refundedOn: string;
  reason: string;
  approved: boolean;
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "revenue");
  const database = createDatabase();
  const [entry] = await database.select().from(revenueEntries)
    .where(and(eq(revenueEntries.id, input.entryId), eq(revenueEntries.workspaceId, workspace.id), isNull(revenueEntries.deletedAt)))
    .limit(1);
  if (!entry) throw new Error("Revenue entry was not found");

  const existingRefunds = await database.select({ amount: revenueRefunds.amount }).from(revenueRefunds)
    .where(eq(revenueRefunds.revenueEntryId, entry.id));
  const existingRefundTotal = existingRefunds.reduce((sum, row) => sum + row.amount, 0);

  const refund = normalizeRefund({
    amount: input.amount,
    refundedOn: input.refundedOn,
    reason: input.reason,
    originalAmount: entry.amount,
    existingRefundTotal,
    status: entry.status,
    approved: input.approved,
  });

  const [created] = await database.insert(revenueRefunds).values({
    workspaceId: workspace.id,
    revenueEntryId: entry.id,
    amount: refund.amount,
    refundedOn: refund.refundedOn,
    reason: refund.reason,
  }).returning({ id: revenueRefunds.id });

  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "revenue_entry.refunded",
    payload: { revenueEntryId: entry.id, refundId: created.id, amount: refund.amount },
  });

  return { entryId: entry.id, refundId: created.id };
}
