# 역사적 인계 — 5단계: AI 답변·초안·실제 반영 구분(F04)

작성일: 2026-09-05 · 5단계 착수 전 인계 원본 · 현재 실행 지시 아님

이 문서는 5단계 착수 전 인계 기록이다. 검사 목표·방법의 원본은 [개선 계획](../../docs/superpowers/plans/2026-09-05-measurable-improvements.md)이고, F04의 서버 상태 가드와 명시적 중지 구분은 이후 병합됐다. F04-02·04 자동 검증 통과, F04-03 실제 서버 재조회 미검증, F04-01 대표 측정 대기라는 현재 판정은 [결과 파일](../../docs/quality/verification-results.json)에 있다. 이 문서의 과거 실행 지시를 다시 수행하지 않는다. 메시지별 상태 표시의 후속 구현·검증 범위는 [시스템 진행 현황](../system-progress.md)에서 확인한다.

## 읽을 순서

1. 공용 정본 — GitHub `anvideo24/working-method`의 `AGENTS.md` → `HOW.md` → `LESSONS.md` → `RULES.md`. 로컬 클론은 이 저장소와 같은 부모 폴더(`C:\dev\working-method`)에 있다.
2. 이 제품 — [RULES.md](../../RULES.md) → [AGENTS.md](../../AGENTS.md) → [운영 매뉴얼](../00-coreloom-매뉴얼.md).
3. 이 문서 → 계획서 F04 절 → [결과 파일](../../docs/quality/verification-results.json).
4. 코드를 고치기 직전에 `apps/web/AGENTS.md`와 수정 경로에 적용되는 지침을 읽는다.

같은 폴더의 [2026-09-05 Claude 인계(오전)](2026-09-05-claude-measurable-improvements.md)는 **2단계 착수 전**이다. 「어디까지 했나」를 현재로 읽지 않는다. 4단계 이력은 [커서 4단계](2026-09-05-cursor-stage4-client-quote-approvals.md)다.

## 1–4단계는 끝났다 (코드)

| 단계 | 내용 | main |
|---|---|---|
| 1 | 목표 7개·검사 28개·기준 측정 일부 | 문서 |
| 2 | F07 조회 화면 | PR #89 |
| 3 | F05 정확성·F02 초안 보존(자동 일부) | PR #92 |
| 4 | F01 견적 안 고객사·F03 확정 전 검토·게이트(자동 일부) | PR #93 (`8cdb2456ad42d72b07d95dffcb7ffba8e86e1b92`) |

아직인 것(사람·실기기, 이번 단계가 아님): F01-03, F02 실기기 16조합·F02-02·03, F03-01·02, F07-01·05·06 대표 측정. 운영 배포 없음.

## 5단계 범위 — F04만

목표: AI가 **말만 했는지 / 저장할 후보(초안)인지 / 시스템에 실제 반영했는지**를 섞지 않는다. 상태는 모델 문장이 아니라 **서버가 확인한 실행 기록**에서 온다.

| 검사 | 이번 작업 | 통과 기준 |
|---|---|---|
| F04-01 | 안 함(사람) | 6/6 상태 분류 정답, 각 5초 이내(제안) — 대표 측정 |
| F04-02 | 함(자동 가능분) | 승인 전·실패 시 「반영됨」 오표시 0건 |
| F04-03 | 쓰기 도구가 없으면 범위 밖으로 밝히거나, 있으면 함 | 반영 결과 재조회 일치 100% |
| F04-04 | 함 | 사용자가 누르지 않은 중지의 오표시 0건 |

### 손댈 곳 (계획서·실제 경로)

- `apps/web/src/components/agent-chat.tsx`
- `apps/web/src/lib/agents/chat-runs.ts` (명시적 중지만 abort — 연결 끊김≠중지)
- `apps/web/src/app/api/agents/chat/route.ts`
- `apps/web/src/lib/domain/agent-chat.ts`
- 관련 시험: `apps/web/tests/chat-runs.test.ts`, `agent-chat.test.ts`, `agent-chat-ui.test.tsx`

### 하지 않는 것

- 실제 쓰기 도구를 **새로** 넣는 일은 별도 설계·승인 없이는 하지 않는다. 계획서: 「실제 쓰기 도구는 별도 설계·승인 뒤에만」.
- 외부 발송·결제·권한 자동 변경, F06, main 병합 우회, 운영 배포.
- 사람 측정(F04-01 등)을 도구가 대신 통과로 적지 않는다.
- 공개 저장소: 실데이터·비밀·고객사명·이메일을 코드·문서·커밋·PR에 넣지 않는다.

## 끝났다고 말하는 법

1. 실패하는 자동 시험을 먼저 두고 고친다. 시험을 느슨하게 바꿔 통과시키지 않는다.
2. 결과 파일에 **새 줄을 덧붙인다.** 이전 줄은 지우지 않는다.
3. 결과 줄의 `codeCommit`은 **검증한 코드 커밋**(40자)이다. 결과 파일을 저장한 커밋이 아니다.
4. `implementation`에 F04 `in-progress` → 병합 후 `on-main`을 **덧붙인다.**
5. 같은 커밋에서 `manual/system-progress.md`·`manual/CHANGELOG.md`·필요 시 매뉴얼·이 인계의 상태 줄을 맞춘다.
6. CI 통과 없이 `main`에 합치지 않는다.

필드·판정 규칙 정본은 `apps/web/src/lib/domain/verification-plan.ts`다.

## 착수 전

큰 일이면 계획·완료 기준을 짧게 내고 **대표 승인 후** 코드를 쓴다. 새 가지는 최신 `main`에서 `cursor/…` 또는 팀 관례의 Claude 가지 이름으로 딴다. 이미 합쳐진 옛 가지에 이어 붙이지 않는다.
