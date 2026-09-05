import { desc } from "drizzle-orm";
import { boolean, date, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const workspaceRole = pgEnum("workspace_role", ["founder"]);
export const companySetupStatus = pgEnum("company_setup_status", ["not_started", "in_progress", "complete", "not_applicable"]);
export const projectStatus = pgEnum("project_status", ["planned", "active", "on_hold", "complete"]);
export const quoteEmailDeliveryStatus = pgEnum("quote_email_delivery_status", ["pending", "accepted", "failed"]);
export const contractStatus = pgEnum("contract_status", ["draft", "original_recorded", "executed"]);
export const contractExecutionMethod = pgEnum("contract_execution_method", ["stamped_original"]);
export const billingKind = pgEnum("billing_kind", ["down_payment", "interim", "final", "recurring"]);
export const billingStatus = pgEnum("billing_status", ["scheduled", "deposited"]);
export const billingRecurringInterval = pgEnum("billing_recurring_interval", ["monthly"]);
export const taskStatus = pgEnum("task_status", ["open", "done"]);
export const clientContactRelationStatus = pgEnum("client_contact_relation_status", ["active", "inactive"]);
export const rechoEvidenceKind = pgEnum("recho_evidence_kind", ["email", "call", "meeting"]);
export const aiProposalKind = pgEnum("ai_proposal_kind", ["agreement", "next_action", "risk"]);
export const aiProposalStatus = pgEnum("ai_proposal_status", ["proposed", "confirmed", "rejected"]);
export const ventureKind = pgEnum("venture_kind", ["app", "subscription"]);
export const revenueEntryStatus = pgEnum("revenue_entry_status", ["scheduled", "confirmed"]);
export const expenseEntryStatus = pgEnum("expense_entry_status", ["scheduled", "confirmed"]);
export const vaultDocumentKind = pgEnum("vault_document_kind", ["company_setup", "contract", "deliverable", "settlement", "other"]);
export const aiAgentStatus = pgEnum("ai_agent_status", ["active", "inactive"]);
export const aiAgentWorkLogStatus = pgEnum("ai_agent_work_log_status", ["pending", "approved", "rejected"]);
export const aiAgentModelProvider = pgEnum("ai_agent_model_provider", [
  "claude_subscription",
  "gpt_codex_subscription",
  "cursor_agent",
]);
export const quoteVatMode = pgEnum("quote_vat_mode", ["exclusive", "inclusive"]);
export const clientTaxType = pgEnum("client_tax_type", ["general", "simplified", "exempt"]);
export const clientTradeKind = pgEnum("client_trade_kind", ["sales", "purchase", "both"]);
export const ledgerAccountClass = pgEnum("ledger_account_class", [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
]);

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

/** 견적·청구 PDF에 쓰는 우리 회사(공급자)·입금 안내. 워크스페이스당 1건. */
export const workspaceCompanyProfiles = pgTable(
  "workspace_company_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    brandName: text("brand_name").notNull().default("coreloom"),
    legalName: text("legal_name"),
    businessRegistrationNumber: text("business_registration_number"),
    representativeName: text("representative_name"),
    address: text("address"),
    email: text("email"),
    bankName: text("bank_name"),
    bankAccount: text("bank_account"),
    accountHolder: text("account_holder"),
    swift: text("swift"),
    signatureSrc: text("signature_src"),
    createdAt,
    updatedAt,
  },
  (table) => [uniqueIndex("workspace_company_profiles_workspace_idx").on(table.workspaceId)],
);

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
    businessRegistrationNumber: text("business_registration_number"),
    representativeName: text("representative_name"),
    address: text("address"),
    businessType: text("business_type"),
    businessItem: text("business_item"),
    website: text("website"),
    phone: text("phone"),
    email: text("email"),
    businessRegistrationRef: text("business_registration_ref"),
    taxType: clientTaxType("tax_type"),
    tradeKind: clientTradeKind("trade_kind").notNull().default("sales"),
    bankName: text("bank_name"),
    bankAccount: text("bank_account"),
    accountHolder: text("account_holder"),
    bankBookRef: text("bank_book_ref"),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    uniqueIndex("client_companies_workspace_name_idx").on(table.workspaceId, table.name),
    index("client_companies_workspace_updated_at_idx").on(table.workspaceId, desc(table.updatedAt)),
  ],
);

