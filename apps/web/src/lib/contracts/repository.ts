import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import { createDatabase } from "@/lib/db/client";
import { auditEvents, clientCompanies, contracts, contractVersions, quotes, quoteVersions } from "@/lib/db/schema";
import {
  assertContractAmendmentSource,
  CONTRACT_CURRENCY,
  executeContract,
  nextContractVersionNumber,
  normalizeContractTerms,
  recordContractOriginal,
} from "@/lib/domain/contracts";
import { ensureFounderWorkspace } from "@/lib/workspace/founder-workspace";

async function latestContractVersion(database: ReturnType<typeof createDatabase>, contractId: string) {
  const [version] = await database.select().from(contractVersions)
    .where(eq(contractVersions.contractId, contractId))
    .orderBy(desc(contractVersions.versionNumber))
    .limit(1);
  return version;
}

export async function listFounderContracts(authUserId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "contracts");
  const database = createDatabase();
  const rows = await database.select({
    contractId: contracts.id,
    quoteId: contracts.quoteId,
    projectId: contracts.projectId,
    clientName: clientCompanies.name,
    versionId: contractVersions.id,
    versionNumber: contractVersions.versionNumber,
    title: contractVersions.title,
    status: contractVersions.status,
    totalAmount: contractVersions.totalAmount,
    currency: contractVersions.currency,
    createdAt: contractVersions.createdAt,
  }).from(contractVersions)
    .innerJoin(contracts, eq(contractVersions.contractId, contracts.id))
    .innerJoin(clientCompanies, eq(contracts.clientCompanyId, clientCompanies.id))
    .where(and(eq(contracts.workspaceId, workspace.id), isNull(contracts.deletedAt), isNull(clientCompanies.deletedAt)))
    .orderBy(desc(contractVersions.createdAt));

  const seen = new Set<string>();
  const latest = rows.filter((row) => {
    if (seen.has(row.contractId)) return false;
    seen.add(row.contractId);
    return true;
  });

  const quoteRows = await database.select({
    quoteId: quotes.id,
    versionId: quoteVersions.id,
    versionNumber: quoteVersions.versionNumber,
    title: quoteVersions.title,
    totalAmount: quoteVersions.totalAmount,
    clientName: clientCompanies.name,
  }).from(quoteVersions)
    .innerJoin(quotes, eq(quoteVersions.quoteId, quotes.id))
    .innerJoin(clientCompanies, eq(quotes.clientCompanyId, clientCompanies.id))
    .where(and(eq(quotes.workspaceId, workspace.id), isNull(quotes.deletedAt), isNull(clientCompanies.deletedAt)))
    .orderBy(desc(quoteVersions.createdAt));

  const contractedQuoteIds = new Set(latest.map((row) => row.quoteId));
  const seenQuotes = new Set<string>();
  const convertibleQuotes = quoteRows.filter((row) => {
    if (contractedQuoteIds.has(row.quoteId) || seenQuotes.has(row.quoteId)) return false;
    seenQuotes.add(row.quoteId);
    return true;
  });

  return { contracts: latest, convertibleQuotes };
}

export async function getFounderContractDetail(authUserId: string, contractId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "contracts");
  const database = createDatabase();
  const [contract] = await database.select({
    id: contracts.id,
    quoteId: contracts.quoteId,
    clientCompanyId: contracts.clientCompanyId,
    projectId: contracts.projectId,
    clientName: clientCompanies.name,
  }).from(contracts)
    .innerJoin(clientCompanies, eq(contracts.clientCompanyId, clientCompanies.id))
    .where(and(eq(contracts.id, contractId), eq(contracts.workspaceId, workspace.id), isNull(contracts.deletedAt)))
    .limit(1);
  if (!contract) return null;
  const versions = await database.select().from(contractVersions)
    .where(and(eq(contractVersions.contractId, contract.id), eq(contractVersions.workspaceId, workspace.id)))
    .orderBy(desc(contractVersions.versionNumber));
  return { contract, versions };
}

