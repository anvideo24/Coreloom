# 자동 증거 재검토 — 원래 목표 11개

확인: 2026-09-06 15:38 KST · 코드 `e58cf93046cd5ded1059ba312cac3723860df9ad` · 계획 버전 1.

**10개 통과 갱신 · 1개 실패 확인.** 이전 결과를 삭제하지 않고 결과 JSON에 11개를 덧붙였다. 제품 코드와 목표는 변경하지 않았다. 이 결과는 자동 검사 범위이며 PC/Fold 실사용·실제 저장·로그인·모델 실행을 대신하지 않는다.

## 실행 증거

`apps/web`에서 기존 시험을 두 묶음으로 실행했다. 서로 다른 15파일, 총 197개 통과, 실패 0개다. 전체 제품 시험·빌드의 이번 재실행은 아니다.

```text
npm test -- tests/dashboard.test.ts tests/form-draft.test.ts tests/form-draft-controls.test.tsx tests/form-draft-scenarios.test.tsx tests/sign-out.test.tsx tests/approval-actions.test.ts tests/agent-chat.test.ts tests/agent-chat-ui.test.tsx tests/agent-chat-repository-status.test.ts tests/verification-plan.test.ts tests/verification-integration.test.tsx tests/admin-manual-verification.test.ts
15:35:31 KST 시작: 12 files passed, 171 tests passed, 4.19s

npm test -- tests/agent-status.test.ts tests/chat-runs.test.ts tests/approval-gates.test.ts
15:36:46 KST 시작: 3 files passed, 26 tests passed, 397ms
```

## 목표별 대조

| ID | 판정 | 검증 범위와 한계 |
| --- | --- | --- |
| F02-04 | 통과 | 사용자·폼 키 분리, 다른 사용자 payload 거부, 로그아웃 성공 시 초안 제거/실패 시 보존. 실제 계정 전환 시험은 아님 |
| F03-04 | 통과 | 8개 서버 액션의 권한/승인/결정됨/누락/필수값 부족 총 68차단 조건에서 쓰기 0회, 정상 8조건 대조. 실제 액션+가상 DB이며 결정된 행의 순차 거부만 확인; 실제 SQL 원자성·동시성은 아님 |
| F04-02 | 통과 | 거절·시간 초과·중복·서버 오류, 현재 응답 4상태의 표시와 재열기 대조. 지시문만이 아니라 서버 이벤트·상태·UI를 함께 확인; 실제 모델 호출은 없음 |
| F04-04 | 통과 | 연결 단절·GET 복귀·명시 중지·다른 사용자·다른 에이전트, user-stop/일반 abort 저장 구분. 실제 기기 네트워크 시험은 아님 |
| F05-01 | 통과 | 월말 4종·윤년·연도 경계 금액 오차 0원, 현재 조회→계산→화면 연결 코드 대조 |
| F05-02 | 통과 | 예정/확인 × 동일/다른 월 4조합 및 교차 월 사례의 집계값 일치 |
| F05-03 | 통과 | 같은 고객사 2프로젝트·동명 고객사·미연결 기록의 단계/다음 행동 분리. 현재 projectId 전달 대조 |
| F05-04 | 통과 | 빈 기록·정상·입금 연체·업무 지연 값과 화면 문구/근거 연결 일치. 사람 이해도 측정은 아님 |
| F07-02 | 통과 | 실제 계획·결과 읽기 계층과 실제 표/카드 렌더의 28개 ID 대조, 결과 없는 항목 보존 |
| F07-03 | 실패 | 아래 직접 실행에서 실제 Fold 목표에 PC 전용 결과가 통과로 계산됨. 기존 통과 시험에는 이 환경 불일치 사례가 없음 |
| F07-04 | 통과 | A 통과→관련 변경→재검증→B 통과와 2건 이력 보존. 현재 HEAD·없는 커밋 처리도 확인 |

F05 시험은 `apps/web/tests/dashboard.test.ts`, 연결 대조는 `apps/web/src/lib/dashboard/repository.ts`와 `apps/web/src/app/(private)/dashboard/page.tsx`다. 나머지 시험 원본은 위 실행 명령에 있다. 통과 항목은 각 목표가 지정한 자동 검증 범위에 한하며 실제 업무 데이터의 정확성 보증이 아니다.

F04·F05의 오래된 구현 단계에는 현재 main 소스 대조를 근거로 `on-main` 기록을 덧붙였다. `in-use`나 기능 전체 완료로 올리지 않았다.

## F07-03 — 환경 불일치 재현

초기 진단 입력은 Markdown 문단 사이 빈 줄이 없어 검사 표가 파싱되지 않았다. 그것은 제품 판정 근거에서 제외했다. 아래는 빈 줄을 보완하고 검사 ID가 실제로 파싱되는 입력이다. PowerShell의 here-string으로 아래 JS를 `node --import tsx --input-type=module`에 전달한다. 작업 위치는 `apps/web`, 파일·DB 쓰기는 없다.

