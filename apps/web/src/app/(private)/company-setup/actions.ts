"use server";

import { revalidatePath } from "next/cache";

import { founderSession } from "@/lib/auth/session";
import { updateFounderCompanySetupItem } from "@/lib/company-setup/repository";

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function updateCompanySetupAction(formData: FormData) {
  const session = await founderSession();
  if (session.state !== "authorized") throw new Error("Founder access is required");

  await updateFounderCompanySetupItem({
    actorUserId: session.founder.id,
    itemId: formValue(formData, "itemId"),
    status: formValue(formData, "status"),
    evidenceReference: formValue(formData, "evidenceReference"),
    note: formValue(formData, "note"),
  });
  revalidatePath("/company-setup");
  revalidatePath("/dashboard");
}
