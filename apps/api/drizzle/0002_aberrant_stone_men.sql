ALTER TABLE "mp_chargeback" ADD COLUMN "currency_id" text;--> statement-breakpoint
ALTER TABLE "mp_subscription" ADD COLUMN "end_date" timestamp;--> statement-breakpoint
ALTER TABLE "mp_subscription" ADD COLUMN "semaphore" text;--> statement-breakpoint
CREATE INDEX "mp_chargeback_payment_idx" ON "mp_chargeback" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "mp_chargeback_status_idx" ON "mp_chargeback" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mp_invoice_subscription_idx" ON "mp_invoice" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "mp_invoice_status_idx" ON "mp_invoice" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mp_invoice_debit_date_idx" ON "mp_invoice" USING btree ("debit_date");--> statement-breakpoint
CREATE INDEX "mp_order_status_idx" ON "mp_order" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mp_order_external_ref_idx" ON "mp_order" USING btree ("external_reference");--> statement-breakpoint
CREATE INDEX "mp_order_preference_idx" ON "mp_order" USING btree ("preference_id");--> statement-breakpoint
CREATE INDEX "mp_payment_user_idx" ON "mp_payment" USING btree ("beztack_user_id");--> statement-breakpoint
CREATE INDEX "mp_payment_status_idx" ON "mp_payment" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mp_payment_order_idx" ON "mp_payment" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "mp_payment_external_ref_idx" ON "mp_payment" USING btree ("external_reference");--> statement-breakpoint
CREATE INDEX "mp_payment_payer_email_idx" ON "mp_payment" USING btree ("payer_email");--> statement-breakpoint
CREATE INDEX "mp_payment_date_created_idx" ON "mp_payment" USING btree ("date_created");--> statement-breakpoint
CREATE INDEX "mp_plan_status_idx" ON "mp_plan" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mp_refund_payment_idx" ON "mp_refund" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "mp_refund_status_idx" ON "mp_refund" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mp_subscription_user_idx" ON "mp_subscription" USING btree ("beztack_user_id");--> statement-breakpoint
CREATE INDEX "mp_subscription_plan_idx" ON "mp_subscription" USING btree ("preapproval_plan_id");--> statement-breakpoint
CREATE INDEX "mp_subscription_status_idx" ON "mp_subscription" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mp_subscription_payer_email_idx" ON "mp_subscription" USING btree ("payer_email");--> statement-breakpoint
CREATE INDEX "mp_webhook_log_type_idx" ON "mp_webhook_log" USING btree ("type");--> statement-breakpoint
CREATE INDEX "mp_webhook_log_resource_idx" ON "mp_webhook_log" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "mp_webhook_log_status_idx" ON "mp_webhook_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mp_webhook_log_processed_at_idx" ON "mp_webhook_log" USING btree ("processed_at");