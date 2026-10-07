DROP INDEX "pending_plan_change_subscription_uidx";--> statement-breakpoint
ALTER TABLE "pending_plan_change" ALTER COLUMN "target_plan_snapshot" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pending_plan_change" ADD COLUMN "accepted_by_user_id" text;--> statement-breakpoint
ALTER TABLE "pending_plan_change" ADD COLUMN "canceled_by_user_id" text;--> statement-breakpoint
ALTER TABLE "pending_plan_change" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "pending_plan_change" ADD COLUMN "activation_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pending_plan_change" ADD COLUMN "activated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pending_plan_change" ADD COLUMN "canceled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pending_plan_change" ADD COLUMN "failed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pending_plan_change" ADD CONSTRAINT "pending_plan_change_accepted_by_user_id_user_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_plan_change" ADD CONSTRAINT "pending_plan_change_canceled_by_user_id_user_id_fk" FOREIGN KEY ("canceled_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pending_plan_change_subscription_pending_uidx" ON "pending_plan_change" USING btree ("subscription_id") WHERE "pending_plan_change"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "pending_plan_change_subscription_idx" ON "pending_plan_change" USING btree ("subscription_id");