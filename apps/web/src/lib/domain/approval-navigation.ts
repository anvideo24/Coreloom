import { approvalKinds, type ApprovalKind } from "@/lib/domain/approvals";

/**
 * 승인함은 상세로 잠시 떠났다가 같은 탭에서 돌아오는 읽기 전용 탐색 맥락만 보관한다.
 * URL에는 검색어를 넣지 않고, 대표별 sessionStorage 키로 갈라 로그아웃 때 함께 비운다.
 */
export const APPROVAL_NAVIGATION_SCHEMA_VERSION = 1 as const;
export const APPROVAL_NAVIGATION_KEY_PREFIX = "coreloom.approval-navigation.v1";

export type ApprovalNavigationRecord = {
  version: typeof APPROVAL_NAVIGATION_SCHEMA_VERSION;
  scopeId: string;
  query: string;
  selectedKind: ApprovalKind | null;
  inspectedItemId?: string;
  inspectedPosition?: number;
};

export function approvalNavigationStorageKey(scopeId: string) {
  const scope = scopeId.trim();
  if (!scope) throw new Error("Approval navigation scope is required");
  return `${APPROVAL_NAVIGATION_KEY_PREFIX}:${scope}`;
}

export function serializeApprovalNavigation(input: Omit<ApprovalNavigationRecord, "version">) {
  const record: ApprovalNavigationRecord = {
    version: APPROVAL_NAVIGATION_SCHEMA_VERSION,
    scopeId: input.scopeId.trim(),
    query: input.query,
    selectedKind: input.selectedKind,
    ...(input.inspectedItemId ? { inspectedItemId: input.inspectedItemId } : {}),
    ...(typeof input.inspectedPosition === "number" ? { inspectedPosition: input.inspectedPosition } : {}),
  };
  if (!record.scopeId || !isNavigationRecord(record)) throw new Error("Invalid approval navigation record");
  return JSON.stringify(record);
}

export function parseApprovalNavigation(raw: string | null | undefined, scopeId: string): ApprovalNavigationRecord | null {
  if (!raw) return null;
  try {
    const record = JSON.parse(raw) as unknown;
    if (!isNavigationRecord(record) || record.scopeId !== scopeId.trim()) return null;
    return record;
  } catch {
    return null;
  }
}

export function restoreApprovalNavigation(
  record: ApprovalNavigationRecord,
  items: Array<{ id: string; kind: ApprovalKind }>,
) {
  const inspectedPosition = record.inspectedItemId
    ? items.findIndex((item) => item.id === record.inspectedItemId)
    : -1;
  return {
    query: record.query,
    selectedKind: record.selectedKind,
    inspectedPosition: inspectedPosition >= 0 ? inspectedPosition : null,
  };
}

function isNavigationRecord(value: unknown): value is ApprovalNavigationRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<ApprovalNavigationRecord>;
  return record.version === APPROVAL_NAVIGATION_SCHEMA_VERSION
    && typeof record.scopeId === "string"
    && typeof record.query === "string"
    && record.query.length <= 1_000
    && (record.selectedKind === null || (typeof record.selectedKind === "string" && approvalKinds.includes(record.selectedKind as ApprovalKind)))
    && (record.inspectedItemId === undefined || (typeof record.inspectedItemId === "string" && record.inspectedItemId.length > 0))
    && (record.inspectedPosition === undefined || (Number.isInteger(record.inspectedPosition) && record.inspectedPosition >= 0));
}
