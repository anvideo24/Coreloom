"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { founderSession } from "@/lib/auth/session";
import { linkFounderRechoEvidence } from "@/lib/recho-evidence/repository";

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item : "";
}

async function requireFounder() {
  const session = await founderSession();
  if (session.state !== "authorized") throw new Error("Founder access is required");
  return session.founder;
}

export async function linkRechoEvidenceAction(formData: FormData) {
  const founder = await requireFounder();
  const result = await linkFounderRechoEvidence({
    actorUserId: founder.id,
    projectId: value(formData, "projectId"),
    kind: value(formData, "kind"),
    title: value(formData, "title"),
    originalIdentifier: value(formData, "originalIdentifier"),
    originalUrl: value(formData, "originalUrl"),
    occurredOn: value(formData, "occurredOn"),
    occurredTime: value(formData, "occurredTime"),
    linkReason: value(formData, "linkReason"),
  });
  revalidatePath("/timeline");
  revalidatePath("/clients-projects");
  redirect(`/timeline/${result.recordId}`);
}
