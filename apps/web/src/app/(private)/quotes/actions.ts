"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { founderSession } from "@/lib/auth/session";
import { normalizeQuoteEmailDraft } from "@/lib/domain/quote-email";
import { parseQuotePackagesJson } from "@/lib/domain/quotes";
import { createFounderQuoteVersion, sendFounderQuoteEmail } from "@/lib/quotes/repository";

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item : "";
}

export async function saveQuoteVersionAction(formData: FormData) {
  const session = await founderSession();
  if (session.state !== "authorized") throw new Error("Founder access is required");
  const packagesJson = value(formData, "packagesJson");
  const packages = packagesJson
    ? parseQuotePackagesJson(packagesJson)
    : (() => {
        const descriptions = formData.getAll("itemDescription");
        const amounts = formData.getAll("itemAmount");
        return descriptions.map((description, index) => ({
          title: String(description),
          customerDescription: "",
          amount: Number(amounts[index] ?? 0),
          role: "",
          monthlyRate: Number(amounts[index] ?? 0) || 1,
          months: 1,
          headcount: 1,
          utilizationPercent: 100,
          amountLocked: true,
          costAmount: 0,
        }));
      })();

  const result = await createFounderQuoteVersion({
    actorUserId: session.founder.id,
    quoteId: value(formData, "quoteId") || undefined,
    clientId: value(formData, "clientId"),
    projectId: value(formData, "projectId") || undefined,
    title: value(formData, "title"),
    note: value(formData, "note"),
    packages,
    vatMode: value(formData, "vatMode"),
    targetMarginPercent: value(formData, "targetMarginPercent") || 30,
    operatingCostPercent: value(formData, "operatingCostPercent") || 10,
  });
  revalidatePath("/quotes");
  redirect(`/quotes/${result.quoteId}`);
}

export async function sendQuoteVersionEmailAction(formData: FormData) {
  const session = await founderSession();
  if (session.state !== "authorized") throw new Error("Founder access is required");
  const quoteId = value(formData, "quoteId");
  const quoteVersionId = value(formData, "quoteVersionId");
  const destination = `/quotes/${quoteId}/versions/${quoteVersionId}/email`;
  try {
    const draft = normalizeQuoteEmailDraft({
      recipient: value(formData, "recipient"),
      subject: value(formData, "subject"),
      message: value(formData, "message"),
      approved: value(formData, "approved") === "true",
    });
    await sendFounderQuoteEmail({ actorUserId: session.founder.id, quoteId, quoteVersionId, ...draft });
  } catch {
    redirect(`${destination}?status=failed`);
  }
  revalidatePath(`/quotes/${quoteId}`);
  redirect(`${destination}?status=accepted`);
}
