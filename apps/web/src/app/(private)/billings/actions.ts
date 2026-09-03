"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { founderSession } from "@/lib/auth/session";
import { confirmFounderBillingDeposit, createFounderBilling } from "@/lib/billings/repository";

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item : "";
}

async function requireFounder() {
  const session = await founderSession();
  if (session.state !== "authorized") throw new Error("Founder access is required");
  return session.founder;
}

export async function createBillingAction(formData: FormData) {
  const founder = await requireFounder();
  const result = await createFounderBilling({
    actorUserId: founder.id,
    contractId: value(formData, "contractId"),
    kind: value(formData, "kind"),
    amount: value(formData, "amount"),
    billingDate: value(formData, "billingDate"),
    dueDate: value(formData, "dueDate"),
    note: value(formData, "note"),
  });
  revalidatePath("/billings");
  revalidatePath("/contracts");
  redirect(`/billings/${result.billingId}`);
}

export async function confirmBillingDepositAction(formData: FormData) {
  const founder = await requireFounder();
  const billingId = value(formData, "billingId");
  await confirmFounderBillingDeposit({
    actorUserId: founder.id,
    billingId,
    approved: value(formData, "approved") === "true",
  });
  revalidatePath(`/billings/${billingId}`);
  revalidatePath("/billings");
  redirect(`/billings/${billingId}`);
}
