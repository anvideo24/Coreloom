import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import { createDatabase } from "@/lib/db/client";
import { auditEvents, companySetupItems, workspaceCompanyProfiles } from "@/lib/db/schema";
import { companySetupTemplates, normalizeCompanySetupUpdate } from "@/lib/domain/company-setup";
import {
  normalizeWorkspaceCompanyProfileInput,
  resolveQuoteIssuerProfile,
  type WorkspaceCompanyProfileInput,
} from "@/lib/quotes/issuer";
import { ensureFounderWorkspace } from "@/lib/workspace/founder-workspace";

async function ensureCompanySetupItems(workspaceId: string, actorUserId: string) {
  const database = createDatabase();
  const existing = await database
    .select()
    .from(companySetupItems)
    .where(and(eq(companySetupItems.workspaceId, workspaceId), isNull(companySetupItems.deletedAt)))
    .orderBy(asc(companySetupItems.createdAt));

  if (existing.length > 0) return existing;

  await database.insert(companySetupItems).values(
    companySetupTemplates.map((item) => ({
      workspaceId,
      code: item.code,
      title: item.title,
      description: item.description,
      isConditional: item.isConditional,
      sourceUrl: item.sourceUrl,
    })),
  );
  await database.insert(auditEvents).values({
    workspaceId,
    actorUserId,
    eventType: "company_setup.seeded",
    payload: { itemCount: companySetupTemplates.length },
  });

  return database
    .select()
    .from(companySetupItems)
    .where(and(eq(companySetupItems.workspaceId, workspaceId), isNull(companySetupItems.deletedAt)))
    .orderBy(asc(companySetupItems.createdAt));
}

export async function listFounderCompanySetup(authUserId: string) {
  const workspace = await ensureFounderWorkspace(authUserId);
  const items = await ensureCompanySetupItems(workspace.id, authUserId);
  const companyProfile = await getFounderCompanyProfile(authUserId);
  return { workspace, items, companyProfile };
}

export async function getFounderCompanyProfile(authUserId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "quotes");
  const database = createDatabase();
  const [row] = await database
    .select()
    .from(workspaceCompanyProfiles)
    .where(eq(workspaceCompanyProfiles.workspaceId, workspace.id))
    .limit(1);
  return resolveQuoteIssuerProfile(row ?? null);
}

export async function upsertFounderCompanyProfile(input: {
  actorUserId: string;
} & WorkspaceCompanyProfileInput) {
  const workspace = await ensureFounderWorkspace(input.actorUserId);
  const database = createDatabase();
  const normalized = normalizeWorkspaceCompanyProfileInput(input);
  const [existing] = await database
    .select({ id: workspaceCompanyProfiles.id })
    .from(workspaceCompanyProfiles)
    .where(eq(workspaceCompanyProfiles.workspaceId, workspace.id))
    .limit(1);

  const saved = existing
    ? (
        await database
          .update(workspaceCompanyProfiles)
          .set({ ...normalized, updatedAt: new Date() })
          .where(eq(workspaceCompanyProfiles.id, existing.id))
          .returning()
      )[0]
    : (
        await database
          .insert(workspaceCompanyProfiles)
          .values({ workspaceId: workspace.id, ...normalized })
          .returning()
      )[0];

  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "company_profile.upserted",
    payload: {
      hasBusinessRegistrationNumber: Boolean(normalized.businessRegistrationNumber),
      hasBankAccount: Boolean(normalized.bankAccount),
    },
  });

  return resolveQuoteIssuerProfile(saved);
}

export async function updateFounderCompanySetupItem(input: {
  actorUserId: string;
  itemId: string;
  status: string;
  evidenceReference?: string | null;
  note?: string | null;
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId);
  const database = createDatabase();
  const [item] = await database
    .select({ id: companySetupItems.id })
    .from(companySetupItems)
    .where(and(
      eq(companySetupItems.id, input.itemId),
      eq(companySetupItems.workspaceId, workspace.id),
      isNull(companySetupItems.deletedAt),
    ))
    .limit(1);

  if (!item) throw new Error("Company setup item was not found");

  const update = normalizeCompanySetupUpdate(input);
  const [saved] = await database
    .update(companySetupItems)
    .set({ ...update, updatedAt: new Date() })
    .where(eq(companySetupItems.id, item.id))
    .returning();

  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "company_setup.updated",
    payload: {
      itemId: item.id,
      status: update.status,
      hasEvidenceReference: Boolean(update.evidenceReference),
      hasNote: Boolean(update.note),
    },
  });

  return saved;
}