```javascript
import v from './src/lib/domain/verification-plan.ts';
const plan = v.parseVerificationPlan([
  '계획 버전: 1 · 작성일: 2026-09-06', '',
  '## F09 · 환경 검증용 가상 기능', '',
  '목표: 실제 Fold에서 확인', '',
  '| 완료 | ID | 목표·통과 기준 | 검증 방법 | 현재 판정 |',
  '|---|---|---|---|---|',
  '| ☐ | F09-01 | 주요 조작 가림 0건 | 실제 Fold에서 확인 | 미검증 |',
].join('\n'));
const base = {
  checkId: 'F09-01', outcome: 'pass', value: '가림 0건',
  evidence: { kind: 'automated', ref: 'synthetic-evidence', checkedAt: '2026-09-06' },
  codeCommit: 'e58cf93046cd5ded1059ba312cac3723860df9ad',
  planVersion: 1, environment: 'PC desktop only',
};
const cases = [
  ['no-result', []],
  ['failed', [{ ...base, outcome: 'fail' }]],
  ['no-evidence', [{ ...base, evidence: { ...base.evidence, ref: '' } }]],
  ['other-version', [{ ...base, planVersion: 2 }]],
  ['other-environment', [base]],
];
for (const [name, results] of cases) {
  try {
    const file = v.parseVerificationResults(JSON.stringify({ schemaVersion: 1, implementation: [], results }));
    const check = v.buildVerificationStatus({ plan, file, changedPathsSince: () => [] })[0].checks[0];
    console.log(name + ': ' + check.effective);
  } catch { console.log(name + ': rejected'); }
}
```

실제 결과: `no-result → no-result`, `failed → fail`, `no-evidence → rejected`, `other-version → unverified`, **`other-environment → pass`**. 앞 4종은 차단, 마지막 1종은 잘못 통과한다.

현재 판정기는 환경 문자열의 공백만 검사하며 목표 환경과 비교하지 않는다. 목표별 허용 환경을 어떤 구조로 지정할지 먼저 정한 뒤 별도 수정해야 한다. 이 재검토에서는 제품 코드나 계획 형식을 바꾸지 않았다.

## 후속 승인 — F07-03 환경 관문 수정

위 문단은 수정 전 진단이다. 이후 대표가 결함 수정을 선택해 `codex/verification-environment-gate`에서 수정했다.

- 수정 전 새 시험의 기존 자유서술 기록이 `unverified` 기대와 달리 `pass`로 판정되는 실패를 확인했다. 새 환경 필드·계획 파싱 시험도 미구현으로 실패했다.
- 계획의 `필수 검증 환경` 목록과 증거의 `environments`를 대조한다. 환경명은 정확히 일치해야 하며 순서는 무관하다. 자유서술 `environment`로 추측하지 않는다. 계획 조건 누락·결과 목록 누락·빈 목록·PC 전용·폴드 일부·에뮬레이션·중복 항목은 통과하지 않는다.
- 모든 필수 환경이 있는 양성 대조는 통과한다. 환경이 맞아도 결과 없음·실패·증거 없음·다른 계획 버전의 기존 차단은 유지한다. PC 표·모바일 카드 모두 누락 환경 이유를 렌더링한다.
- 실제 28개 계획 항목에 환경 조건이 있고, 실제 F07-06 목표가 PC 전용 가상 증거로 통과하지 않는 것을 확인한다. 기존 목표·방법·ID·버전 2는 바꾸지 않았다.
- 검증 명령: `npx vitest run tests/verification-environment.test.ts tests/verification-plan.test.ts tests/verification-integration.test.tsx tests/admin-manual-verification.test.ts` — 4파일 51개 통과(환경 시험 11개 포함). `npx tsc --noEmit` 종료 0. 실행 위치는 `apps/web`.
- 모든 환경 입력 사례는 가상 증거다. 실제 PC 브라우저·휴대폰·Fold·DB·모델 실행·배포 검증은 하지 않았다. 환경 필드는 증거 작성자가 확인한 범위를 나타내며 기기나 증거 진위를 자동 인증하지 않는다. 옛 기록에 환경을 추측해 채우지 않는다.

## 남은 것

원래 28개 현재 판정은 통과 11 · 실패 1 · 재검증 필요 5 · 미검증 8 · 결과 없음 3이다. 나머지 16개 실제 시험/기준 결정은 이번에 진행하지 않았다. F07-03 수정도 별도 승인 대상이다. 최종 화면 집계의 정본은 기존 검증 결과 파일과 관리자 진행 현황이다.

결과 추가 후 15:41:53 KST에 verification-plan·verification-integration·admin-manual-verification 3파일 40개를 다시 실행해 모두 통과했다(위 197개와 중복이므로 별도 합산하지 않음). 원본 JSON 객체 비교로 기존 결과·구현 이력 전체 보존, 새 결과 11개·구현 기록 2개 추가, 계획 원본 불변, 매뉴얼 검사 ID 28개 일치와 위 집계를 확인했다. 첫 이력 검사에서 파싱 후 객체를 원본 문자열 직렬화와 비교해 발생한 오탐은 원본 객체 비교로 바로잡았으며 기존 이력은 수정하지 않았다.
