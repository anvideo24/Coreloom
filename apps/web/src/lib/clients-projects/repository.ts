import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { createDatabase } from "@/lib/db/client";
import { auditEvents, clientCompanies, clientContacts, projects } from "@/lib/db/schema";
import {
  normalizeClientCompanyProfile,
  normalizeClientContact,
  normalizeProjectProgressUpdate,
  normalizeProjectRegistration,
  type ClientCompanyProfile,
} from "@/lib/domain/clients-projects";
import { ensureFounderWorkspace } from "@/lib/workspace/founder-workspace";

const clientCompanyColumns = {
  id: clientCompanies.id,
  name: clientCompanies.name,
  businessRegistrationNumber: clientCompanies.businessRegistrationNumber,
  representativeName: clientCompanies.representativeName,
  address: clientCompanies.address,
  businessType: clientCompanies.businessType,
  businessItem: clientCompanies.businessItem,
  website: clientCompanies.website,
  phone: clientCompanies.phone,
  email: clientCompanies.email,
  businessRegistrationRef: clientCompanies.businessRegistrationRef,
  taxType: clientCompanies.taxType,
  tradeKind: clientCompanies.tradeKind,
  bankName: clientCompanies.bankName,
  bankAccount: clientCompanies.bankAccount,
  accountHolder: clientCompanies.accountHolder,
  bankBookRef: clientCompanies.bankBookRef,
} as const;

export async function listFounderClientsAndProjects(authUserId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "clients-projects");
  const database = createDatabase();
  const clients = await database
    .select(clientCompanyColumns)
    .from(clientCompanies)
    .where(and(eq(clientCompanies.workspaceId, workspace.id), isNull(clientCompanies.deletedAt)))
    .orderBy(asc(clientCompanies.name));
  const projectRows = await database
    .select({
      id: projects.id,
      name: projects.name,
      summary: projects.summary,
      status: projects.status,
      progressPercent: projects.progressPercent,
      startOn: projects.startOn,
      targetEndOn: projects.targetEndOn,
      clientCompanyId: projects.clientCompanyId,
      clientName: clientCompanies.name,
    })
    .from(projects)
    .innerJoin(clientCompanies, eq(projects.clientCompanyId, clientCompanies.id))
    .where(and(
      eq(projects.workspaceId, workspace.id),
      isNull(projects.deletedAt),
      isNull(clientCompanies.deletedAt),
    ))
    .orderBy(desc(projects.updatedAt));

  const contacts = await database
    .select({
      id: clientContacts.id,
      name: clientContacts.name,
      role: clientContacts.role,
      email: clientContacts.email,
      phone: clientContacts.phone,
      relationStatus: clientContacts.relationStatus,
      taxInvoiceRecipient: clientContacts.taxInvoiceRecipient,
      clientCompanyId: clientContacts.clientCompanyId,
      clientName: clientCompanies.name,
    })
    .from(clientContacts)
    .innerJoin(clientCompanies, eq(clientContacts.clientCompanyId, clientCompanies.id))
    .where(and(
      eq(clientContacts.workspaceId, workspace.id),
      isNull(clientContacts.deletedAt),
      isNull(clientCompanies.deletedAt),
    ))
    .orderBy(asc(clientCompanies.name), asc(clientContacts.name));

  return { clients, projects: projectRows, contacts };
}

export async function listFounderClients(authUserId: string) {
  const { clients, projects, contacts } = await listFounderClientsAndProjects(authUserId);
  return clients.map((client) => ({
    ...client,
    contactCount: contacts.filter((contact) => contact.clientCompanyId === client.id).length,
    projectCount: projects.filter((project) => project.clientCompanyId === client.id).length,
  }));
}

export async function getFounderClient(authUserId: string, clientId: string) {
  const { clients, projects, contacts } = await listFounderClientsAndProjects(authUserId);
  const client = clients.find((row) => row.id === clientId);
  if (!client) return null;
  return {
    client,
    contacts: contacts.filter((contact) => contact.clientCompanyId === clientId),
    projects: projects.filter((project) => project.clientCompanyId === clientId),
  };
}

export async function createFounderClient(input: {
  actorUserId: string;
} & Parameters<typeof normalizeClientCompanyProfile>[0]) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "clients-projects");
  const database = createDatabase();
  const profile = normalizeClientCompanyProfile(input);
  const [created] = await database
    .insert(clientCompanies)
    .values({ workspaceId: workspace.id, ...profile })
    .onConflictDoNothing()
    .returning({ id: clientCompanies.id });

  if (!created) {
    throw new Error("같은 이름의 고객사가 이미 있습니다.");
  }

  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "client_company.created",
    payload: { clientCompanyId: created.id },
  });

  return created;
}