export const clientContacts = pgTable(
  "client_contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
    clientCompanyId: uuid("client_company_id").notNull().references(() => clientCompanies.id),
    name: text("name").notNull(),
    role: text("role"),
    email: text("email"),
    phone: text("phone"),
    relationStatus: clientContactRelationStatus("relation_status").notNull().default("active"),
    taxInvoiceRecipient: boolean("tax_invoice_recipient").notNull().default(false),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("client_contacts_client_created_at_idx").on(table.clientCompanyId, desc(table.createdAt)),
    index("client_contacts_workspace_updated_at_idx").on(table.workspaceId, desc(table.updatedAt)),
  ],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
    clientCompanyId: uuid("client_company_id").notNull().references(() => clientCompanies.id),
    name: text("name").notNull(),
    summary: text("summary"),
    status: projectStatus("status").notNull().default("planned"),
    progressPercent: integer("progress_percent").notNull().default(0),
    startOn: date("start_on", { mode: "string" }),
    targetEndOn: date("target_end_on", { mode: "string" }),
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
    vatMode: quoteVatMode("vat_mode").notNull().default("exclusive"),
    targetMarginPercent: integer("target_margin_percent").notNull().default(30),
    operatingCostPercent: integer("operating_cost_percent").notNull().default(10),
    costAmount: integer("cost_amount").notNull().default(0),
    issuedOn: timestamp("issued_on", { withTimezone: true }).notNull().defaultNow(),
    validUntil: timestamp("valid_until", { withTimezone: true }).notNull().defaultNow(),
    clientContactId: uuid("client_contact_id").references(() => clientContacts.id),
    contactName: text("contact_name"),
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
    effectiveStartOn: date("effective_start_on", { mode: "string" }),
    effectiveEndOn: date("effective_end_on", { mode: "string" }),
    autoRenew: boolean("auto_renew").notNull().default(false),
    contractNumber: text("contract_number"),
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

export const billingRecurringSeries = pgTable(
  "billing_recurring_series",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
    contractId: uuid("contract_id").notNull().references(() => contracts.id),
    clientCompanyId: uuid("client_company_id").notNull().references(() => clientCompanies.id),
    projectId: uuid("project_id").references(() => projects.id),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("KRW"),
    interval: billingRecurringInterval("interval").notNull().default("monthly"),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    dueOffsetDays: integer("due_offset_days").notNull().default(0),
    note: text("note"),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("billing_recurring_series_workspace_start_idx").on(table.workspaceId, table.startDate),
    index("billing_recurring_series_contract_created_at_idx").on(table.contractId, desc(table.createdAt)),
  ],
);

export const billings = pgTable(
  "billings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
    contractId: uuid("contract_id").notNull().references(() => contracts.id),
    clientCompanyId: uuid("client_company_id").notNull().references(() => clientCompanies.id),
    projectId: uuid("project_id").references(() => projects.id),
    seriesId: uuid("series_id").references(() => billingRecurringSeries.id),
    kind: billingKind("kind").notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("KRW"),
    billingDate: date("billing_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    status: billingStatus("status").notNull().default("scheduled"),
    billingNumber: text("billing_number"),
    poNumber: text("po_number"),
    note: text("note"),
    depositedAt: timestamp("deposited_at", { withTimezone: true }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("billings_workspace_due_date_idx").on(table.workspaceId, table.dueDate),
    index("billings_contract_created_at_idx").on(table.contractId, desc(table.createdAt)),
    uniqueIndex("billings_series_billing_date_idx").on(table.seriesId, table.billingDate),
  ],
);

export const billingEmailDeliveries = pgTable(
  "billing_email_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
    billingId: uuid("billing_id").notNull().references(() => billings.id),
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
  (table) => [index("billing_email_deliveries_billing_created_at_idx").on(table.billingId, desc(table.createdAt))],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    clientCompanyId: uuid("client_company_id").notNull().references(() => clientCompanies.id),
    title: text("title").notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    completionCondition: text("completion_condition").notNull(),
    status: taskStatus("status").notNull().default("open"),
    assignedAgentId: uuid("assigned_agent_id").references(() => aiAgents.id),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("tasks_workspace_due_date_idx").on(table.workspaceId, table.dueDate),
    index("tasks_project_created_at_idx").on(table.projectId, desc(table.createdAt)),
    index("tasks_assigned_agent_idx").on(table.assignedAgentId),
  ],
);

