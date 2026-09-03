import { desc } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const workspaceRole = pgEnum("workspace_role", ["founder"]);

const createdAt = timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();
const deletedAt = timestamp("deleted_at", { withTimezone: true });

export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt,
  updatedAt,
  deletedAt,
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
    authUserId: text("auth_user_id").notNull(),
    role: workspaceRole("role").notNull().default("founder"),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    uniqueIndex("workspace_members_active_auth_user_idx").on(table.authUserId),
    uniqueIndex("workspace_members_active_founder_idx").on(table.workspaceId),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
    actorUserId: text("actor_user_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    createdAt,
  },
  (table) => [index("audit_events_workspace_created_at_idx").on(table.workspaceId, desc(table.createdAt))],
);
