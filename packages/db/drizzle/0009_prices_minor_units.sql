-- Prices become integers in the currency's minor unit (docs/adr/0007-prices-are-integer-minor-units-with-iso-currency.md).
--
-- BACK UP THE DATABASE FIRST: pg_dump --format=custom --file=beztack-before-prices.dump "$DATABASE_URL"
-- (restore steps: docs/price-migration.md).
--
-- Old convention -> new convention:
--   mercadopago  major units (4500 = $ 4500) -> multiplied by 10^decimals of the row's currency
--   polar        a row whose id is the seed's own pattern polar_<tier>_<month|year> was
--                written by the seed in cents (900 = US$ 9.00): unchanged.
--                Every other Polar row (admin create, import, sync) was written in major
--                units (9.99 = US$ 9.99) and is multiplied like a Mercado Pago row.
--   any other    unchanged: nothing is known about its old unit
--
-- This converts both plan.price and the price inside every pending_plan_change
-- target_plan_snapshot (all statuses: history rows are read by the admin pages).
-- A snapshot carries the id of its plan, so the same id rule applies to it.
--
-- Rounding is half away from zero (round() on numeric), done BEFORE the integer
-- cast. After the conversion every price must be an exact integer: a row the
-- migration did not convert and that still has decimals stops the migration, so
-- the cast never rounds or truncates silently.
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

    -- Rows still written in major units: Mercado Pago, and Polar rows that are not the seed's.
    CREATE TEMP TABLE plan_in_major_units ON COMMIT DROP AS
    SELECT "id" FROM "plan"
    WHERE "provider" = 'mercadopago'
      OR ("provider" = 'polar' AND "id" !~ '^polar_.+_(month|year)$');

    CREATE TEMP TABLE change_in_major_units ON COMMIT DROP AS
    SELECT "id" FROM "pending_plan_change"
    WHERE "target_plan_snapshot" #>> '{price,amount}' IS NOT NULL
      AND (
        "target_plan_snapshot" ->> 'paymentProvider' = 'mercadopago'
        OR (
          "target_plan_snapshot" ->> 'paymentProvider' = 'polar'
          AND "target_plan_snapshot" ->> 'id' !~ '^polar_.+_(month|year)$'
        )
      );

    IF EXISTS (
      SELECT 1 FROM "plan"
      WHERE "id" IN (SELECT "id" FROM plan_in_major_units)
        AND upper("currency") NOT IN (SELECT code FROM currency_minor_units)
    ) OR EXISTS (
      SELECT 1 FROM "pending_plan_change"
      WHERE "id" IN (SELECT "id" FROM change_in_major_units)
        AND upper("target_plan_snapshot" #>> '{price,currency}') NOT IN (SELECT code FROM currency_minor_units)
    ) THEN
      RAISE EXCEPTION 'Price migration stopped: a plan or Pending Plan change that needs converting uses a currency that is not an ISO 4217 code in use. Fix the currency first (docs/price-migration.md).';
    END IF;

    UPDATE "plan"
    SET "price" = round("plan"."price" * power(10::numeric, c.decimals))
    FROM currency_minor_units c
    WHERE c.code = upper("plan"."currency")
      AND "plan"."id" IN (SELECT "id" FROM plan_in_major_units);

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
      AND "pending_plan_change"."id" IN (SELECT "id" FROM change_in_major_units);

    -- The cast below must see exact integers that fit in int4.
    IF EXISTS (
      SELECT 1 FROM "plan"
      WHERE "price" <> trunc("price") OR "price" > 2147483647 OR "price" < -2147483648
    ) THEN
      RAISE EXCEPTION 'Price migration stopped: a plan price is not an integer that fits in 32 bits after conversion (a provider we cannot convert has decimals, or a price is too large). Fix it first (docs/price-migration.md).';
    END IF;
    IF EXISTS (
      SELECT 1 FROM "pending_plan_change"
      WHERE ("target_plan_snapshot" #>> '{price,amount}')::numeric <> trunc(("target_plan_snapshot" #>> '{price,amount}')::numeric)
    ) THEN
      RAISE EXCEPTION 'Price migration stopped: a Pending Plan change snapshot price is not an integer after conversion. Fix it first (docs/price-migration.md).';
    END IF;
  END IF;
END
$$;--> statement-breakpoint
ALTER TABLE "plan" ALTER COLUMN "price" SET DATA TYPE integer;
