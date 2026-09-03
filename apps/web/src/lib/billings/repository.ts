import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import { createDatabase } from "@/lib/db/client";
import { auditEvents, billings, clientCompanies, contracts, contractVersions } from "@/lib/db/schema";
import {
  assertExecutedContractForBilling,
  billingKindLabels,
  confirmBillingDeposit,
  normalizeBillingDraft,
} from "@/lib/domain/billings";
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
    kind: billings.kind,
    amount: billings.amount,
    currency: billings.currency,
    billingDate: billings.billingDate,
    dueDate: billings.dueDate,
    status: billings.status,
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

  return { billings: items, executableContracts };
}

export async function getFounderBillingDetail(authUserId: string, billingId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "billings");
  const database = createDatabase();
  const [billing] = await database.select({
    id: billings.id,
    contractId: billings.contractId,
    kind: billings.kind,
    amount: billings.amount,
    currency: billings.currency,
    billingDate: billings.billingDate,
    dueDate: billings.dueDate,
    status: billings.status,
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
