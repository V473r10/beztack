# Beztack owns Pending Plan change state

Pending Plan changes are stored by Beztack instead of treating provider pending Subscriptions or trials as the source of truth. This extends ADR-0001: provider state remains authoritative for Payment and Subscription evidence, while Beztack owns the future effective timing, replacement, cancellation, and renewal activation of Downgrades and Cadence changes so the Plan change Module has one testable Interface and provider differences stay behind narrow Adapters.

Rejected alternatives were provider-native scheduling and provider pending Subscriptions. Both would make Polar and Mercado Pago semantics leak across the Plan change seam and would make Membership timing depend on provider-specific behaviour rather than the confirmed target snapshot recorded by Beztack.
