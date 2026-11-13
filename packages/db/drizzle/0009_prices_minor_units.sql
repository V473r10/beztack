-- Prices become integers in the currency's minor unit (docs/adr/0007-prices-are-integer-minor-units-with-iso-currency.md).
--
-- BACK UP THE DATABASE FIRST: pg_dump --format=custom --file=beztack-before-prices.dump "$DATABASE_URL"
-- (restore steps: docs/price-migration.md).
--
-- Old convention -> new convention:
--   polar        cents (900 = US$ 9.00)      -> unchanged, already minor units
--   mercadopago  major units (4500 = $ 4500) -> multiplied by 10^decimals of the row's currency
--   any other    unchanged: nothing is known about its old unit
--
-- This converts both plan.price and the price inside every pending_plan_change
-- target_plan_snapshot (all statuses: history rows are read by the admin pages).
--
-- The conversion runs only while plan.price is still numeric, so replaying this
-- file never multiplies twice (the first run turns the column into an integer).
--
-- The number of decimals mirrors currencyDecimals() in @beztack/payments/money,
-- i.e. Intl.NumberFormat(...).resolvedOptions().maximumFractionDigits. SQL has no
-- Intl, so the currencies that do NOT have 2 decimals are frozen below, listed
-- from the ICU data of Node 26 (every other currency has 2).
DO $$
DECLARE
  zero_decimal text[] := ARRAY['AFN','ALL','BIF','CLP','COP','DJF','GNF','HUF','IDR','IQD','IRR','ISK','JPY','KMF','KPW','KRW','LAK','LBP','MGA','MMK','PKR','PYG','RWF','SLL','SOS','SYP','UGX','VND','VUV','XAF','XOF','XPF','YER'];
  three_decimal text[] := ARRAY['BHD','JOD','KWD','LYD','OMR','TND'];
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'plan'
      AND column_name = 'price'
      AND data_type = 'numeric'
  ) THEN
    UPDATE "plan"
    SET "price" = round(
      "price" * power(
        10::numeric,
        CASE
          WHEN upper("currency") = ANY (zero_decimal) THEN 0
          WHEN upper("currency") = ANY (three_decimal) THEN 3
          ELSE 2
        END
      )
    )
    WHERE "provider" = 'mercadopago';

    UPDATE "pending_plan_change"
    SET "target_plan_snapshot" = jsonb_set(
      "target_plan_snapshot",
      '{price,amount}',
      to_jsonb(
        round(
          ("target_plan_snapshot" #>> '{price,amount}')::numeric * power(
            10::numeric,
            CASE
              WHEN upper("target_plan_snapshot" #>> '{price,currency}') = ANY (zero_decimal) THEN 0
              WHEN upper("target_plan_snapshot" #>> '{price,currency}') = ANY (three_decimal) THEN 3
              ELSE 2
            END
          )
        )
      )
    )
    WHERE "target_plan_snapshot" ->> 'paymentProvider' = 'mercadopago'
      AND "target_plan_snapshot" #>> '{price,amount}' IS NOT NULL;
  END IF;
END
$$;--> statement-breakpoint
ALTER TABLE "plan" ALTER COLUMN "price" SET DATA TYPE integer;
