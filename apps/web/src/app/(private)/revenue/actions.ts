"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { founderSession } from "@/lib/auth/session";
import { confirmFounderRevenueEntry, createFounderRevenueEntry, createFounderVenture, refundFounderRevenueEntry } from "@/lib/revenue/repository";

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item : "";
}

async function requireFounder() {
  const session = await founderSession();
  if (session.state !== "authorized") throw new Error("Founder access is required");
  return session.founder;
}

export async function createVentureAction(formData: FormData) {
  const founder = await requireFounder();
  await createFounderVenture({
    actorUserId: founder.id,
    name: value(formData, "name"),
    kind: value(formData, "kind"),
  });
  revalidatePath("/revenue");
}

export async function createRevenueEntryAction(formData: FormData) {
  const founder = await requireFounder();
  const result = await createFounderRevenueEntry({
    actorUserId: founder.id,
    projectId: value(formData, "projectId"),
    ventureId: value(formData, "ventureId"),
    amount: value(formData, "amount"),
    occurredOn: value(formData, "occurredOn"),
    settlementDate: value(formData, "settlementDate"),
    note: value(formData, "note"),
    accountCategory: value(formData, "accountCategory"),
  });
  revalidatePath("/revenue");
  revalidatePath("/billings");
  redirect(`/revenue/${result.entryId}`);
}

export async function confirmRevenueEntryAction(formData: FormData) {
  const founder = await requireFounder();
  const entryId = value(formData, "entryId");
  await confirmFounderRevenueEntry({
    actorUserId: founder.id,
    entryId,
    approved: value(formData, "approved") === "true",
  });
  revalidatePath(`/revenue/${entryId}`);
  revalidatePath("/revenue");
  redirect(`/revenue/${entryId}`);
}

export async function refundRevenueEntryAction(formData: FormData) {
  const founder = await requireFounder();
  const entryId = value(formData, "entryId");
  await refundFounderRevenueEntry({
    actorUserId: founder.id,
    entryId,
    amount: value(formData, "amount"),
    refundedOn: value(formData, "refundedOn"),
    reason: value(formData, "reason"),
    approved: value(formData, "approved") === "true",
  });
  revalidatePath(`/revenue/${entryId}`);
  revalidatePath("/revenue");
  revalidatePath("/dashboard");
  redirect(`/revenue/${entryId}`);
}
