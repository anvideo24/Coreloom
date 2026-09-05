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
