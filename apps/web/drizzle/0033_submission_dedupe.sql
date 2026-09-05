-- F02-03: 같은 저장 요청이 두 번 오면 두 번째를 막는다.
-- 화면 방어(제출 중 버튼 비활성)는 새로고침 한 번에 사라진다. 마지막 관문은 데이터베이스다.
--
-- 손으로 쓴 마이그레이션이다. `drizzle-kit generate`는 meta 스냅샷이 0018에서 멈춰 있어
-- 그 뒤 마이그레이션이 만든 것을 「없는 것」으로 보고 표를 통째로 다시 만들려 한다.
--
-- 기존 줄의 submission_id는 비어 있다. Postgres는 유일 인덱스에서 빈 값끼리를 서로 다르게
-- 보므로, 이미 있는 자료는 하나도 걸리지 않는다.
ALTER TABLE "client_companies" ADD COLUMN "submission_id" uuid;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "submission_id" uuid;
--> statement-breakpoint
CREATE UNIQUE INDEX "client_companies_submission_idx" ON "client_companies" ("submission_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_submission_idx" ON "quotes" ("submission_id");
