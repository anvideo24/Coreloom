import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { createDatabase } from "@/lib/db/client";
import { auditEvents, clientCompanies, projects, quotes, quoteVersions } from "@/lib/db/schema";
import { calculateQuoteAmounts, nextQuoteVersionNumber, QuoteItemInput } from "@/lib/domain/quotes";
import { ensureFounderWorkspace } from "@/lib/workspace/founder-workspace";

export async function listFounderQuotes(authUserId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "quotes");
  const database = createDatabase();
  const clients = await database.select({ id: clientCompanies.id, name: clientCompanies.name }).from(clientCompanies)
    .where(and(eq(clientCompanies.workspaceId, workspace.id), isNull(clientCompanies.deletedAt))).orderBy(asc(clientCompanies.name));
  const projectRows = await database.select({ id: projects.id, name: projects.name, clientCompanyId: projects.clientCompanyId }).from(projects)
    .where(and(eq(projects.workspaceId, workspace.id), isNull(projects.deletedAt))).orderBy(asc(projects.name));
  const versions = await database.select({
    quoteId: quotes.id,
    versionId: quoteVersions.id,
    versionNumber: quoteVersions.versionNumber,
    title: quoteVersions.title,
    totalAmount: quoteVersions.totalAmount,
    clientName: clientCompanies.name,
    createdAt: quoteVersions.createdAt,
  }).from(quoteVersions)
    .innerJoin(quotes, eq(quoteVersions.quoteId, quotes.id))
    .innerJoin(clientCompanies, eq(quotes.clientCompanyId, clientCompanies.id))
    .where(and(eq(quotes.workspaceId, workspace.id), isNull(quotes.deletedAt), isNull(clientCompanies.deletedAt)))
    .orderBy(desc(quoteVersions.createdAt));
  return { clients, projects: projectRows, versions };
}

export async function getFounderQuoteDetail(authUserId: string, quoteId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "quotes");
  const database = createDatabase();
  const [quote] = await database.select({ id: quotes.id, clientCompanyId: quotes.clientCompanyId, projectId: quotes.projectId, clientName: clientCompanies.name })
    .from(quotes).innerJoin(clientCompanies, eq(quotes.clientCompanyId, clientCompanies.id))
    .where(and(eq(quotes.id, quoteId), eq(quotes.workspaceId, workspace.id), isNull(quotes.deletedAt))).limit(1);
  if (!quote) return null;
  const versions = await database.select().from(quoteVersions)
    .where(and(eq(quoteVersions.quoteId, quote.id), eq(quoteVersions.workspaceId, workspace.id)))
    .orderBy(desc(quoteVersions.versionNumber));
  return { quote, versions };
}

export async function createFounderQuoteVersion(input: {
  actorUserId: string;
  quoteId?: string;
  clientId: string;
  projectId?: string;
  title: string;
  note?: string;
  items: QuoteItemInput[];
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "quotes");
  const database = createDatabase();
  const amounts = calculateQuoteAmounts(input.items);
  const title = input.title.trim();
  if (!title) throw new Error("Quote title is required");

  let quoteId = input.quoteId?.trim();
  let versionNumber = 1;
  if (quoteId) {
    const [existing] = await database.select({ id: quotes.id }).from(quotes)
      .where(and(eq(quotes.id, quoteId), eq(quotes.workspaceId, workspace.id), isNull(quotes.deletedAt))).limit(1);
    if (!existing) throw new Error("Quote was not found");
    const [latest] = await database.select({ versionNumber: quoteVersions.versionNumber }).from(quoteVersions)
      .where(eq(quoteVersions.quoteId, quoteId)).orderBy(desc(quoteVersions.versionNumber)).limit(1);
    versionNumber = nextQuoteVersionNumber(latest?.versionNumber ?? 0);
  } else {
    const [client] = await database.select({ id: clientCompanies.id }).from(clientCompanies)
      .where(and(eq(clientCompanies.id, input.clientId), eq(clientCompanies.workspaceId, workspace.id), isNull(clientCompanies.deletedAt))).limit(1);
    if (!client) throw new Error("Client was not found");
    const projectId = input.projectId?.trim() || null;
    if (projectId) {
      const [project] = await database.select({ id: projects.id }).from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspace.id), eq(projects.clientCompanyId, client.id), isNull(projects.deletedAt))).limit(1);
      if (!project) throw new Error("Project was not found");
    }
    const [created] = await database.insert(quotes).values({ workspaceId: workspace.id, clientCompanyId: client.id, projectId }).returning({ id: quotes.id });
    quoteId = created.id;
  }

  const [version] = await database.insert(quoteVersions).values({
    workspaceId: workspace.id, quoteId, versionNumber, title, items: amounts.items,
    subtotalAmount: amounts.subtotalAmount, vatAmount: amounts.vatAmount, totalAmount: amounts.totalAmount,
    note: input.note?.trim() || null,
  }).returning({ id: quoteVersions.id });
  await database.update(quotes).set({ updatedAt: new Date() }).where(eq(quotes.id, quoteId));
  await database.insert(auditEvents).values({ workspaceId: workspace.id, actorUserId: input.actorUserId,
    eventType: "quote.version_created", payload: { quoteId, quoteVersionId: version.id, versionNumber } });
  return { quoteId, versionId: version.id, versionNumber };
}
