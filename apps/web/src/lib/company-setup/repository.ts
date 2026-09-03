import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import { createDatabase } from "@/lib/db/client";
import { auditEvents, companySetupItems, workspaceMembers, workspaces } from "@/lib/db/schema";
import { companySetupTemplates, normalizeCompanySetupUpdate } from "@/lib/domain/company-setup";

async function ensureFounderWorkspace(authUserId: string) {
  const database = createDatabase();
  const [existing] = await database
    .select({ id: workspaces.id })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaceMembers.authUserId, authUserId), isNull(workspaceMembers.deletedAt)))
    .limit(1);

  if (existing) return existing;

  const [workspace] = await database
    .insert(workspaces)
    .values({ name: "Coreloom 대표 운영" })
    .returning({ id: workspaces.id });

  await database.insert(workspaceMembers).values({
    workspaceId: workspace.id,
    authUserId,
    role: "founder",
  });
  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: authUserId,
    eventType: "workspace.created",
    payload: { origin: "company-setup" },
  });

  return workspace;
}

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
  return { workspace, items };
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
