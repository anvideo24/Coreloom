"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { founderSession } from "@/lib/auth/session";
import { completeFounderTask, createFounderTask } from "@/lib/tasks/repository";

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item : "";
}

async function requireFounder() {
  const session = await founderSession();
  if (session.state !== "authorized") throw new Error("Founder access is required");
  return session.founder;
}

export async function createTaskAction(formData: FormData) {
  const founder = await requireFounder();
  const result = await createFounderTask({
    actorUserId: founder.id,
    projectId: value(formData, "projectId"),
    title: value(formData, "title"),
    dueDate: value(formData, "dueDate"),
    completionCondition: value(formData, "completionCondition"),
  });
  revalidatePath("/tasks");
  revalidatePath("/clients-projects");
  redirect(`/tasks/${result.taskId}`);
}

export async function completeTaskAction(formData: FormData) {
  const founder = await requireFounder();
  const taskId = value(formData, "taskId");
  await completeFounderTask({
    actorUserId: founder.id,
    taskId,
    approved: value(formData, "approved") === "true",
  });
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
  redirect(`/tasks/${taskId}`);
}
