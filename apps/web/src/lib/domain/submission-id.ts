/**
 * F02-03 서버 배선용 최소 검증. `submission-dedupe.ts`(건드리지 않음)는 판정 함수만 두고
 * 실제 저장소 연결은 다음 단계로 남겨 뒀다 — 이 저장소가 고른 저장소는 `client_companies`·
 * `quotes`의 `submissionId` 칸과 유일 인덱스(스키마·마이그레이션 0033 참고)다.
 *
 * FormData는 임의의 문자열을 담아 올 수 있다. 이 칸은 서버에서 값을 만드는 게 아니라
 * 화면(`DraftAwareForm`)이 만든 UUID를 그대로 실어 보내므로, 저장 전에 UUID 꼴인지 확인해
 * 엉뚱한 값이 유일 인덱스에 그대로 꽂히지 않게 한다.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * FormData의 `submissionId` 값이 실제로 쓸 수 있는 UUID 꼴인지 확인한다.
 * 없거나 UUID 꼴이 아니면 `undefined`를 돌려준다 — 호출부는 이 값을 그냥 무시하고 평소대로
 * 저장해야 한다(옛 화면·자동화가 이 필드를 안 보내도 깨지지 않게 하기 위함).
 */
export function parseSubmissionId(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return UUID_PATTERN.test(value) ? value : undefined;
}
