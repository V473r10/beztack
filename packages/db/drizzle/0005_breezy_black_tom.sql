ALTER TABLE "webhook_log" ADD COLUMN "event_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_log_event_key_idx" ON "webhook_log" USING btree ("event_key");