export const rechoEvidence = pgTable(
  "recho_evidence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    clientCompanyId: uuid("client_company_id").notNull().references(() => clientCompanies.id),
    kind: rechoEvidenceKind("kind").notNull(),
    title: text("title").notNull(),
    originalIdentifier: text("original_identifier").notNull(),
    originalUrl: text("original_url"),
    occurredOn: date("occurred_on", { mode: "string" }).notNull(),
    occurredTime: text("occurred_time").notNull(),
    linkReason: text("link_reason").notNull(),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    uniqueIndex("recho_evidence_project_original_idx").on(table.projectId, table.originalIdentifier),
    index("recho_evidence_workspace_occurred_on_idx").on(table.workspaceId, desc(table.occurredOn)),
  ],
);

export const aiProposals = pgTable(
  "ai_proposals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    clientCompanyId: uuid("client_company_id").notNull().references(() => clientCompanies.id),
    evidenceId: uuid("evidence_id").notNull().references(() => rechoEvidence.id),
    kind: aiProposalKind("kind").notNull(),
    body: text("body").notNull(),
    status: aiProposalStatus("status").notNull().default("proposed"),
    decisionReason: text("decision_reason"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("ai_proposals_workspace_created_at_idx").on(table.workspaceId, desc(table.createdAt)),
    index("ai_proposals_evidence_created_at_idx").on(table.evidenceId, desc(table.createdAt)),
  ],
);

export const ventures = pgTable(
  "ventures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
    name: text("name").notNull(),
    kind: ventureKind("kind").notNull(),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    uniqueIndex("ventures_workspace_name_idx").on(table.workspaceId, table.name),
    index("ventures_workspace_updated_at_idx").on(table.workspaceId, desc(table.updatedAt)),
  ],
);

/** 워크스페이스 계정과목 마스터. 분개·전표는 두지 않고 원장 선택용이다. */
export const ledgerAccounts = pgTable(
  "ledger_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    accountClass: ledgerAccountClass("account_class").notNull(),
    categoryKey: text("category_key"),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    uniqueIndex("ledger_accounts_workspace_code_idx").on(table.workspaceId, table.code),
    index("ledger_accounts_workspace_class_idx").on(table.workspaceId, table.accountClass),
  ],
);

export const revenueEntries = pgTable(
  "revenue_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
    ventureId: uuid("venture_id").references(() => ventures.id),
    clientCompanyId: uuid("client_company_id").references(() => clientCompanies.id),
    projectId: uuid("project_id").references(() => projects.id),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("KRW"),
    occurredOn: date("occurred_on", { mode: "string" }).notNull(),
    settlementDate: date("settlement_date", { mode: "string" }).notNull(),
    status: revenueEntryStatus("status").notNull().default("scheduled"),
    accountCategory: text("account_category"),
    ledgerAccountId: uuid("ledger_account_id").references(() => ledgerAccounts.id),
    note: text("note"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("revenue_entries_workspace_occurred_on_idx").on(table.workspaceId, desc(table.occurredOn)),
  ],
);

export const revenueRefunds = pgTable(
  "revenue_refunds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
    revenueEntryId: uuid("revenue_entry_id").notNull().references(() => revenueEntries.id),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("KRW"),
    refundedOn: date("refunded_on", { mode: "string" }).notNull(),
    reason: text("reason").notNull(),
    createdAt,
  },
  (table) => [
    index("revenue_refunds_entry_created_at_idx").on(table.revenueEntryId, desc(table.createdAt)),
    index("revenue_refunds_workspace_created_at_idx").on(table.workspaceId, desc(table.createdAt)),
  ],
);

