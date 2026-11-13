# Prices are integer minor units with an ISO 4217 currency code

Every price Beztack stores or computes is an integer amount in the currency's minor unit plus an ISO 4217 currency code: `900 USD` is US$ 9.00, `900 JPY` is ¥ 900 and `9000 KWD` is KWD 9.000. This applies to `plan.price`, to `payment.amount`, to `targetPlanSnapshot.price` and to every Plan change calculation (credit, proration), so domain logic only adds and subtracts integers and never rounds by accident. The number of decimals of a currency comes from a fixed ISO 4217 minor-unit table in `@beztack/payments/money` (the `CcyMnrUnts` field of the ISO 4217 "List one" kept by [SIX](https://www.six-group.com/en/products-services/financial-information/data-center/iso-currency.html), published 2026-09-17), not from the runtime's `Intl` data. We first relied on `Intl`, and dropped it: its CLDR data differs between Node versions and browsers (some builds give COP, HUF, IDR, PKR and ALL no decimals, ISO 4217 gives them 2), so the API, the UI and the database migration could disagree and show a price 100x off. `Intl` still formats, but it is told the table's decimals (`minimumFractionDigits` and `maximumFractionDigits`). A code that is not in the table throws a clear error; withdrawn codes (SLL, HRK, ZWL) are unknown. Funds codes are in the table (CLF and UYW have 4 decimals). We rejected decimal major units (`9.00`) as the stored form because they reintroduce floating point error in every sum, and rejected keeping an implicit "cents" convention because it silently breaks for currencies that do not have two decimals (JPY and CLP have none, KWD has three).

## Where the helpers live

The helpers are in `@beztack/payments`, under the browser-safe subpath `@beztack/payments/money` (`packages/payments/core/src/money.ts`). We picked it because it is the only package that the API, the UI and both payment adapters (`@beztack/payments-polar`, `@beztack/mercadopago`) already depend on, and it already has a precedent for a dependency-free entry point shared by API and UI (`@beztack/payments/subscription`). A subpath keeps the UI from bundling the provider factory. `@beztack/env` was rejected because it is configuration, not domain logic, and `@beztack/db` because the UI does not import it.

The module exports `currencyDecimals`, `minorToMajor`, `majorToMinor`, `formatMinorUnits` and the table itself (`ISO_4217_MINOR_UNITS`), plus the `Money` and `MoneyRounding` types. The migration `0009_prices_minor_units.sql` carries the same table, because SQL cannot import it, and a database test fails when the two differ, so they cannot silently disagree. When ISO 4217 changes, update both. `majorToMinor` requires an explicit rounding mode (`half-away-from-zero`, `floor` or `ceil`); there is no default because the right choice differs between a price the customer pays and a credit we owe them. `formatMinorUnits` takes the locale of the language the user chose, so the same amount reads naturally in English and Spanish.

## Conversion happens at the edge of each adapter

A payment adapter is the only place that knows its provider's format, and it converts there, once, in both directions:

- **Polar** already uses integer amounts in the currency's minor unit (cents for USD). The adapter passes amounts through with no conversion. Before this change the adapter converted dollars to cents, so a Polar plan row written by the admin create, import or Plan Sync holds major units (`9.99`), while a row written by the seed holds cents (`900`). Migration `0009` tells them apart by the id: `polar_<tier>_<month|year>` is the seed's pattern and stays as it is; any other Polar row is multiplied by 10^decimals (rounded half away from zero) before the cast to integer. The migration never truncates: a price that still has decimals after the conversion stops it.
- **Mercado Pago** uses decimal major units (`9.99`). Its adapter calls `minorToMajor` when sending a price and `majorToMinor` when reading one, with an explicit rounding mode.
- **Stripe** (no adapter yet) uses integer minor units, but its list of zero-decimal and special-case currencies does not fully match ISO 4217 (HUF, TWD, ISK and UGX are the known cases). A Stripe adapter must carry its own table of exceptions and translate at its boundary.

Callers outside an adapter never see a provider format: they pass and receive `{ amount, currency }` in minor units.

## Risk: converting twice

The main risk is converting an amount twice (for example multiplying by 100 a value that is already in cents), which is the existing bug that shows Basic as "$900.00" instead of "$9.00". Mitigation: only adapters convert, domain code and UI never multiply or divide by 100 by hand, and each boundary has tests with USD (2 decimals), JPY (0) and KWD (3) so a wrong factor fails visibly.

## Rollout: expand, migrate, contract

1. **Expand** (this change): add the ADR and the helpers next to the existing convention. No existing consumer changes.
2. **Migrate**: move each consumer and adapter to the new contract. `plan.price` and `payment.amount` become integer columns and existing rows and stored Pending Plan change snapshots are converted, with a documented database backup before the migration.
3. **Contract** (done): the old convention is gone. No reader converts a stored price back to a provider unit; the API, the payment adapters and the UI all read minor units. The UI's `formatPrice` takes minor units plus a currency code and formats with the active language. The one place outside an adapter that still sees a provider's decimals is `formatMercadoPagoAmount` in `apps/ui/src/lib/format.ts`, for raw Mercado Pago payloads (subscription details and webhook events) that the UI shows without going through Beztack's own price contract.
