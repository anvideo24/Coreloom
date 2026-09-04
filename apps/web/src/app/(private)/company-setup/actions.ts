"use server";

import { revalidatePath } from "next/cache";

import { founderSession } from "@/lib/auth/session";
import {
  updateFounderCompanySetupItem,
  upsertFounderCompanyProfile,
} from "@/lib/company-setup/repository";

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

export async function updateCompanyProfileAction(formData: FormData) {
  const session = await founderSession();
  if (session.state !== "authorized") throw new Error("Founder access is required");

  await upsertFounderCompanyProfile({
    actorUserId: session.founder.id,
    brandName: formValue(formData, "brandName"),
    legalName: formValue(formData, "legalName"),
    businessRegistrationNumber: formValue(formData, "businessRegistrationNumber"),
    representativeName: formValue(formData, "representativeName"),
    address: formValue(formData, "address"),
    email: formValue(formData, "email"),
    bankName: formValue(formData, "bankName"),
    bankAccount: formValue(formData, "bankAccount"),
    accountHolder: formValue(formData, "accountHolder"),
    swift: formValue(formData, "swift"),
  });
  revalidatePath("/company-setup");
  revalidatePath("/quotes");
}
