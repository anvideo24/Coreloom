"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createFounderLedgerAccount } from "@/lib/accounts/repository";
import { founderSession } from "@/lib/auth/session";

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item : "";
}

export async function createLedgerAccountAction(formData: FormData) {
  const session = await founderSession();
  if (session.state !== "authorized") throw new Error("Founder access is required");
  await createFounderLedgerAccount({
    actorUserId: session.founder.id,
    code: value(formData, "code"),
    name: value(formData, "name"),
    accountClass: value(formData, "accountClass"),
    categoryKey: value(formData, "categoryKey"),
  });
  revalidatePath("/accounts");
  revalidatePath("/revenue");
  revalidatePath("/expenses");
  redirect("/accounts");
}
