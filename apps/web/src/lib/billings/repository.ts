import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import { createDatabase } from "@/lib/db/client";
import { auditEvents, billingEmailDeliveries, billingRecurringSeries, billings, clientCompanies, contracts, contractVersions } from "@/lib/db/schema";
import {
  assertExecutedContractForBilling,
  billingKindLabels,
  calculateBillingInvoiceAmounts,
  confirmBillingDeposit,
  normalizeBillingDraft,
  normalizeRecurringSeriesDraft,
} from "@/lib/domain/billings";
import { billingEmailConfigured, deliverBillingEmail } from "@/lib/billings/email";
import { createBillingPdf } from "@/lib/billings/pdf";
import { ensureFounderWorkspace } from "@/lib/workspace/founder-workspace";

async function latestContractVersion(database: ReturnType<typeof createDatabase>, contractId: string) {
  const [version] = await database.select().from(contractVersions)
    .where(eq(contractVersions.contractId, contractId))
    .orderBy(desc(contractVersions.versionNumber))
    .limit(1);
  return version;
}

export async function listFounderBillings(authUserId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "billings");
  const database = createDatabase();
  const rows = await database.select({
    id: billings.id,
    contractId: billings.contractId,
    projectId: billings.projectId,
    seriesId: billings.seriesId,
    kind: billings.kind,
    amount: billings.amount,
    currency: billings.currency,
    billingDate: billings.billingDate,
    dueDate: billings.dueDate,
    status: billings.status,
    billingNumber: billings.billingNumber,
    poNumber: billings.poNumber,
    clientName: clientCompanies.name,
    createdAt: billings.createdAt,
  }).from(billings)
    .innerJoin(clientCompanies, eq(billings.clientCompanyId, clientCompanies.id))
    .innerJoin(contracts, eq(billings.contractId, contracts.id))
    .where(and(eq(billings.workspaceId, workspace.id), isNull(billings.deletedAt), isNull(contracts.deletedAt), isNull(clientCompanies.deletedAt)))
    .orderBy(desc(billings.createdAt));

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

  const items = rows.map((row) => ({ ...row, contractTitle: latestTitleByContract.get(row.contractId) ?? "" }));

  const contractRows = await database.select({
    contractId: contracts.id,
    clientName: clientCompanies.name,
    title: contractVersions.title,
    status: contractVersions.status,
    versionNumber: contractVersions.versionNumber,
    totalAmount: contractVersions.totalAmount,
  }).from(contractVersions)
    .innerJoin(contracts, eq(contractVersions.contractId, contracts.id))
    .innerJoin(clientCompanies, eq(contracts.clientCompanyId, clientCompanies.id))
    .where(and(eq(contracts.workspaceId, workspace.id), isNull(contracts.deletedAt), isNull(clientCompanies.deletedAt)))
    .orderBy(desc(contractVersions.versionNumber));

  const seenContracts = new Set<string>();
  const executableContracts = contractRows.filter((row) => {
    if (seenContracts.has(row.contractId)) return false;
    seenContracts.add(row.contractId);
    return row.status === "executed";
  });

  const seriesRows = await database.select({
    id: billingRecurringSeries.id,
    contractId: billingRecurringSeries.contractId,
    amount: billingRecurringSeries.amount,
    currency: billingRecurringSeries.currency,
    startDate: billingRecurringSeries.startDate,
    endDate: billingRecurringSeries.endDate,
    dueOffsetDays: billingRecurringSeries.dueOffsetDays,
    clientName: clientCompanies.name,
    createdAt: billingRecurringSeries.createdAt,
  }).from(billingRecurringSeries)
    .innerJoin(clientCompanies, eq(billingRecurringSeries.clientCompanyId, clientCompanies.id))
    .innerJoin(contracts, eq(billingRecurringSeries.contractId, contracts.id))
    .where(and(eq(billingRecurringSeries.workspaceId, workspace.id), isNull(billingRecurringSeries.deletedAt), isNull(contracts.deletedAt), isNull(clientCompanies.deletedAt)))
    .orderBy(desc(billingRecurringSeries.createdAt));

  const occurrenceCountBySeries = new Map<string, number>();
  for (const row of items) {
    if (!row.seriesId) continue;
    occurrenceCountBySeries.set(row.seriesId, (occurrenceCountBySeries.get(row.seriesId) ?? 0) + 1);
  }

  const series = seriesRows.map((row) => ({
    ...row,
    contractTitle: latestTitleByContract.get(row.contractId) ?? "",
    occurrenceCount: occurrenceCountBySeries.get(row.id) ?? 0,
  }));

  return { billings: items, executableContracts, series };
}

