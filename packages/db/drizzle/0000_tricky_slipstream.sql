CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"team_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"inviter_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "limit" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mp_chargeback" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_id" text,
	"amount" numeric,
	"coverage_applied" boolean,
	"coverage_eligible" boolean,
	"status" text NOT NULL,
	"stage" text,
	"reason" text,
	"reason_detail" text,
	"documentation_required" boolean,
	"documentation_status" text,
	"resolution" text,
	"date_created" timestamp,
	"date_last_updated" timestamp,
	"date_documentation_deadline" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mp_invoice" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text,
	"payment_id" text,
	"external_reference" text,
	"status" text NOT NULL,
	"reason" text,
	"transaction_amount" numeric,
	"currency_id" text,
	"payer_id" text,
	"type" text,
	"retry_attempt" integer,
	"debit_date" timestamp,
	"date_created" timestamp,
	"last_modified" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mp_order" (
	"id" text PRIMARY KEY NOT NULL,
	"preference_id" text,
	"application_id" text,
	"external_reference" text,
	"status" text NOT NULL,
	"order_status" text,
	"site_id" text,
	"payer_id" text,
	"collector_id" text,
	"paid_amount" numeric,
	"refunded_amount" numeric,
	"shipping_cost" numeric,
	"total_amount" numeric,
	"cancelled" boolean DEFAULT false,
	"notification_url" text,
	"additional_info" text,
	"is_test" boolean DEFAULT false,
	"date_created" timestamp,
	"last_updated" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mp_payment" (
	"id" text PRIMARY KEY NOT NULL,
	"beztack_user_id" text,
	"order_id" text,
	"external_reference" text,
	"status" text NOT NULL,
	"status_detail" text,
	"operation_type" text,
	"payment_method_id" text,
	"payment_type_id" text,
	"issuer_id" text,
	"transaction_amount" numeric,
	"transaction_amount_refunded" numeric,
	"net_received_amount" numeric,
	"currency_id" text,
	"installments" integer,
	"payer_id" text,
	"payer_email" text,
	"collector_id" text,
	"description" text,
	"statement_descriptor" text,
	"card_first_six_digits" text,
	"card_last_four_digits" text,
	"live_mode" boolean,
	"date_created" timestamp,
	"date_approved" timestamp,
	"date_last_updated" timestamp,
	"money_release_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mp_refund" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_id" text NOT NULL,
	"amount" numeric,
	"amount_refunded_to_payer" numeric,
	"adjustment_amount" numeric,
	"status" text,
	"reason" text,
	"refund_mode" text,
	"source_id" text,
	"source_name" text,
	"source_type" text,
	"unique_sequence_number" text,
	"date_created" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mp_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"beztack_user_id" text,
	"preapproval_plan_id" text,
	"external_reference" text,
	"payer_id" text,
	"payer_email" text,
	"collector_id" text,
	"application_id" text,
	"status" text NOT NULL,
	"reason" text,
	"init_point" text,
	"back_url" text,
	"frequency" integer,
	"frequency_type" text,
	"transaction_amount" numeric,
	"currency_id" text,
	"charged_quantity" integer,
	"charged_amount" numeric,
	"pending_charge_amount" numeric,
	"next_payment_date" timestamp,
	"payment_method_id" text,
	"date_created" timestamp,
	"last_modified" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mp_webhook_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"webhook_id" text,
	"type" text NOT NULL,
	"action" text,
	"resource_id" text,
	"live_mode" boolean,
	"mp_user_id" text,
	"api_version" text,
	"raw_payload" text,
	"status" text DEFAULT 'received' NOT NULL,
	"error_message" text,
	"processed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"logo" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"metadata" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "permission" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "plan" (
	"id" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_feature" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" uuid NOT NULL,
	"feature_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_limit" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" uuid NOT NULL,
	"limit_id" integer NOT NULL,
	"value" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_permission" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" uuid NOT NULL,
	"permission_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	"active_organization_id" text,
	"active_team_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_member" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"two_factor_enabled" boolean DEFAULT false,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mp_chargeback" ADD CONSTRAINT "mp_chargeback_payment_id_mp_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."mp_payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mp_invoice" ADD CONSTRAINT "mp_invoice_subscription_id_mp_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."mp_subscription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mp_payment" ADD CONSTRAINT "mp_payment_beztack_user_id_user_id_fk" FOREIGN KEY ("beztack_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mp_payment" ADD CONSTRAINT "mp_payment_order_id_mp_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."mp_order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mp_refund" ADD CONSTRAINT "mp_refund_payment_id_mp_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."mp_payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mp_subscription" ADD CONSTRAINT "mp_subscription_beztack_user_id_user_id_fk" FOREIGN KEY ("beztack_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_feature" ADD CONSTRAINT "plan_feature_feature_id_feature_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."feature"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_limit" ADD CONSTRAINT "plan_limit_limit_id_limit_id_fk" FOREIGN KEY ("limit_id") REFERENCES "public"."limit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_permission" ADD CONSTRAINT "plan_permission_permission_id_permission_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;