/**
 * 견적 작성 중 고객사 연결 흐름(F01).
 * 고객사 화면으로 나갔다가 돌아오는 왕복과, 이미 넣은 상호·담당을 견적에서 다시 치는 횟수를 잰다.
 */

export function quotePathAfterInlineClientCreate(clientId: string): string {
  const id = clientId.trim();
  if (!id) throw new Error("Client id is required");
  return `/quotes?new=1&clientId=${encodeURIComponent(id)}`;
}

/** 견적 화면을 떠나 `/clients`로 등록하러 가면 1, 견적 패널 안 등록이면 0. */
export function countExternalClientRegistrationTrips(input: { leftQuotesToOpenClients: boolean }): number {
  return input.leftQuotesToOpenClients ? 1 : 0;
}

/**
 * 고객사 등록에서 이미 넣은 상호·담당·프로젝트를 견적 폼에서 다시 타이핑한 횟수.
 * 선택(select)으로 id만 고른 것은 재입력이 아니다.
 */
export function countReenteredIdentityFields(input: {
  clientNameTypedInRegistration: string;
  clientNameTypedAgainInQuote: string | null;
  contactNameTypedInRegistration: string | null;
  contactNameTypedAgainInQuote: string | null;
  projectNameTypedInRegistration: string | null;
  projectNameTypedAgainInQuote: string | null;
}): number {
  let count = 0;
  const clientName = input.clientNameTypedInRegistration.trim();
  if (clientName && input.clientNameTypedAgainInQuote?.trim() === clientName) count += 1;
  const contact = input.contactNameTypedInRegistration?.trim() || "";
  if (contact && input.contactNameTypedAgainInQuote?.trim() === contact) count += 1;
  const project = input.projectNameTypedInRegistration?.trim() || "";
  if (project && input.projectNameTypedAgainInQuote?.trim() === project) count += 1;
  return count;
}

export type QuoteDraftSnapshot = {
  clientId: string;
  clientName: string;
  projectId: string | null;
  title: string;
  itemTitles: string[];
  totalAmount: number;
};

/** 저장 직후 스냅샷과 재조회 스냅샷이 다르면 어긋난 필드 이름을 돌려준다. */
export function listQuoteDraftMismatches(saved: QuoteDraftSnapshot, reloaded: QuoteDraftSnapshot): string[] {
  const mismatches: string[] = [];
  if (saved.clientId !== reloaded.clientId) mismatches.push("clientId");
  if (saved.clientName !== reloaded.clientName) mismatches.push("clientName");
  if ((saved.projectId || null) !== (reloaded.projectId || null)) mismatches.push("projectId");
  if (saved.title !== reloaded.title) mismatches.push("title");
  if (saved.totalAmount !== reloaded.totalAmount) mismatches.push("totalAmount");
  if (saved.itemTitles.length !== reloaded.itemTitles.length) {
    mismatches.push("itemTitles");
  } else if (saved.itemTitles.some((title, index) => title !== reloaded.itemTitles[index])) {
    mismatches.push("itemTitles");
  }
  return mismatches;
}

/**
 * F01-03 — 직접 입력량을 세는 자(측정 도구).
 *
 * 공통 측정 조건 4번: "사용자가 직접 값을 넣은 필드 수, 반복 입력 필드 수 ... 나눠 기록한다.
 * 화면에 보이는 필드 수를 직접 입력량으로 대신하지 않는다." 이 도구는 실제로 사용자가 채운
 * 칸만 기록한다 — 화면에 몇 칸이 보이는지는 세지 않는다. 자동 계산·hidden·이미 맞는 기본값은
 * 애초에 `fillField`를 호출하지 않는 방식으로 뺀다(이 파일이 아니라 호출하는 시험이 뺀다).
 *
 * 공통 측정 조건 5번: "경로 전환은 페이지 이동·패널 개폐·탭 전환을 각각 센다." 이 도구는
 * 세 종류를 구분해서 쌓고, 합계도 함께 낸다.
 */
export type DirectFieldKind = "text" | "select" | "checkbox" | "textarea" | "date" | "number";

export type ScreenTransitionKind = "page" | "panel" | "tab";

export type DirectFieldRecord = {
  /** 사람이 읽을 필드 이름. 예: "상호", "작업명". */
  field: string;
  kind: DirectFieldKind;
  /** 앞 단계에서 이미 넣은 값을 다시 타이핑/선택한 것이면 true. */
  repeat: boolean;
};

export type ScreenTransitionRecord = {
  kind: ScreenTransitionKind;
  label: string;
};

/** 경로 하나(A 또는 B)를 재현하는 동안 채운 필드와 화면 전환을 순서대로 쌓는다. */
export class InputTally {
  private readonly fields: DirectFieldRecord[] = [];
  private readonly transitions: ScreenTransitionRecord[] = [];

  /** 사용자가 직접 값을 넣은 칸 하나를 기록한다. */
  fillField(field: string, kind: DirectFieldKind, options: { repeat?: boolean } = {}): void {
    this.fields.push({ field, kind, repeat: options.repeat ?? false });
  }

  /** 페이지 이동·패널 개폐·탭 전환 중 하나를 기록한다. */
  recordTransition(kind: ScreenTransitionKind, label: string): void {
    this.transitions.push({ kind, label });
  }

  get directFieldCount(): number {
    return this.fields.length;
  }

  get repeatedFieldCount(): number {
    return this.fields.filter((entry) => entry.repeat).length;
  }

  fieldNames(): string[] {
    return this.fields.map((entry) => entry.field);
  }

  transitionCounts(): { page: number; panel: number; tab: number; total: number } {
    const page = this.transitions.filter((entry) => entry.kind === "page").length;
    const panel = this.transitions.filter((entry) => entry.kind === "panel").length;
    const tab = this.transitions.filter((entry) => entry.kind === "tab").length;
    return { page, panel, tab, total: page + panel + tab };
  }

  transitionLabels(): string[] {
    return this.transitions.map((entry) => `${entry.kind}:${entry.label}`);
  }
}

/** (기준 − 개선)/기준. 기준이 0 이하이면 나눌 수 없으니 0을 돌려준다(무한대·NaN 방지). */
export function reductionRate(baselineCount: number, improvedCount: number): number {
  if (baselineCount <= 0) return 0;
  return (baselineCount - improvedCount) / baselineCount;
}
