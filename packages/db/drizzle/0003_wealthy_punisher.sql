ALTER TABLE "mp_plan" ADD COLUMN "canonical_tier_id" text;--> statement-breakpoint
ALTER TABLE "mp_plan" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "mp_plan" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "mp_plan" ADD COLUMN "features" jsonb;--> statement-breakpoint
ALTER TABLE "mp_plan" ADD COLUMN "limits" jsonb;--> statement-breakpoint
ALTER TABLE "mp_plan" ADD COLUMN "permissions" jsonb;--> statement-breakpoint
ALTER TABLE "mp_plan" ADD COLUMN "display_order" integer;--> statement-breakpoint
ALTER TABLE "mp_plan" ADD COLUMN "highlighted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "mp_plan" ADD COLUMN "visible" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "mp_subscription" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "subscription_tier" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "subscription_status" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "subscription_id" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "subscription_valid_until" timestamp;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "polar_customer_id" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "usage_metrics" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "billing_managed_by_role" text DEFAULT 'owner';--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "subscription_tier" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "subscription_status" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "subscription_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "subscription_valid_until" timestamp;--> statement-breakpoint
ALTER TABLE "mp_subscription" ADD CONSTRAINT "mp_subscription_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mp_plan_tier_idx" ON "mp_plan" USING btree ("canonical_tier_id");--> statement-breakpoint
CREATE INDEX "mp_subscription_org_idx" ON "mp_subscription" USING btree ("organization_id");