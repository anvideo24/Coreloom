"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { founderSession } from "@/lib/auth/session";
import { confirmFounderAiProposal, createFounderAiProposal, rejectFounderAiProposal } from "@/lib/ai-proposals/repository";

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item : "";
}

async function requireFounder() {
  const session = await founderSession();
  if (session.state !== "authorized") throw new Error("Founder access is required");
  return session.founder;
}

export async function createAiProposalAction(formData: FormData) {
  const founder = await requireFounder();
  const result = await createFounderAiProposal({
    actorUserId: founder.id,
    evidenceId: value(formData, "evidenceId"),
    kind: value(formData, "kind"),
    body: value(formData, "body"),
  });
  revalidatePath("/proposals");
  revalidatePath("/timeline");
  revalidatePath(`/timeline/${value(formData, "evidenceId")}`);
  redirect(`/proposals/${result.proposalId}`);
}

export async function confirmAiProposalAction(formData: FormData) {
  const founder = await requireFounder();
  const proposalId = value(formData, "proposalId");
  const result = await confirmFounderAiProposal({
    actorUserId: founder.id,
    proposalId,
    approved: value(formData, "approved") === "true",
  });
  revalidatePath(`/proposals/${proposalId}`);
  revalidatePath("/proposals");
  revalidatePath(`/timeline/${result.evidenceId}`);
  revalidatePath("/timeline");
  redirect(`/proposals/${proposalId}`);
}

export async function rejectAiProposalAction(formData: FormData) {
  const founder = await requireFounder();
  const proposalId = value(formData, "proposalId");
  const result = await rejectFounderAiProposal({
    actorUserId: founder.id,
    proposalId,
    approved: value(formData, "approved") === "true",
    reason: value(formData, "reason"),
  });
  revalidatePath(`/proposals/${proposalId}`);
  revalidatePath("/proposals");
  revalidatePath(`/timeline/${result.evidenceId}`);
  revalidatePath("/timeline");
  redirect(`/proposals/${proposalId}`);
}
