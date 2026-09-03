"use server";

import { revalidatePath } from "next/cache";

import { founderSession } from "@/lib/auth/session";
import { createFounderClient, createFounderClientContact, createFounderProject, updateFounderProjectProgress } from "@/lib/clients-projects/repository";

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item : "";
}

async function authorizedFounder() {
  const session = await founderSession();
  if (session.state !== "authorized") throw new Error("Founder access is required");
  return session.founder;
}

export async function createClientAction(formData: FormData) {
  const founder = await authorizedFounder();
  await createFounderClient({ actorUserId: founder.id, name: value(formData, "name") });
  revalidatePath("/clients-projects");
}

export async function createClientContactAction(formData: FormData) {
  const founder = await authorizedFounder();
  await createFounderClientContact({
    actorUserId: founder.id,
    clientId: value(formData, "clientId"),
    name: value(formData, "name"),
    role: value(formData, "role"),
    email: value(formData, "email"),
    phone: value(formData, "phone"),
    relationStatus: value(formData, "relationStatus"),
  });
  revalidatePath("/clients-projects");
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
  revalidatePath("/clients-projects");
}

export async function updateProjectProgressAction(formData: FormData) {
  const founder = await authorizedFounder();
  await updateFounderProjectProgress({
    actorUserId: founder.id,
    projectId: value(formData, "projectId"),
    status: value(formData, "status"),
    progressPercent: value(formData, "progressPercent"),
  });
  revalidatePath("/clients-projects");
}
