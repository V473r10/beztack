CREATE TABLE "pending_plan_change" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL,
	"direction" text NOT NULL,
	"membership_target_type" text NOT NULL,
	"membership_target_id" text NOT NULL,
	"target_plan_snapshot" jsonb,
	"provider_confirmed_plan_change_id" text NOT NULL,
	"effective_at" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pending_plan_change" ADD CONSTRAINT "pending_plan_change_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pending_plan_change_subscription_uidx" ON "pending_plan_change" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "pending_plan_change_status_idx" ON "pending_plan_change" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pending_plan_change_effective_at_idx" ON "pending_plan_change" USING btree ("effective_at");