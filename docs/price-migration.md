# Migrating stored prices to minor units

Migration `packages/db/drizzle/0009_prices_minor_units.sql` changes how Beztack stores money
([ADR 0007](adr/0007-prices-are-integer-minor-units-with-iso-currency.md)): `plan.price` becomes an
`integer` in the currency's minor unit, and the price inside every Pending Plan change's
`target_plan_snapshot` follows. `900` + `USD` is US$ 9.00, `900` + `JPY` is ¥ 900.

If your database is new, there is nothing to do: `pnpm db:migrate` creates the final shape.
If it already has plans or Pending Plan changes, read this first. The migration rewrites money data.

## 1. Back up first

```bash
pg_dump --format=custom --file=beztack-before-prices.dump "$DATABASE_URL"
```

Keep the dump until you have checked the result (step 3). To go back:

```bash
createdb beztack_restored
pg_restore --no-owner --dbname=beztack_restored beztack-before-prices.dump
```

Restore into an empty database and point `DATABASE_URL` at it. Do not restore over a database that
already ran the migration: the dump has the old shape, and the migration would have to run again.

To rehearse, restore the dump into a scratch database and run `pnpm db:migrate` there first.

## 2. Migrate

```bash
pnpm db:migrate
```

What changes:

| Provider (`provider` column / `paymentProvider` in the snapshot) | Old unit                              | Conversion                                                                   |
| ---------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------- |
| `polar`                                                          | integer cents                         | none, already minor units                                                    |
| `mercadopago`                                                    | decimal major units (`4500` = $ 4500) | multiplied by 10^decimals of the row's currency, rounded half away from zero |
| anything else                                                    | unknown                               | left as it is                                                                |

The decimals per currency are the ones `currencyDecimals()` returns (`Intl`): UYU, USD, EUR 2; JPY, CLP,
COP 0; KWD 3. The migration lists the currencies that do not have 2 decimals in its SQL, and a test
checks that list against `Intl` for every currency.

Pending Plan changes of every status (`pending`, `failed`, `activated`, `canceled`) are converted, because
the admin pages also list the history.

The conversion runs only while `plan.price` is still `numeric`. Running the file a second time does not
convert twice.

## 3. Check

```sql
-- Polar: unchanged. Mercado Pago: 100x for 2-decimal currencies.
SELECT id, provider, currency, price FROM plan ORDER BY provider, display_order;

-- Snapshots follow their plan.
SELECT id, status, target_plan_snapshot -> 'price' AS price FROM pending_plan_change;
```

If a Mercado Pago price now shows `450000` for a plan that used to be `4500`, that is correct: it is
4500.00 in centésimos.

## 4. Seeds

`pnpm tsx packages/db/scripts/seed-plan-catalog.ts <provider>` and the demo seed now write minor units for
both providers. Polar plans are US$ cents. Mercado Pago demo plans are whole units of `DEFAULT_CURRENCY`
converted to its minor units.