export async function getFounderContractForQuote(authUserId: string, quoteId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "contracts");
  const database = createDatabase();
  const [contract] = await database.select({ id: contracts.id }).from(contracts)
    .where(and(eq(contracts.quoteId, quoteId), eq(contracts.workspaceId, workspace.id), isNull(contracts.deletedAt)))
    .limit(1);
  return contract ?? null;
}

export async function createFounderContractFromQuote(input: {
  actorUserId: string;
  quoteVersionId: string;
  effectiveStartOn?: string;
  effectiveEndOn?: string;
  autoRenew?: boolean | string;
  contractNumber?: string;
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "contracts");
  const database = createDatabase();
  const [version] = await database.select().from(quoteVersions)
    .where(and(eq(quoteVersions.id, input.quoteVersionId), eq(quoteVersions.workspaceId, workspace.id)))
    .limit(1);
  if (!version) throw new Error("Quote version was not found");
  const [quote] = await database.select({
    id: quotes.id,
    clientCompanyId: quotes.clientCompanyId,
    projectId: quotes.projectId,
  }).from(quotes)
    .where(and(eq(quotes.id, version.quoteId), eq(quotes.workspaceId, workspace.id), isNull(quotes.deletedAt)))
    .limit(1);
  if (!quote) throw new Error("Quote version was not found");

  const [existing] = await database.select({ id: contracts.id }).from(contracts)
    .where(and(eq(contracts.quoteId, quote.id), eq(contracts.workspaceId, workspace.id), isNull(contracts.deletedAt)))
    .limit(1);
  if (existing) throw new Error("Contract already exists for this quote");

  const terms = normalizeContractTerms({
    status: "draft",
    effectiveStartOn: input.effectiveStartOn,
    effectiveEndOn: input.effectiveEndOn,
    autoRenew: input.autoRenew,
    contractNumber: input.contractNumber,
  });

  const [contract] = await database.insert(contracts).values({
    workspaceId: workspace.id,
    clientCompanyId: quote.clientCompanyId,
    projectId: quote.projectId,
    quoteId: quote.id,
  }).returning({ id: contracts.id });

  const [contractVersion] = await database.insert(contractVersions).values({
    workspaceId: workspace.id,
    contractId: contract.id,
    quoteVersionId: version.id,
    versionNumber: 1,
    title: version.title,
    items: version.items,
    subtotalAmount: version.subtotalAmount,
    vatAmount: version.vatAmount,
    totalAmount: version.totalAmount,
    currency: CONTRACT_CURRENCY,
    note: version.note,
    ...terms,
  }).returning({ id: contractVersions.id });

  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "contract.created",
    payload: { contractId: contract.id, contractVersionId: contractVersion.id, quoteId: quote.id, quoteVersionId: version.id },
  });
  return { contractId: contract.id };
}

export async function updateFounderContractTerms(input: {
  actorUserId: string;
  contractId: string;
  effectiveStartOn?: string;
  effectiveEndOn?: string;
  autoRenew?: boolean | string;
  contractNumber?: string;
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "contracts");
  const database = createDatabase();
  const [contract] = await database.select({ id: contracts.id }).from(contracts)
    .where(and(eq(contracts.id, input.contractId), eq(contracts.workspaceId, workspace.id), isNull(contracts.deletedAt)))
    .limit(1);
  if (!contract) throw new Error("Contract was not found");
  const version = await latestContractVersion(database, contract.id);
  if (!version) throw new Error("Contract version was not found");
  const terms = normalizeContractTerms({
    status: version.status,
    effectiveStartOn: input.effectiveStartOn,
    effectiveEndOn: input.effectiveEndOn,
    autoRenew: input.autoRenew,
    contractNumber: input.contractNumber,
  });
  await database.update(contractVersions).set({ ...terms, updatedAt: new Date() }).where(eq(contractVersions.id, version.id));
  await database.update(contracts).set({ updatedAt: new Date() }).where(eq(contracts.id, contract.id));
  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "contract.terms_updated",
    payload: { contractId: contract.id, contractVersionId: version.id, ...terms },
  });
  return { contractId: contract.id };
}

