import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { createDatabase } from "@/lib/db/client";
import { isUniqueViolationError } from "@/lib/db/postgres-errors";
import {
  auditEvents,
  clientCompanies,
  clientContacts,
  projects,
  quoteEmailDeliveries,
  quotes,
  quoteVersions,
} from "@/lib/db/schema";
import {
  calculateQuoteCosting,
  defaultQuoteValidUntil,
  nextQuoteVersionNumber,
  normalizeQuoteVatMode,
  normalizeStoredQuoteItemsForPdf,
  parseDateInputValue,
  toDateInputValue,
  type QuotePackage,
} from "@/lib/domain/quotes";
import { createQuotePdf } from "@/lib/quotes/pdf";
import { deliverQuoteEmail, quoteEmailConfigured } from "@/lib/quotes/email";
import { getFounderCompanyProfile, loadFounderCompanyProfile } from "@/lib/company-setup/repository";
import { ensureFounderWorkspace } from "@/lib/workspace/founder-workspace";

export async function listFounderQuotes(authUserId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "quotes");
  const database = createDatabase();
  const { profile: issuer, storage: companyProfileStorage } = await loadFounderCompanyProfile(authUserId);
  const clients = await database
    .select({ id: clientCompanies.id, name: clientCompanies.name })
    .from(clientCompanies)
    .where(and(eq(clientCompanies.workspaceId, workspace.id), isNull(clientCompanies.deletedAt)))
    .orderBy(asc(clientCompanies.name));
  const projectRows = await database
    .select({ id: projects.id, name: projects.name, clientCompanyId: projects.clientCompanyId })
    .from(projects)
    .where(and(eq(projects.workspaceId, workspace.id), isNull(projects.deletedAt)))
    .orderBy(asc(projects.name));
  const contacts = await database
    .select({
      id: clientContacts.id,
      name: clientContacts.name,
      role: clientContacts.role,
      email: clientContacts.email,
      phone: clientContacts.phone,
      clientCompanyId: clientContacts.clientCompanyId,
      relationStatus: clientContacts.relationStatus,
    })
    .from(clientContacts)
    .where(and(eq(clientContacts.workspaceId, workspace.id), isNull(clientContacts.deletedAt)))
    .orderBy(asc(clientContacts.name));
  const versions = await database
    .select({
      quoteId: quotes.id,
      versionId: quoteVersions.id,
      versionNumber: quoteVersions.versionNumber,
      title: quoteVersions.title,
      totalAmount: quoteVersions.totalAmount,
      vatMode: quoteVersions.vatMode,
      issuedOn: quoteVersions.issuedOn,
      validUntil: quoteVersions.validUntil,
      clientName: clientCompanies.name,
      projectId: quotes.projectId,
      createdAt: quoteVersions.createdAt,
    })
    .from(quoteVersions)
    .innerJoin(quotes, eq(quoteVersions.quoteId, quotes.id))
    .innerJoin(clientCompanies, eq(quotes.clientCompanyId, clientCompanies.id))
    .where(and(eq(quotes.workspaceId, workspace.id), isNull(quotes.deletedAt), isNull(clientCompanies.deletedAt)))
    .orderBy(desc(quoteVersions.createdAt));
  return { clients, projects: projectRows, contacts, versions, issuer, companyProfileStorage };
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
  const contacts = await database
    .select({
      id: clientContacts.id,
      name: clientContacts.name,
      role: clientContacts.role,
      email: clientContacts.email,
      phone: clientContacts.phone,
      clientCompanyId: clientContacts.clientCompanyId,
    })
    .from(clientContacts)
    .where(
      and(
        eq(clientContacts.workspaceId, workspace.id),
        eq(clientContacts.clientCompanyId, quote.clientCompanyId),
        isNull(clientContacts.deletedAt),
      ),
    )
    .orderBy(asc(clientContacts.name));
  const issuer = await getFounderCompanyProfile(authUserId);
  return { quote, versions, contacts, issuer };
}

const QUOTES_SUBMISSION_INDEX = "quotes_submission_idx";

