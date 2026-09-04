"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { founderSession } from "@/lib/auth/session";
import {
  createFounderContractAmendment,
  createFounderContractFromQuote,
  executeFounderContract,
  recordFounderContractOriginal,
  updateFounderContractTerms,
} from "@/lib/contracts/repository";

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item : "";
}

async function requireFounder() {
  const session = await founderSession();
  if (session.state !== "authorized") throw new Error("Founder access is required");
  return session.founder;
}

export async function createContractFromQuoteAction(formData: FormData) {
  const founder = await requireFounder();
  const result = await createFounderContractFromQuote({
    actorUserId: founder.id,
    quoteVersionId: value(formData, "quoteVersionId"),
    effectiveStartOn: value(formData, "effectiveStartOn"),
    effectiveEndOn: value(formData, "effectiveEndOn"),
    autoRenew: value(formData, "autoRenew"),
    contractNumber: value(formData, "contractNumber"),
  });
  revalidatePath("/contracts");
  revalidatePath("/quotes");
  redirect(`/contracts/${result.contractId}`);
}

export async function updateContractTermsAction(formData: FormData) {
  const founder = await requireFounder();
  const contractId = value(formData, "contractId");
  await updateFounderContractTerms({
    actorUserId: founder.id,
    contractId,
    effectiveStartOn: value(formData, "effectiveStartOn"),
    effectiveEndOn: value(formData, "effectiveEndOn"),
    autoRenew: value(formData, "autoRenew"),
    contractNumber: value(formData, "contractNumber"),
  });
  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/contracts");
  redirect(`/contracts/${contractId}`);
}

export async function recordContractOriginalAction(formData: FormData) {
  const founder = await requireFounder();
  const contractId = value(formData, "contractId");
  await recordFounderContractOriginal({
    actorUserId: founder.id,
    contractId,
    originalReference: value(formData, "originalReference"),
  });
  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/contracts");
  redirect(`/contracts/${contractId}`);
}

export async function executeContractAction(formData: FormData) {
  const founder = await requireFounder();
  const contractId = value(formData, "contractId");
  await executeFounderContract({
    actorUserId: founder.id,
    contractId,
    approved: value(formData, "approved") === "true",
  });
  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/contracts");
  redirect(`/contracts/${contractId}`);
}

export async function createContractAmendmentAction(formData: FormData) {
  const founder = await requireFounder();
  const contractId = value(formData, "contractId");
  await createFounderContractAmendment({ actorUserId: founder.id, contractId });
  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/contracts");
  redirect(`/contracts/${contractId}`);
}
