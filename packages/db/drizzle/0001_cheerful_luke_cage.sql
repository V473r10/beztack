CREATE TABLE "mp_plan" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text,
	"collector_id" text,
	"reason" text NOT NULL,
	"status" text NOT NULL,
	"frequency" integer NOT NULL,
	"frequency_type" text NOT NULL,
	"transaction_amount" numeric NOT NULL,
	"currency_id" text NOT NULL,
	"repetitions" integer,
	"billing_day" integer,
	"billing_day_proportional" boolean,
	"free_trial_frequency" integer,
	"free_trial_frequency_type" text,
	"init_point" text,
	"back_url" text,
	"date_created" timestamp,
	"last_modified" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mp_payment" DROP CONSTRAINT "mp_payment_order_id_mp_order_id_fk";
--> statement-breakpoint
ALTER TABLE "mp_subscription" ADD CONSTRAINT "mp_subscription_preapproval_plan_id_mp_plan_id_fk" FOREIGN KEY ("preapproval_plan_id") REFERENCES "public"."mp_plan"("id") ON DELETE no action ON UPDATE no action;