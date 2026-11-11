ALTER TABLE "team" ADD COLUMN "member_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "team_member" ADD COLUMN "membership_key" text;--> statement-breakpoint
ALTER TABLE "two_factor" ADD COLUMN "verified" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "two_factor" ADD COLUMN "failed_verification_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "two_factor" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_membership_key_unique" UNIQUE("membership_key");--> statement-breakpoint
-- better-auth 1.7 enforces team seat limits through team.member_count.
-- Existing teams start at the default 0, so count their current members.
-- membership_key stays NULL on old rows: better-auth falls back to (team_id, user_id).
UPDATE "team" SET "member_count" = (SELECT count(*) FROM "team_member" WHERE "team_member"."team_id" = "team"."id");