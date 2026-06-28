# Beztack Context

Beztack is a TypeScript monorepo starter with a subscription-oriented payment flow. This context records project-specific domain language that should stay consistent across architecture work.

## Language

### Template Sync

**Template source**:
The Beztack project that defines reusable platform behavior for Derived projects.
_Avoid_: upstream repo, parent repo, canonical branch

**Template version**:
A published Template source version that a Derived project may accept through template sync. Template version semantics describe expected sync impact on Derived projects.
_Avoid_: apply count, sync run number, local version

**Sync engine version**:
The version of the tool that planned or applied template sync, recorded separately from the Template version.
_Avoid_: template version, Beztack version, platform version

**Template revision**:
A verifiable Template source state, usually a Git tag or commit, used as the primary baseline for template sync.
_Avoid_: hash list, generated snapshot, local cache

**Template parameter**:
A persisted Derived project value used to render Template source content during scaffolding and later template sync.
_Avoid_: diff normalization, string substitution, local branding patch

**Template migration**:
A declared Template version step that changes Derived project state beyond applying file content.
_Avoid_: release note, postinstall script, manual fix

**Derived project**:
A product project created from the Template source that may receive template updates while preserving product-specific ownership.
_Avoid_: downstream, fork, child repo

**Product domain**:
The Derived project-owned business behavior that is not part of the reusable Template source.
_Avoid_: custom code, downstream logic, app-specific stuff

**Derived project ID**:
An opaque stable identifier generated when a Derived project is created and used for sync traceability.
_Avoid_: repository name, package name, remote URL

**Trusted Derived project**:
A Derived project controlled by the Beztack maintainer organization whose Promotions may be prepared by trusted automation but still require review before entering the Template source.
_Avoid_: internal downstream, official fork

**Community Derived project**:
A Derived project outside the Beztack maintainer trust boundary whose Promotions are treated as untrusted external contributions.
_Avoid_: user fork, third-party downstream

**Sync policy**:
The declared ownership rules that decide which project is allowed to change each part of a Derived project during template sync.
_Avoid_: manifest, config, sync settings

**Ownership note**:
A human-readable explanation attached to Sync policy that records why a path is owned or excluded without changing sync behavior.
_Avoid_: custom zone, zone policy, merge rule

**Sync seam**:
An explicit extension point where a Derived project can add product-specific behavior without editing Template source-owned code.
_Avoid_: zone marker, local patch, override block

**Environment contract**:
The Template source-owned set of required environment variables, meanings, and platform defaults that Derived projects must satisfy.
_Avoid_: `.env.example`, local env file, deployment secret list

**Sync conflict**:
A template sync state where Template source changes and Derived project changes cannot be safely combined without an explicit ownership or design decision.
_Avoid_: merge error, failed apply, broken sync

**Sync state**:
The current machine-readable template sync status of a Derived project.
_Avoid_: manifest, origin file, report

**Sync event log**:
The append-only audit trail of template sync actions and Promotions for a Derived project.
_Avoid_: sync state, changelog, report

**Origin baseline**:
The Template revision a Derived project last accepted for sync comparison, with optional file metadata for drift detection and offline work.
_Avoid_: source of truth, lockfile, sync database

**Baseline reset**:
An explicit acceptance of the current Derived project state as the new Origin baseline after review.
_Avoid_: origin rebuild, hash fix, cleanup

**Promotion**:
An opt-in proposal to move a validated change from a Derived project back into the Template source.
_Avoid_: reverse sync, upstream sync, backport

**Promotion candidate**:
A Derived project change that is eligible to be proposed as a Promotion because it belongs to Template source ownership or to unprotected parts of mixed ownership.
_Avoid_: useful downstream change, upstreamable change

**Platform extraction**:
The design of reusable Template source behavior inspired by a Product domain change without copying product-owned behavior directly.
_Avoid_: promotion, upstream copy, generalization by copy-paste

**Promotion label**:
The PR label on a Derived project change that explicitly opts the change into Promotion consideration.
_Avoid_: branch name, commit prefix, issue label

### Subscription Billing

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

**Admin tier override**:
A Membership state selected by an App admin to exercise a Subscription tier without a customer Subscription or Payment. An Admin tier override applies to the same Membership target as a normal Subscription, takes precedence over real Subscription-derived Membership while present, and leaves real Subscriptions untouched.
An Admin tier override may target Free, includes Billing cadence for paid tiers, is visible only to App admins, and persists until explicitly cleared; non-App-admins experience only the resulting Membership.
_Avoid_: test subscription, comped subscription, free checkout

**Billing manager**:
An organization member whose role is allowed to manage the organization's Subscription. Billing managers may perform organization Plan changes; app admins may override, and payer email alone does not establish that a Subscription belongs to an organization.
_Avoid_: owner-only billing user, any member

**Payment**:
A provider-confirmed charge or attempted charge for a Subscription. Payment confirmation is the evidence Beztack uses before moving Membership up on an Upgrade.
_Avoid_: payment intent, checkout attempt

## Example Dialogue

Developer: "Does this route start a checkout or perform a Plan change?"

Domain expert: "If there is an active Subscription and the customer moves to another plan or Billing cadence, call it a Plan change. Checkout is only the provider work needed to complete that change. If only the Billing cadence changes, call that a Cadence change. Use the Pricing catalog to decide whether a tier move is an Upgrade or Downgrade. An Upgrade first Payment credits unused value from the current paid period; a Downgrade keeps current Membership through that paid period."

Developer: "Should we call the App admin production testing path a free subscription?"

Domain expert: "No. Call it an Admin tier override. It changes effective Membership for App admin testing, but it is not a Subscription, Payment, or checkout bypass visible to customers."
