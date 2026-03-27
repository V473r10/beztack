CREATE TABLE "payment" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"provider_payment_id" text,
	"user_id" text,
	"subscription_id" text,
	"status" text NOT NULL,
	"amount" numeric NOT NULL,
	"currency" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"provider_subscription_id" text,
	"user_id" text,
	"organization_id" text,
	"plan_id" text,
	"status" text NOT NULL,
	"external_reference" text,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"cancel_at_period_end" boolean,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event_type" text,
	"resource_id" text,
	"raw_payload" jsonb,
	"status" text,
	"error_message" text,
	"processed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "feature" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "limit" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mp_chargeback" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mp_invoice" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mp_order" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mp_payment" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mp_plan" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mp_refund" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mp_subscription" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mp_webhook_log" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "permission" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plan_feature" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plan_limit" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plan_permission" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "feature" CASCADE;--> statement-breakpoint
DROP TABLE "limit" CASCADE;--> statement-breakpoint
DROP TABLE "mp_chargeback" CASCADE;--> statement-breakpoint
DROP TABLE "mp_invoice" CASCADE;--> statement-breakpoint
DROP TABLE "mp_order" CASCADE;--> statement-breakpoint
DROP TABLE "mp_payment" CASCADE;--> statement-breakpoint
DROP TABLE "mp_plan" CASCADE;--> statement-breakpoint
DROP TABLE "mp_refund" CASCADE;--> statement-breakpoint
DROP TABLE "mp_subscription" CASCADE;--> statement-breakpoint
DROP TABLE "mp_webhook_log" CASCADE;--> statement-breakpoint
DROP TABLE "permission" CASCADE;--> statement-breakpoint
DROP TABLE "plan_feature" CASCADE;--> statement-breakpoint
DROP TABLE "plan_limit" CASCADE;--> statement-breakpoint
DROP TABLE "plan_permission" CASCADE;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "payment_customer_id" text;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "provider" text NOT NULL;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "provider_plan_id" text;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "canonical_tier_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "display_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "features" jsonb;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "limits" jsonb;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "permissions" jsonb;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "price" numeric NOT NULL;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "currency" text NOT NULL;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "interval" text;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "interval_count" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "display_order" integer;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "highlighted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "visible" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "status" text DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "plan" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_plan_id_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_provider_idx" ON "payment" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "payment_user_idx" ON "payment" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payment_subscription_idx" ON "payment" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "payment_status_idx" ON "payment" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscription_provider_idx" ON "subscription" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "subscription_user_idx" ON "subscription" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscription_org_idx" ON "subscription" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "subscription_plan_idx" ON "subscription" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "subscription_status_idx" ON "subscription" USING btree ("status");--> statement-breakpoint
CREATE INDEX "webhook_log_provider_idx" ON "webhook_log" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "webhook_log_event_type_idx" ON "webhook_log" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "webhook_log_status_idx" ON "webhook_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "plan_provider_idx" ON "plan" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "plan_tier_idx" ON "plan" USING btree ("canonical_tier_id");--> statement-breakpoint
CREATE INDEX "plan_status_idx" ON "plan" USING btree ("status");--> statement-breakpoint
ALTER TABLE "organization" DROP COLUMN "polar_customer_id";