export async function recordFounderContractOriginal(input: { actorUserId: string; contractId: string; originalReference: string }) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "contracts");
  const database = createDatabase();
  const [contract] = await database.select({ id: contracts.id }).from(contracts)
    .where(and(eq(contracts.id, input.contractId), eq(contracts.workspaceId, workspace.id), isNull(contracts.deletedAt)))
    .limit(1);
  if (!contract) throw new Error("Contract was not found");
  const version = await latestContractVersion(database, contract.id);
  if (!version) throw new Error("Contract version was not found");
  const update = recordContractOriginal({ status: version.status, originalReference: input.originalReference });
  await database.update(contractVersions).set({ ...update, updatedAt: new Date() }).where(eq(contractVersions.id, version.id));
  await database.update(contracts).set({ updatedAt: new Date() }).where(eq(contracts.id, contract.id));
  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "contract.original_recorded",
    payload: { contractId: contract.id, contractVersionId: version.id },
  });
  return { contractId: contract.id };
}

export async function executeFounderContract(input: { actorUserId: string; contractId: string; approved: boolean }) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "contracts");
  const database = createDatabase();
  const [contract] = await database.select({ id: contracts.id }).from(contracts)
    .where(and(eq(contracts.id, input.contractId), eq(contracts.workspaceId, workspace.id), isNull(contracts.deletedAt)))
    .limit(1);
  if (!contract) throw new Error("Contract was not found");
  const version = await latestContractVersion(database, contract.id);
  if (!version) throw new Error("Contract version was not found");
  const update = executeContract({ status: version.status, originalReference: version.originalReference, approved: input.approved });
  await database.update(contractVersions).set({ ...update, executedAt: new Date(), updatedAt: new Date() }).where(eq(contractVersions.id, version.id));
  await database.update(contracts).set({ updatedAt: new Date() }).where(eq(contracts.id, contract.id));
  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "contract.executed",
    payload: { contractId: contract.id, contractVersionId: version.id },
  });
  return { contractId: contract.id };
}

export async function createFounderContractAmendment(input: { actorUserId: string; contractId: string }) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "contracts");
  const database = createDatabase();
  const [contract] = await database.select({ id: contracts.id }).from(contracts)
    .where(and(eq(contracts.id, input.contractId), eq(contracts.workspaceId, workspace.id), isNull(contracts.deletedAt)))
    .limit(1);
  if (!contract) throw new Error("Contract was not found");
  const version = await latestContractVersion(database, contract.id);
  if (!version) throw new Error("Contract version was not found");
  assertContractAmendmentSource(version.status);
  const versionNumber = nextContractVersionNumber(version.versionNumber);
  const [created] = await database.insert(contractVersions).values({
    workspaceId: workspace.id,
    contractId: contract.id,
    quoteVersionId: version.quoteVersionId,
    versionNumber,
    title: version.title,
    items: version.items,
    subtotalAmount: version.subtotalAmount,
    vatAmount: version.vatAmount,
    totalAmount: version.totalAmount,
    currency: version.currency,
    note: version.note,
    effectiveStartOn: version.effectiveStartOn,
    effectiveEndOn: version.effectiveEndOn,
    autoRenew: version.autoRenew,
    contractNumber: version.contractNumber,
  }).returning({ id: contractVersions.id });
  await database.update(contracts).set({ updatedAt: new Date() }).where(eq(contracts.id, contract.id));
  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "contract.version_created",
    payload: { contractId: contract.id, contractVersionId: created.id, versionNumber },
  });
  return { contractId: contract.id };
}