export async function updateFounderClient(input: {
  actorUserId: string;
  clientId: string;
} & Parameters<typeof normalizeClientCompanyProfile>[0]) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "clients-projects");
  const database = createDatabase();
  const profile = normalizeClientCompanyProfile(input);
  const [existing] = await database
    .select({ id: clientCompanies.id })
    .from(clientCompanies)
    .where(and(
      eq(clientCompanies.id, input.clientId),
      eq(clientCompanies.workspaceId, workspace.id),
      isNull(clientCompanies.deletedAt),
    ))
    .limit(1);

  if (!existing) throw new Error("Client was not found");

  await database
    .update(clientCompanies)
    .set({ ...profile, updatedAt: new Date() })
    .where(eq(clientCompanies.id, existing.id));

  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "client_company.updated",
    payload: { clientCompanyId: existing.id },
  });

  return existing;
}

export async function createFounderClientContact(input: {
  actorUserId: string;
  clientId: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  relationStatus: string;
  taxInvoiceRecipient?: boolean | string;
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "clients-projects");
  const database = createDatabase();
  const contact = normalizeClientContact(input);
  const [client] = await database
    .select({ id: clientCompanies.id })
    .from(clientCompanies)
    .where(and(
      eq(clientCompanies.id, contact.clientId),
      eq(clientCompanies.workspaceId, workspace.id),
      isNull(clientCompanies.deletedAt),
    ))
    .limit(1);

  if (!client) throw new Error("Client was not found");

  const [created] = await database
    .insert(clientContacts)
    .values({
      workspaceId: workspace.id,
      clientCompanyId: client.id,
      name: contact.name,
      role: contact.role,
      email: contact.email,
      phone: contact.phone,
      relationStatus: contact.relationStatus,
      taxInvoiceRecipient: contact.taxInvoiceRecipient,
    })
    .returning({ id: clientContacts.id });

  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "client_contact.created",
    payload: { clientContactId: created.id, clientCompanyId: client.id },
  });
}

export async function createFounderProject(input: {
  actorUserId: string;
  clientId: string;
  name: string;
  status: string;
  progressPercent: string;
  summary?: string;
  startOn?: string;
  targetEndOn?: string;
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "clients-projects");
  const database = createDatabase();
  const project = normalizeProjectRegistration(input);
  const [client] = await database
    .select({ id: clientCompanies.id })
    .from(clientCompanies)
    .where(and(
      eq(clientCompanies.id, project.clientId),
      eq(clientCompanies.workspaceId, workspace.id),
      isNull(clientCompanies.deletedAt),
    ))
    .limit(1);

  if (!client) throw new Error("Client was not found");

  const [created] = await database
    .insert(projects)
    .values({
      workspaceId: workspace.id,
      clientCompanyId: client.id,
      name: project.name,
      summary: project.summary,
      status: project.status,
      progressPercent: project.progressPercent,
      startOn: project.startOn,
      targetEndOn: project.targetEndOn,
    })
    .returning({ id: projects.id });

  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "project.created",
    payload: { projectId: created.id, clientCompanyId: client.id },
  });
}

export async function updateFounderProjectProgress(input: {
  actorUserId: string;
  projectId: string;
  status: string;
  progressPercent: string;
}) {
  const workspace = await ensureFounderWorkspace(input.actorUserId, "clients-projects");
  const database = createDatabase();
  const update = normalizeProjectProgressUpdate(input);
  const [project] = await database
    .select({ id: projects.id })
    .from(projects)
    .where(and(
      eq(projects.id, update.projectId),
      eq(projects.workspaceId, workspace.id),
      isNull(projects.deletedAt),
    ))
    .limit(1);

  if (!project) throw new Error("Project was not found");

  const [saved] = await database
    .update(projects)
    .set({ status: update.status, progressPercent: update.progressPercent, updatedAt: new Date() })
    .where(eq(projects.id, project.id))
    .returning();

  await database.insert(auditEvents).values({
    workspaceId: workspace.id,
    actorUserId: input.actorUserId,
    eventType: "project.progress_updated",
    payload: { projectId: project.id, status: update.status, progressPercent: update.progressPercent },
  });

  return saved;
}

export type { ClientCompanyProfile };
