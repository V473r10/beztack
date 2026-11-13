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
-- The number of decimals is the ISO 4217 minor unit (the CcyMnrUnts field of
-- the "List one" published by SIX, 2026-09-17), the same table as
-- ISO_4217_MINOR_UNITS in @beztack/payments/money. SQL has no access to that
-- module, so the table is repeated below and a test fails if the two differ.
-- A currency that is not in the table stops the migration instead of guessing.
DO $$
DECLARE
  zero_decimal text[] := ARRAY['BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG',
      'RWF', 'UGX', 'UYI', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'];
  two_decimal text[] := ARRAY['AED', 'AFN', 'ALL', 'AMD', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM',
      'BBD', 'BDT', 'BMD', 'BND', 'BOB', 'BOV', 'BRL', 'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD',
      'CDF', 'CHE', 'CHF', 'CHW', 'CNY', 'COP', 'COU', 'CRC', 'CUP', 'CVE', 'CZK', 'DKK', 'DOP',
      'DZD', 'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD', 'GTQ',
      'GYD', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR', 'IRR', 'JMD', 'KES', 'KGS', 'KHR',
      'KPW', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK',
      'MNT', 'MOP', 'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MXV', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO',
      'NOK', 'NPR', 'NZD', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'QAR', 'RON', 'RSD', 'RUB',
      'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SVC',
      'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'USD', 'USN',
      'UYU', 'UZS', 'VED', 'VES', 'WST', 'XAD', 'XCD', 'XCG', 'YER', 'ZAR', 'ZMW', 'ZWG'];
  three_decimal text[] := ARRAY['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND'];
  four_decimal text[] := ARRAY['CLF', 'UYW'];
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'plan'
      AND column_name = 'price'
      AND data_type = 'numeric'
  ) THEN
    CREATE TEMP TABLE currency_minor_units (code text PRIMARY KEY, decimals integer NOT NULL) ON COMMIT DROP;
    INSERT INTO currency_minor_units (code, decimals)
    SELECT code, 0 FROM unnest(zero_decimal) AS code
    UNION ALL SELECT code, 2 FROM unnest(two_decimal) AS code
    UNION ALL SELECT code, 3 FROM unnest(three_decimal) AS code
    UNION ALL SELECT code, 4 FROM unnest(four_decimal) AS code;

    IF EXISTS (
      SELECT 1 FROM "plan"
      WHERE "provider" = 'mercadopago'
        AND upper("currency") NOT IN (SELECT code FROM currency_minor_units)
    ) OR EXISTS (
      SELECT 1 FROM "pending_plan_change"
      WHERE "target_plan_snapshot" ->> 'paymentProvider' = 'mercadopago'
        AND "target_plan_snapshot" #>> '{price,amount}' IS NOT NULL
        AND upper("target_plan_snapshot" #>> '{price,currency}') NOT IN (SELECT code FROM currency_minor_units)
    ) THEN
      RAISE EXCEPTION 'Price migration stopped: a Mercado Pago plan or Pending Plan change uses a currency that is not an ISO 4217 code in use. Fix the currency first (docs/price-migration.md).';
    END IF;

    UPDATE "plan"
    SET "price" = round("plan"."price" * power(10::numeric, c.decimals))
    FROM currency_minor_units c
    WHERE c.code = upper("plan"."currency")
      AND "plan"."provider" = 'mercadopago';

    UPDATE "pending_plan_change"
    SET "target_plan_snapshot" = jsonb_set(
      "target_plan_snapshot",
      '{price,amount}',
      to_jsonb(
        round(("target_plan_snapshot" #>> '{price,amount}')::numeric * power(10::numeric, c.decimals))
      )
    )
    FROM currency_minor_units c
    WHERE c.code = upper("target_plan_snapshot" #>> '{price,currency}')
      AND "target_plan_snapshot" ->> 'paymentProvider' = 'mercadopago'
      AND "target_plan_snapshot" #>> '{price,amount}' IS NOT NULL;
  END IF;
END
$$;--> statement-breakpoint
ALTER TABLE "plan" ALTER COLUMN "price" SET DATA TYPE integer;
