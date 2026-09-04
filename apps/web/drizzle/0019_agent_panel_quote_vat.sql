CREATE TYPE "public"."ai_agent_model_provider" AS ENUM('claude_subscription', 'gpt_codex_subscription', 'cursor_agent');--> statement-breakpoint
CREATE TYPE "public"."quote_vat_mode" AS ENUM('exclusive', 'inclusive');--> statement-breakpoint
ALTER TABLE "ai_agents" ADD COLUMN "work_style" text;--> statement-breakpoint
ALTER TABLE "ai_agents" ADD COLUMN "answer_style" text;--> statement-breakpoint
ALTER TABLE "ai_agents" ADD COLUMN "procedure" text;--> statement-breakpoint
ALTER TABLE "ai_agents" ADD COLUMN "instructions" text;--> statement-breakpoint
ALTER TABLE "ai_agents" ADD COLUMN "model_provider" "ai_agent_model_provider" DEFAULT 'claude_subscription' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_agents" ADD COLUMN "capabilities" jsonb DEFAULT '{"save_records":false,"send_external":false,"confirm_money":false,"change_permissions":false}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "vat_mode" "quote_vat_mode" DEFAULT 'exclusive' NOT NULL;
