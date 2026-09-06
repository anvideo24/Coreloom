import { FORM_DRAFT_KEY_PREFIX, type DraftStorage } from "@/lib/domain/form-draft";
import { parseSubmissionId } from "@/lib/domain/submission-id";

const ATTEMPT_VERSION = 1 as const;

export type FormSubmissionAttempt = {
  version: typeof ATTEMPT_VERSION;
  scopeId: string;
  formId: string;
  submissionId: string;
  payloadDigest: string;
};

export function formSubmissionAttemptStorageKey(scopeId: string, formId: string) {
  return `${FORM_DRAFT_KEY_PREFIX}:attempt:${scopeId.trim()}:${formId.trim()}`;
}

export function snapshotSubmissionFields(formData: FormData, fieldNames: readonly string[]) {
  const entries = fieldNames.map((name) => [
    name,
    formData.getAll(name).map((value) => {
      if (typeof value !== "string") throw new Error("Submission files cannot be fingerprinted");
      return value;
    }),
  ]);
  return JSON.stringify(entries);
}

export async function digestSubmissionSnapshot(payloadSnapshot: string) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Secure digest is unavailable");
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(payloadSnapshot));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function readFormSubmissionAttempt(storage: DraftStorage, scopeId: string, formId: string) {
  const raw = storage.getItem(formSubmissionAttemptStorageKey(scopeId, formId));
  if (!raw) return null;
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid submission attempt");
  const attempt = parsed as Partial<FormSubmissionAttempt>;
  if (
    attempt.version !== ATTEMPT_VERSION ||
    attempt.scopeId !== scopeId.trim() ||
    attempt.formId !== formId.trim() ||
    !parseSubmissionId(attempt.submissionId) ||
    typeof attempt.payloadDigest !== "string" ||
    !/^[0-9a-f]{64}$/.test(attempt.payloadDigest)
  ) {
    throw new Error("Invalid submission attempt");
  }
  return attempt as FormSubmissionAttempt;
}

export function writeFormSubmissionAttempt(storage: DraftStorage, attempt: FormSubmissionAttempt) {
  const key = formSubmissionAttemptStorageKey(attempt.scopeId, attempt.formId);
  storage.setItem(key, JSON.stringify(attempt));
  const written = readFormSubmissionAttempt(storage, attempt.scopeId, attempt.formId);
  if (!written || written.submissionId !== attempt.submissionId || written.payloadDigest !== attempt.payloadDigest) {
    throw new Error("Submission attempt was not persisted");
  }
}

export function clearFormSubmissionAttempt(storage: DraftStorage, scopeId: string, formId: string) {
  storage.removeItem(formSubmissionAttemptStorageKey(scopeId, formId));
}
