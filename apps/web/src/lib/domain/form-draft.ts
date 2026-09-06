/**
 * 작성 패널 초안(F02).
 *
 * 보안 결정(3단계):
 * - 브라우저 `sessionStorage`만 쓴다. 탭이 닫히면 사라지고, 서버·로그로 보내지 않는다.
 * - 키에 사용자(스코프)와 폼 ID를 넣어 다른 사용자·다른 폼과 섞이지 않게 한다.
 * - 값 본문은 콘솔·원격 로그에 남기지 않는다.
 * - 명시적 삭제·저장 성공(리다이렉트) 때 지운다. 기기 간 동기화는 하지 않는다.
 */

export const FORM_DRAFT_SCHEMA_VERSION = 1 as const;
export const FORM_DRAFT_KEY_PREFIX = "coreloom.form-draft.v1";

export type FormDraftRecord = {
  version: typeof FORM_DRAFT_SCHEMA_VERSION;
  scopeId: string;
  formId: string;
  fields: Record<string, string>;
  updatedAt: string;
};

export function formDraftStorageKey(scopeId: string, formId: string) {
  const scope = scopeId.trim();
  const form = formId.trim();
  if (!scope) throw new Error("Draft scope is required");
  if (!form) throw new Error("Draft form id is required");
  return `${FORM_DRAFT_KEY_PREFIX}:${scope}:${form}`;
}

export function serializeFormDraft(input: {
  scopeId: string;
  formId: string;
  fields: Record<string, string>;
  updatedAt?: string;
}): string {
  const record: FormDraftRecord = {
    version: FORM_DRAFT_SCHEMA_VERSION,
    scopeId: input.scopeId.trim(),
    formId: input.formId.trim(),
    fields: sanitizeDraftFields(input.fields),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
  if (!record.scopeId || !record.formId) throw new Error("Draft identity is required");
  return JSON.stringify(record);
}

export function parseFormDraft(raw: string | null | undefined, expected: { scopeId: string; formId: string }) {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as FormDraftRecord;
    if (value.version !== FORM_DRAFT_SCHEMA_VERSION) return null;
    if (value.scopeId !== expected.scopeId.trim()) return null;
    if (value.formId !== expected.formId.trim()) return null;
    if (!value.fields || typeof value.fields !== "object" || Array.isArray(value.fields)) return null;
    return {
      ...value,
      fields: sanitizeDraftFields(value.fields),
    } satisfies FormDraftRecord;
  } catch {
    return null;
  }
}

/**
 * 제출 식별자(F02-03)는 사람이 쓴 내용이 아니라 이번 제출 시도 하나를 가리키는 표다.
 * 일반 입력 필드로 복원하면 새 제출에 옛 식별자가 섞인다. 그래서 이 이름은 필드에서
 * 제외하고, 신규 견적의 미확정 요청만 별도 form-submission-attempt 메타데이터로 보존한다.
 */
const NON_DRAFT_FIELD_NAMES = new Set(["submissionId"]);

export function sanitizeDraftFields(fields: Record<string, string>) {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!key || key.startsWith("$ACTION") || NON_DRAFT_FIELD_NAMES.has(key)) continue;
    if (typeof value !== "string") continue;
    // A quote package collection contains several individually bounded fields in
    // one JSON submission value. Six 1,000-character descriptions plus titles
    // and costing metadata legitimately exceed the ordinary single-field cap.
    const maxLength = key === "packagesJson" ? 64_000 : 8_000;
    if (value.length > maxLength) continue;
    next[key] = value;
  }
  return next;
}

export function formDataToDraftFields(formData: FormData) {
  const fields: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    fields[key] = value;
  }
  return sanitizeDraftFields(fields);
}

export type DraftStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function readFormDraft(storage: DraftStorage, scopeId: string, formId: string) {
  const key = formDraftStorageKey(scopeId, formId);
  return parseFormDraft(storage.getItem(key), { scopeId, formId });
}

export function writeFormDraft(
  storage: DraftStorage,
  input: { scopeId: string; formId: string; fields: Record<string, string> },
) {
  const key = formDraftStorageKey(input.scopeId, input.formId);
  const fields = sanitizeDraftFields(input.fields);
  if (Object.values(fields).every((value) => value.trim() === "")) {
    storage.removeItem(key);
    return null;
  }
  const raw = serializeFormDraft({ ...input, fields });
  storage.setItem(key, raw);
  return parseFormDraft(raw, input);
}

export function clearFormDraft(storage: DraftStorage, scopeId: string, formId: string) {
  storage.removeItem(formDraftStorageKey(scopeId, formId));
}
