/**
 * 폼 제출 중복 방지(F02-03).
 *
 * 화면 쪽 방어(구현됨, `DraftAwareForm`):
 * - 폼을 열 때 제출 식별자(submissionId)를 하나 만들어 두고, 제출마다 함께 보낸다.
 * - 제출이 진행 중인 동안(`useFormStatus`의 pending) 저장 버튼을 비활성화해 두 번째 클릭을 막는다.
 * - 제출이 성공하면(리다이렉트로 확인) 다음 제출을 위해 새 식별자로 바꾼다 — 같은 식별자를
 *   다시 보내는 경로 자체가 화면에는 없다.
 * - 이 화면 방어는 **탭이 살아 있는 동안만** 유효하다. 새로고침하면 식별자도, "제출 중" 상태도
 *   함께 사라진다. 그래서 "화면에서 두 번째 클릭이 안 먹는다" 실측만으로 F02-03을 통과로 적으면
 *   안 된다 — 네트워크 재시도나 새로고침 후 재제출은 이 화면 방어를 지나가지 않는다.
 *
 * 서버 쪽 방어 자리(이번 범위 아님):
 * - 아래 `claimSubmission`은 "이 식별자를 이미 처리했나"를 판정하는 순수 함수만 둔다.
 * - 실제 서버 액션(예: `createClientAction`, `saveQuoteVersionAction`)에는 아직 연결하지 않았다.
 *   이 폼들은 DB에 쓰는 서버 액션이라, 처리된 식별자를 어디에 얼마나 오래 기억할지(DB 컬럼,
 *   TTL 있는 캐시 등)는 저장소 설계가 필요한 다음 단계 결정이다. 연결할 때는 실제 요청 처리
 *   경로에서 `claimSubmission(registry, submissionId)`를 호출해 `duplicate`가 true면 저장을
 *   건너뛰면 된다 — 판정 로직 자체는 이미 여기 있다.
 */

export type SubmissionRegistry = Set<string>;

/** 새 프로세스 수명 동안만 유지되는 예시 레지스트리. 실제 서버 저장소가 아니다. */
export function createSubmissionRegistry(): SubmissionRegistry {
  return new Set<string>();
}

/**
 * 처음 보는 식별자면 처리된 것으로 표시하고 `duplicate: false`를 돌려준다.
 * 이미 표시된 식별자면 아무것도 바꾸지 않고 `duplicate: true`를 돌려준다 — 호출부는 이때
 * 실제 저장(문서 생성)을 건너뛰어야 한다.
 */
export function claimSubmission(registry: SubmissionRegistry, submissionId: string): { duplicate: boolean } {
  if (!submissionId) return { duplicate: false };
  if (registry.has(submissionId)) return { duplicate: true };
  registry.add(submissionId);
  return { duplicate: false };
}

/** 브라우저 crypto가 없는 환경(구형 사파리 등)만 대비한 최소 대체값. */
export function createSubmissionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `submission-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
