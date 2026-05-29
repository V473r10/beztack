# Beztack

Beztack is a TypeScript product starter with built-in payment, subscription, membership, and template-sync flows. This context captures project-specific domain language.

## Language

**Subscription projection**:
The local interpretation of payment-provider events as current subscription and membership state. It is the source of what the product believes about paid access after a provider event is processed.
_Avoid_: webhook handler, payment sync, denormalization

**Membership target**:
The User or Organization that receives paid access from a Subscription. A Subscription belongs to exactly one Membership target.
_Avoid_: both User and Organization, denormalization target
