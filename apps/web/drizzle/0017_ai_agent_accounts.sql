CREATE TYPE "public"."ai_agent_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."ai_agent_work_log_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "ai_agent_work_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"task_id" uuid,
	"recorded_by_user_id" text NOT NULL,
	"request_note" text NOT NULL,
	"input_note" text NOT NULL,
	"result_note" text,
	"status" "ai_agent_work_log_status" DEFAULT 'pending' NOT NULL,
	"decision_reason" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"purpose" text NOT NULL,
	"allowed_work" jsonb NOT NULL,
	"access_scope" text NOT NULL,
	"project_id" uuid,
	"venture_id" uuid,
	"status" "ai_agent_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "assigned_agent_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_agent_work_logs" ADD CONSTRAINT "ai_agent_work_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agent_work_logs" ADD CONSTRAINT "ai_agent_work_logs_agent_id_ai_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agent_work_logs" ADD CONSTRAINT "ai_agent_work_logs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agents" ADD CONSTRAINT "ai_agents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agents" ADD CONSTRAINT "ai_agents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agents" ADD CONSTRAINT "ai_agents_venture_id_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."ventures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_agent_work_logs_agent_created_at_idx" ON "ai_agent_work_logs" USING btree ("agent_id","created_at" desc);--> statement-breakpoint
CREATE INDEX "ai_agent_work_logs_workspace_created_at_idx" ON "ai_agent_work_logs" USING btree ("workspace_id","created_at" desc);--> statement-breakpoint
CREATE INDEX "ai_agents_workspace_updated_at_idx" ON "ai_agents" USING btree ("workspace_id","updated_at" desc);--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_agent_id_ai_agents_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."ai_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_assigned_agent_idx" ON "tasks" USING btree ("assigned_agent_id");