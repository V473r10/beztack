# Payment Orchestrator Memory

- Mercado Pago provider boundary: `MERCADO_PAGO_APPLICATION_ID` is required; adapter/projection must fail closed when `application_id` is missing or mismatched. See `docs/adr/0003-native-payment-integration-boundaries.md`.
- Mercado Pago subscription ownership metadata is carried in `external_reference` using `packages/payments/mercado-pago/src/helpers/external-reference.ts` (`beztack_uid=...`, optional `org`, `tier`, `ref`, proration fields). Standard checkout creates a pending `/preapproval` subscription and returns its `init_point`.
- Mercado Pago redirect checkout must create no-associated-plan pending `/preapproval` from the selected plan terms; core/provider code must force `targetPlanId` from `CreateCheckoutOptions.productId` after spreading caller metadata so app/client metadata cannot override the selected plan.
- Core payment entry point is `@beztack/payments` (`packages/payments/core/src/factory.ts`); apps should not import provider packages directly except through reviewed compatibility seams.
