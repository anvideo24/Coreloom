"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { founderSession } from "@/lib/auth/session";
import {
  createFounderClient,
  createFounderClientContact,
  createFounderProject,
  updateFounderClient,
  updateFounderProjectProgress,
} from "@/lib/clients-projects/repository";

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item : "";
}

function companyProfileFromForm(formData: FormData) {
  return {
    name: value(formData, "name"),
    businessRegistrationNumber: value(formData, "businessRegistrationNumber"),
    representativeName: value(formData, "representativeName"),
    address: value(formData, "address"),
    businessType: value(formData, "businessType"),
    businessItem: value(formData, "businessItem"),
    website: value(formData, "website"),
    phone: value(formData, "phone"),
    email: value(formData, "email"),
    businessRegistrationRef: value(formData, "businessRegistrationRef"),
  };
}

async function authorizedFounder() {
  const session = await founderSession();
  if (session.state !== "authorized") throw new Error("Founder access is required");
  return session.founder;
}

export async function createClientAction(formData: FormData) {
  const founder = await authorizedFounder();
  const created = await createFounderClient({
    actorUserId: founder.id,
    ...companyProfileFromForm(formData),
  });
  const contactName = value(formData, "contactName").trim();
  if (contactName) {
    await createFounderClientContact({
      actorUserId: founder.id,
      clientId: created.id,
      name: contactName,
      role: value(formData, "contactRole"),
      email: value(formData, "contactEmail"),
      phone: value(formData, "contactPhone"),
      relationStatus: value(formData, "relationStatus") || "active",
      taxInvoiceRecipient: value(formData, "taxInvoiceRecipient"),
    });
  }
  revalidatePath("/clients");
  revalidatePath("/clients-projects");
  revalidatePath("/quotes");
  redirect(`/clients/${created.id}`);
}

export async function updateClientAction(formData: FormData) {
  const founder = await authorizedFounder();
  const clientId = value(formData, "clientId");
  await updateFounderClient({
    actorUserId: founder.id,
    clientId,
    ...companyProfileFromForm(formData),
  });
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients-projects");
  revalidatePath("/quotes");
  redirect(`/clients/${clientId}`);
}

export async function createClientContactAction(formData: FormData) {
  const founder = await authorizedFounder();
  const clientId = value(formData, "clientId");
  await createFounderClientContact({
    actorUserId: founder.id,
    clientId,
    name: value(formData, "name"),
    role: value(formData, "role"),
    email: value(formData, "email"),
    phone: value(formData, "phone"),
    relationStatus: value(formData, "relationStatus"),
    taxInvoiceRecipient: value(formData, "taxInvoiceRecipient"),
  });
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients-projects");
  revalidatePath("/quotes");
  redirect(`/clients/${clientId}`);
}

export async function createProjectAction(formData: FormData) {
  const founder = await authorizedFounder();
  await createFounderProject({
    actorUserId: founder.id,
    clientId: value(formData, "clientId"),
    name: value(formData, "name"),
    status: value(formData, "status"),
    progressPercent: value(formData, "progressPercent"),
  });
  revalidatePath("/clients");
  revalidatePath("/clients-projects");
  revalidatePath("/dashboard");
}

export async function updateProjectProgressAction(formData: FormData) {
  const founder = await authorizedFounder();
  const projectId = value(formData, "projectId");
  await updateFounderProjectProgress({
    actorUserId: founder.id,
    projectId,
    status: value(formData, "status"),
    progressPercent: value(formData, "progressPercent"),
  });
  revalidatePath("/clients");
  revalidatePath("/clients-projects");
  revalidatePath(`/clients-projects/${projectId}`);
  revalidatePath("/dashboard");
}
