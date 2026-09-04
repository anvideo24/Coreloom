"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { founderSession } from "@/lib/auth/session";
import { confirmFounderBillingDeposit, createFounderBilling, createFounderRecurringSeries, sendFounderBillingEmail } from "@/lib/billings/repository";
import { normalizeQuoteEmailDraft } from "@/lib/domain/quote-email";

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
    billingNumber: value(formData, "billingNumber"),
    poNumber: value(formData, "poNumber"),
  });
  revalidatePath("/billings");
  revalidatePath("/contracts");
  redirect(`/billings/${result.billingId}`);
}

export async function createRecurringSeriesAction(formData: FormData) {
  const founder = await requireFounder();
  const result = await createFounderRecurringSeries({
    actorUserId: founder.id,
    contractId: value(formData, "contractId"),
    amount: value(formData, "amount"),
    startDate: value(formData, "startDate"),
    endDate: value(formData, "endDate"),
    dueOffsetDays: value(formData, "dueOffsetDays"),
    note: value(formData, "note"),
    approved: value(formData, "approved") === "true",
  });
  revalidatePath("/billings");
  revalidatePath("/contracts");
  revalidatePath("/revenue");
  redirect(`/billings/series/${result.seriesId}`);
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

export async function sendBillingEmailAction(formData: FormData) {
  const founder = await requireFounder();
  const billingId = value(formData, "billingId");
  const destination = `/billings/${billingId}/email`;
  try {
    const draft = normalizeQuoteEmailDraft({
      recipient: value(formData, "recipient"),
      subject: value(formData, "subject"),
      message: value(formData, "message"),
      approved: value(formData, "approved") === "true",
    });
    await sendFounderBillingEmail({ actorUserId: founder.id, billingId, ...draft });
  } catch {
    redirect(`${destination}?status=failed`);
  }
  revalidatePath(`/billings/${billingId}`);
  redirect(`${destination}?status=accepted`);
}
