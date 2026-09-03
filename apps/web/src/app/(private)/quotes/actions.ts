"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { founderSession } from "@/lib/auth/session";
import { createFounderQuoteVersion } from "@/lib/quotes/repository";

function value(formData: FormData, key: string) { const item = formData.get(key); return typeof item === "string" ? item : ""; }

export async function saveQuoteVersionAction(formData: FormData) {
  const session = await founderSession();
  if (session.state !== "authorized") throw new Error("Founder access is required");
  const descriptions = formData.getAll("itemDescription");
  const amounts = formData.getAll("itemAmount");
  const result = await createFounderQuoteVersion({
    actorUserId: session.founder.id,
    quoteId: value(formData, "quoteId") || undefined,
    clientId: value(formData, "clientId"), projectId: value(formData, "projectId") || undefined,
    title: value(formData, "title"), note: value(formData, "note"),
    items: descriptions.map((description, index) => ({ description: String(description), amount: String(amounts[index] ?? "") })),
  });
  revalidatePath("/quotes");
  redirect(`/quotes/${result.quoteId}`);
}
