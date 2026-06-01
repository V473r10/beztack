# Beztack Context

Beztack is a TypeScript monorepo starter with a subscription-oriented payment flow. This context records project-specific domain language that should stay consistent across architecture work.

## Language

**Plan change**:
A change from one active Subscription plan to another, including tier changes and Billing cadence changes. A Plan change requires a different tier or Billing cadence; a same-tier, same-cadence request is not a Plan change.
_Avoid_: upgrade flow, downgrade flow, subscription workflow

**Plan change preview**:
An authoritative dry run of a Plan change using the same classification and pricing rules as acceptance. A Plan change preview returns direction, effective timing, and first Payment amount without changing provider or Beztack state.
_Avoid_: estimate, UI helper

**Billing cadence**:
How often a Subscription renews or charges, such as weekly, bi-weekly, monthly, bi-monthly, or yearly. The canonical meaning is every N time units; display labels are not the source of truth.
_Avoid_: billing period, recurring interval

**Cadence change**:
A Plan change where the Subscription tier stays the same and only the Billing cadence changes. A Cadence change is not an upgrade or downgrade, even if the charge amount changes, and the new Billing cadence starts at the next renewal.
_Avoid_: period change, same-plan upgrade, same-plan downgrade

**Pricing catalog**:
The Beztack-owned catalog of Subscription plans, including canonical tier identity, tier rank, Billing cadence choices, prices, features, limits, and permissions. Plan change classification uses the Pricing catalog rather than provider price alone.
_Avoid_: provider products, product list

**Payment integration**:
A provider-native application or credential boundary used to isolate Subscriptions. A Merchant may have many Payment integrations, and each Subscription belongs to exactly one Payment integration.
_Avoid_: integration, Beztack namespace, Mercado Pago integrator ID

**Mercado Pago Application**:
The Mercado Pago-native Payment integration boundary. Subscriptions from one Mercado Pago Application must not be visible or manageable through another Mercado Pago Application, and the Mercado Pago Application is not the Mercado Pago integrator ID.
_Avoid_: Mercado Pago integrator ID, merchant account, provider app

**Payment provider**:
An external payment platform used by Beztack, such as Polar, Mercado Pago, or Creem. Payment provider is not the same as Payment integration; a Payment provider can serve many Payment integrations.
_Avoid_: provider, merchant, integration

**Merchant**:
The seller account at a Payment provider that receives payments. A Merchant may run multiple Payment integrations that must not expose each other's Subscriptions.
_Avoid_: integration, customer, subscription owner

**Downgrade**:
A Plan change to a lower-ranked Subscription tier in the Pricing catalog. Membership and the target Billing cadence stay at the current tier until the already-paid Subscription period ends.
_Avoid_: downgrade flow

**Pending Plan change**:
A Plan change accepted by Beztack but not yet effective because the current paid Subscription period has not ended. Downgrades and Cadence changes wait as Pending Plan changes until renewal; accepted means the target terms are provider-confirmed and stored by Beztack. A Subscription has at most one Pending Plan change, a new accepted Pending Plan change replaces the previous one, the customer may cancel it before renewal, activation uses the confirmed target snapshot, and cancellation or failure of the Current Subscription cancels the pending change.
_Avoid_: provider trial, pending subscription

**Provider-confirmed Plan change**:
A Plan change whose target terms have been accepted by the payment provider. Provider-confirmed does not mean accepted by Beztack until the Pending Plan change is stored, and it carries stable Plan change facts for reconciliation.
_Avoid_: accepted plan change, completed plan change

**Reconciling Plan change**:
A Provider-confirmed Plan change that Beztack has not yet accepted or applied. Users should be told that Payment is confirmed and Beztack is still working on the Plan change. Reconciliation first tries to store the missing Pending Plan change from provider metadata.
_Avoid_: processing, unknown state

**Upgrade**:
A Plan change to a higher-ranked Subscription tier in the Pricing catalog. Membership and the target Billing cadence move only after Payment is confirmed; the first Payment is the target Billing cadence price minus unused value from the current paid period.
_Avoid_: upgrade flow

**Subscription**:
A recurring customer entitlement tracked through a payment provider and cached in Beztack for Membership decisions. A Subscription belongs to exactly one Payment integration and either a user or an organization depending on subscription mode.
_Avoid_: preapproval, recurring checkout

**Current Subscription**:
The Subscription currently projected by Beztack as effective for Membership decisions. Provider Subscriptions created for Pending Plan changes are not the Current Subscription before renewal.
_Avoid_: first active provider subscription, selected subscription id

**Subscription owner**:
The user who owns the Current Subscription in user subscription mode within the Subscription's Payment integration. The Subscription owner may perform user-mode Plan changes; app admins may override, and provider payer email alone does not establish ownership.
_Avoid_: customer email match, provider payer

**Subscription projection**:
The Beztack process that turns provider Subscription and Payment evidence into cached Membership state. Subscription projection applies Pending Plan changes at renewal.
_Avoid_: webhook handler, subscription sync

**Membership**:
The effective access state derived from a Subscription, including tier, active status, benefits, limits, and organization scope.
_Avoid_: access level, entitlement state

**App admin**:
A system-level superuser (typically a developer or staff member) identified via environment configuration rather than standard database roles. App admins have global access to internal tools (like the plan-sync UI) and can override Subscription owner and Billing manager rules.
_Avoid_: sudo, superuser, system admin

**Billing manager**:
An organization member whose role is allowed to manage the organization's Subscription. Billing managers may perform organization Plan changes; app admins may override, and payer email alone does not establish that a Subscription belongs to an organization.
_Avoid_: owner-only billing user, any member

**Payment**:
A provider-confirmed charge or attempted charge for a Subscription. Payment confirmation is the evidence Beztack uses before moving Membership up on an Upgrade.
_Avoid_: payment intent, checkout attempt

## Example Dialogue

Developer: "Does this route start a checkout or perform a Plan change?"

Domain expert: "If there is an active Subscription and the customer moves to another plan or Billing cadence, call it a Plan change. Checkout is only the provider work needed to complete that change. If only the Billing cadence changes, call that a Cadence change. Use the Pricing catalog to decide whether a tier move is an Upgrade or Downgrade. An Upgrade first Payment credits unused value from the current paid period; a Downgrade keeps current Membership through that paid period."
