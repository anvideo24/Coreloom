"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { founderSession } from "@/lib/auth/session";
import { addFounderVaultDocumentVersion, createFounderVaultDocument } from "@/lib/documents/repository";

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item : "";
}

async function uploadedFile(formData: FormData) {
  const item = formData.get("originalFile");
  if (!(item instanceof File) || item.size === 0) return undefined;
  return {
    filename: item.name,
    contentType: item.type,
    bytes: new Uint8Array(await item.arrayBuffer()),
  };
}

async function requireFounder() {
  const session = await founderSession();
  if (session.state !== "authorized") throw new Error("Founder access is required");
  return session.founder;
}

export async function createVaultDocumentAction(formData: FormData) {
  const founder = await requireFounder();
  const result = await createFounderVaultDocument({
    actorUserId: founder.id,
    title: value(formData, "title"),
    kind: value(formData, "kind"),
    originalReference: value(formData, "originalReference"),
    projectId: value(formData, "projectId"),
    note: value(formData, "note"),
    file: await uploadedFile(formData),
  });
  revalidatePath("/documents");
  revalidatePath("/company-setup");
  redirect(`/documents/${result.documentId}`);
}

export async function addVaultDocumentVersionAction(formData: FormData) {
  const founder = await requireFounder();
  const documentId = value(formData, "documentId");
  await addFounderVaultDocumentVersion({
    actorUserId: founder.id,
    documentId,
    originalReference: value(formData, "originalReference"),
    note: value(formData, "note"),
    file: await uploadedFile(formData),
  });
  revalidatePath(`/documents/${documentId}`);
  revalidatePath("/documents");
  redirect(`/documents/${documentId}`);
}