export async function createFounderQuoteVersion(input: {
  actorUserId: string;
  quoteId?: string;
  /**
   * F02-03: 새 견적을 만들 때만 쓰는 열쇠. 기존 견적에 버전을 추가하는 경로는 `quotes` 표에
   * 아무것도 새로 넣지 않으므로(이 함수의 `if (quoteId)` 분기), 이 값을 받아도 효과가 없다 —
   * `quotes` 칸·유일 인덱스가 그 표에만 있기 때문이다(스키마 참고). 범위를 다른 표로 퍼뜨리지
   * 않는다.
   */
  submissionId?: string;
  clientId: string;
  projectId?: string;
  clientContactId?: string;
  title: string;
  note?: string;
  vatMode?: string;
  packages: Array<Partial<QuotePackage>>;
  targetMarginPercent?: unknown;
  operatingCostPercent?: unknown;
  issuedOn?: string;
  validUntil?: string;
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "quotes");
  const database = createDatabase();
  const vatMode = normalizeQuoteVatMode(input.vatMode);
  const amounts = calculateQuoteCosting({
    packages: input.packages,
    vatMode,
    targetMarginPercent: input.targetMarginPercent,
    operatingCostPercent: input.operatingCostPercent,
  });

  const [client] = await database
    .select({ id: clientCompanies.id, name: clientCompanies.name })
    .from(clientCompanies)
    .where(
      and(
        eq(clientCompanies.id, input.clientId),
        eq(clientCompanies.workspaceId, workspace.id),
        isNull(clientCompanies.deletedAt),
      ),
    )
    .limit(1);
  if (!client) throw new Error("Client was not found");

  const title = input.title.trim() || `${client.name} · 견적`;
  const issuedOn = input.issuedOn?.trim()
    ? parseDateInputValue(input.issuedOn)
    : new Date(`${toDateInputValue(new Date())}T00:00:00`);
  const validUntil = input.validUntil?.trim()
    ? parseDateInputValue(input.validUntil)
    : defaultQuoteValidUntil(issuedOn);

  let contactName: string | null = null;
  let clientContactId: string | null = input.clientContactId?.trim() || null;
  if (clientContactId) {
    const [contact] = await database
      .select({
        id: clientContacts.id,
        name: clientContacts.name,
        clientCompanyId: clientContacts.clientCompanyId,
      })
      .from(clientContacts)
      .where(
        and(
          eq(clientContacts.id, clientContactId),
          eq(clientContacts.workspaceId, workspace.id),
          isNull(clientContacts.deletedAt),
        ),
      )
      .limit(1);
    if (!contact || contact.clientCompanyId !== client.id) throw new Error("Client contact was not found");
    contactName = contact.name;
  }

  let quoteId = input.quoteId?.trim();
  let versionNumber = 1;
  if (quoteId) {
    const [existing] = await database
      .select({ id: quotes.id })
      .from(quotes)
      .where(and(eq(quotes.id, quoteId), eq(quotes.workspaceId, workspace.id), isNull(quotes.deletedAt)))
      .limit(1);
    if (!existing) throw new Error("Quote was not found");
    const [latest] = await database
      .select({ versionNumber: quoteVersions.versionNumber })
      .from(quoteVersions)
      .where(eq(quoteVersions.quoteId, quoteId))
      .orderBy(desc(quoteVersions.versionNumber))
      .limit(1);
    versionNumber = nextQuoteVersionNumber(latest?.versionNumber ?? 0);
  } else {
    const projectId = input.projectId?.trim() || null;
    if (projectId) {
      const [project] = await database
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.id, projectId),
            eq(projects.workspaceId, workspace.id),
            eq(projects.clientCompanyId, client.id),
            isNull(projects.deletedAt),
          ),
        )
        .limit(1);
      if (!project) throw new Error("Project was not found");
    }
    const submissionId = input.submissionId;
    try {
      const [created] = await database
        .insert(quotes)
        .values({
          workspaceId: workspace.id,
          clientCompanyId: client.id,
          projectId,
          ...(submissionId ? { submissionId } : {}),
        })
        .returning({ id: quotes.id });
      quoteId = created.id;
    } catch (error) {
      if (!submissionId || !isUniqueViolationError(error, QUOTES_SUBMISSION_INDEX)) throw error;
      // 같은 제출로 새 견적을 만드는 시도를 이미 한 번 처리했다. 오류를 보이지 않고, 그때
      // 만든 견적·버전을 찾아 지금 성공한 것과 똑같이 끝낸다 — 두 번째 quoteVersions 행을
      // 새로 만들지 않는다(만들면 quote_versions_quote_version_number_idx가 또 걸리거나,
      // 걸리지 않더라도 존재하지 않아야 할 버전이 하나 더 생긴다).
      const [existingQuote] = await database
        .select({ id: quotes.id })
        .from(quotes)
        .where(and(eq(quotes.workspaceId, workspace.id), eq(quotes.submissionId, submissionId)))
        .limit(1);
      if (!existingQuote) throw error;
      const [existingVersion] = await database
        .select({ id: quoteVersions.id, versionNumber: quoteVersions.versionNumber })
        .from(quoteVersions)
        .where(eq(quoteVersions.quoteId, existingQuote.id))
        .orderBy(desc(quoteVersions.versionNumber))
        .limit(1);
      if (!existingVersion) throw error;
      return { quoteId: existingQuote.id, versionId: existingVersion.id, versionNumber: existingVersion.versionNumber };
    }
  }

  const [version] = await database
    .insert(quoteVersions)
    .values({
      workspaceId: workspace.id,
      quoteId,
      versionNumber,
      title,
      items: amounts.items,
      subtotalAmount: amounts.subtotalAmount,
      vatAmount: amounts.vatAmount,
      totalAmount: amounts.totalAmount,
      vatMode: amounts.vatMode,
      targetMarginPercent: amounts.targetMarginPercent,
      operatingCostPercent: amounts.operatingCostPercent,
      costAmount: amounts.costAmount,
      issuedOn,
      validUntil,
      clientContactId,
      contactName,
      note: input.note?.trim() || null,
    })
    .returning({ id: quoteVersions.id });
  await database.update(quotes).set({ updatedAt: new Date() }).where(eq(quotes.id, quoteId));
  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "quote.version_created",
    payload: { quoteId, quoteVersionId: version.id, versionNumber },
  });
  return { quoteId, versionId: version.id, versionNumber };
}

