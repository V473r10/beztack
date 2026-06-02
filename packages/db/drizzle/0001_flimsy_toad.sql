CREATE TABLE "admin_tier_override" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"tier" text NOT NULL,
	"billing_cadence" text,
	"actor_user_id" text NOT NULL,
	"source_action" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_tier_override_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"tier" text NOT NULL,
	"billing_cadence" text,
	"actor_user_id" text NOT NULL,
	"source_action" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_tier_override" ADD CONSTRAINT "admin_tier_override_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_tier_override_audit" ADD CONSTRAINT "admin_tier_override_audit_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_tier_override_target_uidx" ON "admin_tier_override" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "admin_tier_override_actor_idx" ON "admin_tier_override" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "admin_tier_override_audit_target_idx" ON "admin_tier_override_audit" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "admin_tier_override_audit_actor_idx" ON "admin_tier_override_audit" USING btree ("actor_user_id");