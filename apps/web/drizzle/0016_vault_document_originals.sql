ALTER TABLE "vault_document_versions" ADD COLUMN "stored_filename" text;--> statement-breakpoint
ALTER TABLE "vault_document_versions" ADD COLUMN "content_type" text;--> statement-breakpoint
ALTER TABLE "vault_document_versions" ADD COLUMN "byte_size" integer;--> statement-breakpoint
ALTER TABLE "vault_document_versions" ADD COLUMN "storage_key" text;