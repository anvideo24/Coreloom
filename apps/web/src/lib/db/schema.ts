import { desc } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const workspaceRole = pgEnum("workspace_role", ["founder"]);
export const companySetupStatus = pgEnum("company_setup_status", ["not_started", "in_progress", "complete", "not_applicable"]);
export const projectStatus = pgEnum("project_status", ["planned", "active", "on_hold", "complete"]);
export const quoteEmailDeliveryStatus = pgEnum("quote_email_delivery_status", ["pending", "accepted", "failed"]);
export const contractStatus = pgEnum("contract_status", ["draft", "original_recorded", "executed"]);
export const contractExecutionMethod = pgEnum("contract_execution_method", ["stamped_original"]);

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

export const companySetupItems = pgTable(
  "company_setup_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
    code: text("code").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    isConditional: boolean("is_conditional").notNull().default(false),
    sourceUrl: text("source_url").notNull(),
    status: companySetupStatus("status").notNull().default("not_started"),
    evidenceReference: text("evidence_reference"),
    note: text("note"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    uniqueIndex("company_setup_items_workspace_code_idx").on(table.workspaceId, table.code),
    index("company_setup_items_workspace_updated_at_idx").on(table.workspaceId, desc(table.updatedAt)),
  ],
);

export const clientCompanies = pgTable(
  "client_companies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
    name: text("name").notNull(),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    uniqueIndex("client_companies_workspace_name_idx").on(table.workspaceId, table.name),
    index("client_companies_workspace_updated_at_idx").on(table.workspaceId, desc(table.updatedAt)),
  ],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
    clientCompanyId: uuid("client_company_id").notNull().references(() => clientCompanies.id),
    name: text("name").notNull(),
    status: projectStatus("status").notNull().default("planned"),
    progressPercent: integer("progress_percent").notNull().default(0),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("projects_workspace_updated_at_idx").on(table.workspaceId, desc(table.updatedAt)),
    index("projects_client_company_updated_at_idx").on(table.clientCompanyId, desc(table.updatedAt)),
  ],
);

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
    clientCompanyId: uuid("client_company_id").notNull().references(() => clientCompanies.id),
    projectId: uuid("project_id").references(() => projects.id),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("quotes_workspace_updated_at_idx").on(table.workspaceId, desc(table.updatedAt)),
    index("quotes_client_company_updated_at_idx").on(table.clientCompanyId, desc(table.updatedAt)),
  ],
);

export const quoteVersions = pgTable(
  "quote_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
    quoteId: uuid("quote_id").notNull().references(() => quotes.id),
    versionNumber: integer("version_number").notNull(),
    title: text("title").notNull(),
    items: jsonb("items").notNull(),
    subtotalAmount: integer("subtotal_amount").notNull(),
    vatAmount: integer("vat_amount").notNull(),
    totalAmount: integer("total_amount").notNull(),
    note: text("note"),
    createdAt,
  },
  (table) => [
    uniqueIndex("quote_versions_quote_version_number_idx").on(table.quoteId, table.versionNumber),
    index("quote_versions_quote_created_at_idx").on(table.quoteId, desc(table.createdAt)),
  ],
);

export const quoteEmailDeliveries = pgTable(
  "quote_email_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
    quoteId: uuid("quote_id").notNull().references(() => quotes.id),
    quoteVersionId: uuid("quote_version_id").notNull().references(() => quoteVersions.id),
    recipient: text("recipient").notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    status: quoteEmailDeliveryStatus("status").notNull().default("pending"),
    providerMessageId: text("provider_message_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    createdAt,
    updatedAt,
  },
  (table) => [index("quote_email_deliveries_quote_version_created_at_idx").on(table.quoteVersionId, desc(table.createdAt))],
);

export const contracts = pgTable(
  "contracts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
    clientCompanyId: uuid("client_company_id").notNull().references(() => clientCompanies.id),
    projectId: uuid("project_id").references(() => projects.id),
    quoteId: uuid("quote_id").notNull().references(() => quotes.id),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    uniqueIndex("contracts_quote_id_idx").on(table.quoteId),
    index("contracts_workspace_updated_at_idx").on(table.workspaceId, desc(table.updatedAt)),
    index("contracts_client_company_updated_at_idx").on(table.clientCompanyId, desc(table.updatedAt)),
  ],
);

export const contractVersions = pgTable(
  "contract_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
    contractId: uuid("contract_id").notNull().references(() => contracts.id),
    quoteVersionId: uuid("quote_version_id").notNull().references(() => quoteVersions.id),
    versionNumber: integer("version_number").notNull(),
    title: text("title").notNull(),
    items: jsonb("items").notNull(),
    subtotalAmount: integer("subtotal_amount").notNull(),
    vatAmount: integer("vat_amount").notNull(),
    totalAmount: integer("total_amount").notNull(),
    currency: text("currency").notNull().default("KRW"),
    status: contractStatus("status").notNull().default("draft"),
    executionMethod: contractExecutionMethod("execution_method").notNull().default("stamped_original"),
    originalReference: text("original_reference"),
    note: text("note"),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("contract_versions_contract_version_number_idx").on(table.contractId, table.versionNumber),
    index("contract_versions_contract_created_at_idx").on(table.contractId, desc(table.createdAt)),
  ],
);