export async function getFounderBillingDetail(authUserId: string, billingId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "billings");
  const database = createDatabase();
  const [billing] = await database.select({
    id: billings.id,
    contractId: billings.contractId,
    seriesId: billings.seriesId,
    kind: billings.kind,
    amount: billings.amount,
    currency: billings.currency,
    billingDate: billings.billingDate,
    dueDate: billings.dueDate,
    status: billings.status,
    billingNumber: billings.billingNumber,
    poNumber: billings.poNumber,
    note: billings.note,
    depositedAt: billings.depositedAt,
    clientName: clientCompanies.name,
  }).from(billings)
    .innerJoin(clientCompanies, eq(billings.clientCompanyId, clientCompanies.id))
    .where(and(eq(billings.id, billingId), eq(billings.workspaceId, workspace.id), isNull(billings.deletedAt)))
    .limit(1);
  if (!billing) return null;
  const version = await latestContractVersion(database, billing.contractId);
  return { billing, contractTitle: version?.title ?? billingKindLabels[billing.kind] };
}

export async function createFounderBilling(input: {
  actorUserId: string;
  contractId: string;
  kind: string;
  amount: string;
  billingDate: string;
  dueDate: string;
  note?: string;
  billingNumber?: string;
  poNumber?: string;
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "billings");
  const database = createDatabase();
  const [contract] = await database.select({
    id: contracts.id,
    clientCompanyId: contracts.clientCompanyId,
    projectId: contracts.projectId,
  }).from(contracts)
    .where(and(eq(contracts.id, input.contractId), eq(contracts.workspaceId, workspace.id), isNull(contracts.deletedAt)))
    .limit(1);
  if (!contract) throw new Error("Contract was not found");
  const version = await latestContractVersion(database, contract.id);
  if (!version) throw new Error("Contract version was not found");
  assertExecutedContractForBilling(version.status);
  const draft = normalizeBillingDraft(input);
  const [created] = await database.insert(billings).values({
    workspaceId: workspace.id,
    contractId: contract.id,
    clientCompanyId: contract.clientCompanyId,
    projectId: contract.projectId,
    ...draft,
  }).returning({ id: billings.id });
  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "billing.created",
    payload: { billingId: created.id, contractId: contract.id, kind: draft.kind, amount: draft.amount },
  });
  return { billingId: created.id };
}

export async function createFounderRecurringSeries(input: {
  actorUserId: string;
  contractId: string;
  amount: string;
  startDate: string;
  endDate: string;
  dueOffsetDays: string;
  note?: string;
  approved: boolean;
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "billings");
  const database = createDatabase();
  const [contract] = await database.select({
    id: contracts.id,
    clientCompanyId: contracts.clientCompanyId,
    projectId: contracts.projectId,
  }).from(contracts)
    .where(and(eq(contracts.id, input.contractId), eq(contracts.workspaceId, workspace.id), isNull(contracts.deletedAt)))
    .limit(1);
  if (!contract) throw new Error("Contract was not found");
  const version = await latestContractVersion(database, contract.id);
  if (!version) throw new Error("Contract version was not found");
  assertExecutedContractForBilling(version.status);
  const draft = normalizeRecurringSeriesDraft(input);
  const [created] = await database.insert(billingRecurringSeries).values({
    workspaceId: workspace.id,
    contractId: contract.id,
    clientCompanyId: contract.clientCompanyId,
    projectId: contract.projectId,
    amount: draft.amount,
    currency: draft.currency,
    interval: draft.interval,
    startDate: draft.startDate,
    endDate: draft.endDate,
    dueOffsetDays: draft.dueOffsetDays,
    note: draft.note,
  }).returning({ id: billingRecurringSeries.id });
  const createdBillings = await database.insert(billings).values(draft.occurrences.map((occurrence) => ({
    workspaceId: workspace.id,
    contractId: contract.id,
    clientCompanyId: contract.clientCompanyId,
    projectId: contract.projectId,
    seriesId: created.id,
    ...occurrence,
  }))).returning({ id: billings.id, billingDate: billings.billingDate });
  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "billing.recurring_series_created",
    payload: {
      seriesId: created.id,
      contractId: contract.id,
      amount: draft.amount,
      occurrenceCount: createdBillings.length,
      billingIds: createdBillings.map((row) => row.id),
    },
  });
  return { seriesId: created.id, billingIds: createdBillings.map((row) => row.id) };
}

