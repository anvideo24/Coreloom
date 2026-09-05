CREATE TABLE "agent_chat_threads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id"),
  "agent_id" uuid NOT NULL REFERENCES "ai_agents"("id"),
  "title" text NOT NULL,
  "model" text NOT NULL,
  "busy_until" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "agent_chat_threads_agent_idx" ON "agent_chat_threads" ("workspace_id", "agent_id");
--> statement-breakpoint
CREATE TABLE "agent_chat_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "thread_id" uuid NOT NULL REFERENCES "agent_chat_threads"("id"),
  "role" text NOT NULL,
  "body" text NOT NULL,
  "model" text NOT NULL,
  "status" text DEFAULT 'complete' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "agent_chat_messages_thread_idx" ON "agent_chat_messages" ("thread_id", "created_at");
