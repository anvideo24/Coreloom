import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { createDatabase } from "@/lib/db/client";
import { auditEvents, workspaceMembers, workspaces } from "@/lib/db/schema";

export async function ensureFounderWorkspace(authUserId: string, origin = "coreloom") {
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
    payload: { origin },
  });

  return workspace;
}