export async function getFounderRecurringSeriesDetail(authUserId: string, seriesId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "billings");
  const database = createDatabase();
  const [series] = await database.select({
    id: billingRecurringSeries.id,
    contractId: billingRecurringSeries.contractId,
    amount: billingRecurringSeries.amount,
    currency: billingRecurringSeries.currency,
    interval: billingRecurringSeries.interval,
    startDate: billingRecurringSeries.startDate,
    endDate: billingRecurringSeries.endDate,
    dueOffsetDays: billingRecurringSeries.dueOffsetDays,
    note: billingRecurringSeries.note,
    clientName: clientCompanies.name,
  }).from(billingRecurringSeries)
    .innerJoin(clientCompanies, eq(billingRecurringSeries.clientCompanyId, clientCompanies.id))
    .where(and(eq(billingRecurringSeries.id, seriesId), eq(billingRecurringSeries.workspaceId, workspace.id), isNull(billingRecurringSeries.deletedAt)))
    .limit(1);
  if (!series) return null;
  const version = await latestContractVersion(database, series.contractId);
  const occurrences = await database.select({
    id: billings.id,
    billingDate: billings.billingDate,
    dueDate: billings.dueDate,
    amount: billings.amount,
    status: billings.status,
  }).from(billings)
    .where(and(eq(billings.seriesId, series.id), eq(billings.workspaceId, workspace.id), isNull(billings.deletedAt)))
    .orderBy(billings.billingDate);
  return { series, contractTitle: version?.title ?? "반복 청구", occurrences };
}

export async function confirmFounderBillingDeposit(input: { actorUserId: string; billingId: string; approved: boolean }) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "billings");
  const database = createDatabase();
  const [billing] = await database.select().from(billings)
    .where(and(eq(billings.id, input.billingId), eq(billings.workspaceId, workspace.id), isNull(billings.deletedAt)))
    .limit(1);
  if (!billing) throw new Error("Billing was not found");
  const update = confirmBillingDeposit({ status: billing.status, approved: input.approved });
  await database.update(billings).set({ ...update, depositedAt: new Date(), updatedAt: new Date() }).where(eq(billings.id, billing.id));
  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "billing.deposited",
    payload: { billingId: billing.id, contractId: billing.contractId },
  });
  return { billingId: billing.id };
}

export async function listFounderBillingEmailDeliveries(authUserId: string, billingId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "billings");
  const database = createDatabase();
  return database.select({
    id: billingEmailDeliveries.id,
    recipient: billingEmailDeliveries.recipient,
    subject: billingEmailDeliveries.subject,
    status: billingEmailDeliveries.status,
    createdAt: billingEmailDeliveries.createdAt,
    sentAt: billingEmailDeliveries.sentAt,
  }).from(billingEmailDeliveries)
    .where(and(eq(billingEmailDeliveries.workspaceId, workspace.id), eq(billingEmailDeliveries.billingId, billingId)))
    .orderBy(desc(billingEmailDeliveries.createdAt));
}

export async function sendFounderBillingEmail(input: {
  actorUserId: string;
  billingId: string;
  recipient: string;
  subject: string;
  message: string;
}) {
  if (!billingEmailConfigured()) throw new Error("Billing email service is not configured");
  const workspace = await ensureFounderWorkspace(input.actorUserId, "billings");
  const database = createDatabase();
  const detail = await getFounderBillingDetail(input.actorUserId, input.billingId);
  if (!detail) throw new Error("Billing was not found");
  const { billing } = detail;
  const invoice = calculateBillingInvoiceAmounts(billing.amount);
  const [delivery] = await database.insert(billingEmailDeliveries).values({
    workspaceId: workspace.id,
    billingId: billing.id,
    recipient: input.recipient,
    subject: input.subject,
    message: input.message,
  }).returning({ id: billingEmailDeliveries.id });

  try {
    const kindLabel = billingKindLabels[billing.kind];
    const providerMessageId = await deliverBillingEmail({
      clientName: billing.clientName,
      contractTitle: detail.contractTitle,
      kindLabel,
      message: input.message,
      pdf: await createBillingPdf({
        clientName: billing.clientName,
        contractTitle: detail.contractTitle,
        kindLabel,
        billingDate: billing.billingDate,
        dueDate: billing.dueDate,
        subtotalAmount: invoice.subtotalAmount,
        vatAmount: invoice.vatAmount,
        totalAmount: invoice.totalAmount,
        note: billing.note,
      }),
      recipient: input.recipient,
      subject: input.subject,
      idempotencyKey: `billing-email-${delivery.id}`,
    });
    await database.update(billingEmailDeliveries).set({
      status: "accepted",
      providerMessageId,
      sentAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(billingEmailDeliveries.id, delivery.id));
    await database.insert(auditEvents).values({
      workspaceId: workspace.id,
      actorUserId: input.actorUserId,
      eventType: "billing.email_accepted",
      payload: { billingId: billing.id, billingEmailDeliveryId: delivery.id },
    });
    return { deliveryId: delivery.id };
  } catch {
    await database.update(billingEmailDeliveries).set({
      status: "failed",
      failureReason: "provider_rejected_or_unavailable",
      updatedAt: new Date(),
    }).where(eq(billingEmailDeliveries.id, delivery.id));
    await database.insert(auditEvents).values({
      workspaceId: workspace.id,
      actorUserId: input.actorUserId,
      eventType: "billing.email_failed",
      payload: { billingId: billing.id, billingEmailDeliveryId: delivery.id },
    });
    throw new Error("Billing email could not be sent");
  }
}
