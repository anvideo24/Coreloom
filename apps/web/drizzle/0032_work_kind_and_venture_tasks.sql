-- F06: 업무가 고객사 프로젝트 말고 회사 운영·자체 사업에도 붙을 수 있게 한다.
-- 자체 사업은 이미 있는 ventures를 쓴다. 새 표를 만들지 않는다.
--
-- 손으로 쓴 마이그레이션이다. `drizzle-kit generate`를 쓰지 않았다 —
-- meta 스냅샷이 0018에서 멈춰 있어 그 도구가 0019~0031이 만든 것을 「없는 것」으로 보고
-- 표 4개와 칸 수십 개를 다시 만들려 했다. 그대로 돌렸으면 이미 있는 표에 부딪혀 깨졌다.
CREATE TYPE "public"."work_kind" AS ENUM('company', 'internal', 'client');
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "kind" "work_kind" DEFAULT 'client' NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "venture_id" uuid;
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_venture_id_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."ventures"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- 기존 업무는 전부 프로젝트·고객사를 가지고 있었다. 그래서 위 기본값 'client'와 맞고,
-- 아래에서 NOT NULL을 풀어도 이미 있는 줄은 하나도 안 바뀐다.
ALTER TABLE "tasks" ALTER COLUMN "project_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "client_company_id" DROP NOT NULL;
--> statement-breakpoint
-- 유형과 연결을 데이터베이스가 직접 맞춘다. 코드가 깜빡해도 잘못된 조합은 안 들어간다.
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_kind_link_ck" CHECK (
  ("kind" = 'client' AND "project_id" IS NOT NULL AND "client_company_id" IS NOT NULL AND "venture_id" IS NULL)
  OR ("kind" = 'internal' AND "venture_id" IS NOT NULL AND "project_id" IS NULL AND "client_company_id" IS NULL)
  OR ("kind" = 'company' AND "project_id" IS NULL AND "client_company_id" IS NULL AND "venture_id" IS NULL)
);
--> statement-breakpoint
CREATE INDEX "tasks_venture_created_at_idx" ON "tasks" ("venture_id", "created_at" desc);
--> statement-breakpoint
CREATE INDEX "tasks_workspace_kind_idx" ON "tasks" ("workspace_id", "kind");
