"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { founderSession } from "@/lib/auth/session";
import { confirmFounderExpenseEntry, createFounderExpenseEntry } from "@/lib/expenses/repository";

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item : "";
}

async function requireFounder() {
  const session = await founderSession();
  if (session.state !== "authorized") throw new Error("Founder access is required");
  return session.founder;
}

export async function createExpenseEntryAction(formData: FormData) {
  const founder = await requireFounder();
  const result = await createFounderExpenseEntry({
    actorUserId: founder.id,
    projectId: value(formData, "projectId"),
    ventureId: value(formData, "ventureId"),
    amount: value(formData, "amount"),
    occurredOn: value(formData, "occurredOn"),
    settlementDate: value(formData, "settlementDate"),
    note: value(formData, "note"),
    accountCategory: value(formData, "accountCategory"),
    supplierName: value(formData, "supplierName"),
  });
  revalidatePath("/expenses");
  revalidatePath("/revenue");
  revalidatePath("/dashboard");
  redirect(`/expenses/${result.entryId}`);
}

export async function confirmExpenseEntryAction(formData: FormData) {
  const founder = await requireFounder();
  const entryId = value(formData, "entryId");
  await confirmFounderExpenseEntry({
    actorUserId: founder.id,
    entryId,
    approved: value(formData, "approved") === "true",
  });
  revalidatePath(`/expenses/${entryId}`);
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  redirect(`/expenses/${entryId}`);
}