export async function listFounderQuoteEmailDeliveries(authUserId: string, quoteId: string, quoteVersionId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "quotes");
  const database = createDatabase();
  return database.select({ id: quoteEmailDeliveries.id, recipient: quoteEmailDeliveries.recipient, subject: quoteEmailDeliveries.subject, status: quoteEmailDeliveries.status, createdAt: quoteEmailDeliveries.createdAt, sentAt: quoteEmailDeliveries.sentAt })
    .from(quoteEmailDeliveries).where(and(eq(quoteEmailDeliveries.workspaceId, workspace.id), eq(quoteEmailDeliveries.quoteId, quoteId), eq(quoteEmailDeliveries.quoteVersionId, quoteVersionId))).orderBy(desc(quoteEmailDeliveries.createdAt));
}

export async function sendFounderQuoteEmail(input: {
  actorUserId: string;
  message: string;
  quoteId: string;
  quoteVersionId: string;
  recipient: string;
  subject: string;
}) {
  if (!quoteEmailConfigured()) throw new Error("Quote email service is not configured");
  const workspace = await ensureFounderWorkspace(input.actorUserId, "quotes");
  const database = createDatabase();
  const [quote] = await database.select({ id: quotes.id, clientName: clientCompanies.name }).from(quotes).innerJoin(clientCompanies, eq(quotes.clientCompanyId, clientCompanies.id))
    .where(and(eq(quotes.id, input.quoteId), eq(quotes.workspaceId, workspace.id), isNull(quotes.deletedAt), isNull(clientCompanies.deletedAt))).limit(1);
  const [version] = await database.select().from(quoteVersions).where(and(eq(quoteVersions.id, input.quoteVersionId), eq(quoteVersions.quoteId, input.quoteId), eq(quoteVersions.workspaceId, workspace.id))).limit(1);
  if (!quote || !version) throw new Error("Quote version was not found");
  const [delivery] = await database.insert(quoteEmailDeliveries).values({ workspaceId: workspace.id, quoteId: quote.id, quoteVersionId: version.id, recipient: input.recipient, subject: input.subject, message: input.message }).returning({ id: quoteEmailDeliveries.id });

  try {
    const items = normalizeStoredQuoteItemsForPdf(version.items);
    const providerMessageId = await deliverQuoteEmail({
      clientName: quote.clientName,
      message: input.message,
      pdf: await createQuotePdf({
        clientName: quote.clientName,
        contactName: version.contactName,
        title: version.title,
        versionNumber: version.versionNumber,
        items,
        subtotalAmount: version.subtotalAmount,
        vatAmount: version.vatAmount,
        totalAmount: version.totalAmount,
        vatMode: version.vatMode,
        note: version.note,
        issuedOn: version.issuedOn,
        validUntil: version.validUntil,
        issuer: await getFounderCompanyProfile(input.actorUserId),
      }),
      quoteTitle: version.title,
      recipient: input.recipient,
      subject: input.subject,
      versionNumber: version.versionNumber,
      idempotencyKey: `quote-email-${delivery.id}`,
    });
    await database.update(quoteEmailDeliveries).set({ status: "accepted", providerMessageId, sentAt: new Date(), updatedAt: new Date() }).where(eq(quoteEmailDeliveries.id, delivery.id));
    await database.insert(auditEvents).values({ workspaceId: workspace.id, actorUserId: input.actorUserId, eventType: "quote.email_accepted", payload: { quoteId: quote.id, quoteVersionId: version.id, quoteEmailDeliveryId: delivery.id } });
    return { deliveryId: delivery.id };
  } catch {
    await database.update(quoteEmailDeliveries).set({ status: "failed", failureReason: "provider_rejected_or_unavailable", updatedAt: new Date() }).where(eq(quoteEmailDeliveries.id, delivery.id));
    await database.insert(auditEvents).values({ workspaceId: workspace.id, actorUserId: input.actorUserId, eventType: "quote.email_failed", payload: { quoteId: quote.id, quoteVersionId: version.id, quoteEmailDeliveryId: delivery.id } });
    throw new Error("Quote email could not be sent");
  }
}