export const expenseEntries = pgTable(
  "expense_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
    ventureId: uuid("venture_id").references(() => ventures.id),
    clientCompanyId: uuid("client_company_id").references(() => clientCompanies.id),
    projectId: uuid("project_id").references(() => projects.id),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("KRW"),
    occurredOn: date("occurred_on", { mode: "string" }).notNull(),
    settlementDate: date("settlement_date", { mode: "string" }).notNull(),
    status: expenseEntryStatus("status").notNull().default("scheduled"),
    accountCategory: text("account_category"),
    ledgerAccountId: uuid("ledger_account_id").references(() => ledgerAccounts.id),
    supplierName: text("supplier_name"),
    supplierClientCompanyId: uuid("supplier_client_company_id").references(() => clientCompanies.id),
    note: text("note"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("expense_entries_workspace_occurred_on_idx").on(table.workspaceId, desc(table.occurredOn)),
  ],
);

export const vaultDocuments = pgTable(
  "vault_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
    title: text("title").notNull(),
    kind: vaultDocumentKind("kind").notNull(),
    clientCompanyId: uuid("client_company_id").references(() => clientCompanies.id),
    projectId: uuid("project_id").references(() => projects.id),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("vault_documents_workspace_updated_at_idx").on(table.workspaceId, desc(table.updatedAt)),
  ],
);

export const vaultDocumentVersions = pgTable(
  "vault_document_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
    documentId: uuid("document_id").notNull().references(() => vaultDocuments.id),
    versionNumber: integer("version_number").notNull(),
    originalReference: text("original_reference").notNull(),
    storedFilename: text("stored_filename"),
    contentType: text("content_type"),
    byteSize: integer("byte_size"),
    storageKey: text("storage_key"),
    note: text("note"),
    createdAt,
  },
  (table) => [
    uniqueIndex("vault_document_versions_document_version_idx").on(table.documentId, table.versionNumber),
    index("vault_document_versions_document_created_at_idx").on(table.documentId, desc(table.createdAt)),
  ],
);

export const aiAgents = pgTable(
  "ai_agents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
    name: text("name").notNull(),
    purpose: text("purpose").notNull(),
    allowedWork: jsonb("allowed_work").$type<string[]>().notNull(),
    accessScope: text("access_scope").notNull(),
    projectId: uuid("project_id").references(() => projects.id),
    ventureId: uuid("venture_id").references(() => ventures.id),
    workStyle: text("work_style"),
    answerStyle: text("answer_style"),
    procedure: text("procedure"),
    instructions: text("instructions"),
    modelProvider: aiAgentModelProvider("model_provider").notNull().default("claude_subscription"),
    capabilities: jsonb("capabilities").$type<Record<string, boolean>>().notNull().default({
      save_records: false,
      send_external: false,
      confirm_money: false,
      change_permissions: false,
    }),
    status: aiAgentStatus("status").notNull().default("active"),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (table) => [
    index("ai_agents_workspace_updated_at_idx").on(table.workspaceId, desc(table.updatedAt)),
  ],
);

export const agentChatThreads = pgTable("agent_chat_threads", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  agentId: uuid("agent_id").notNull().references(() => aiAgents.id),
  title: text("title").notNull(),
  model: text("model").notNull(),
  busyUntil: timestamp("busy_until", { withTimezone: true }),
  createdAt, updatedAt,
}, (table) => [index("agent_chat_threads_agent_idx").on(table.workspaceId, table.agentId)]);

export const agentChatMessages = pgTable("agent_chat_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  threadId: uuid("thread_id").notNull().references(() => agentChatThreads.id),
  role: text("role").notNull(),
  body: text("body").notNull(),
  model: text("model").notNull(),
  status: text("status").notNull().default("complete"),
  createdAt,
}, (table) => [index("agent_chat_messages_thread_idx").on(table.threadId, table.createdAt)]);

export const aiAgentWorkLogs = pgTable(
  "ai_agent_work_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
    agentId: uuid("agent_id").notNull().references(() => aiAgents.id),
    taskId: uuid("task_id").references(() => tasks.id),
    recordedByUserId: text("recorded_by_user_id").notNull(),
    requestNote: text("request_note").notNull(),
    inputNote: text("input_note").notNull(),
    resultNote: text("result_note"),
    status: aiAgentWorkLogStatus("status").notNull().default("pending"),
    decisionReason: text("decision_reason"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("ai_agent_work_logs_agent_created_at_idx").on(table.agentId, desc(table.createdAt)),
    index("ai_agent_work_logs_workspace_created_at_idx").on(table.workspaceId, desc(table.createdAt)),
  ],
);
