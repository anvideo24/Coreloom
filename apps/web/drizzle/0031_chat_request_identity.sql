ALTER TABLE "agent_chat_messages" ADD COLUMN "client_request_id" uuid;
--> statement-breakpoint
CREATE UNIQUE INDEX "agent_chat_messages_request_role_idx" ON "agent_chat_messages" ("client_request_id", "role");
