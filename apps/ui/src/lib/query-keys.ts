/**
 * The single owner of every TanStack Query key used in `apps/ui`.
 *
 * Why this module exists: before it, a hook that needed to invalidate another
 * hook's query had to copy that hook's private key literal by hand. Forgetting
 * a copy is a silent failure: the mutation succeeds server-side and the screen
 * stays stale. With every key behind a builder, renaming one is a compile error
 * instead. Pattern ported from lncd `apps/ui/src/lib/query-keys.ts`.
 *
 * Rules for editing this file:
 *
 * 1. A key's serialized value is a cache contract. Changing the array a builder
 *    returns orphans every cache entry stored under the old value, so treat a
 *    value change as a behaviour change and call it out in review.
 * 2. `all()` returns the PREFIX that TanStack matches partially, so
 *    `invalidateQueries({ queryKey: queryKeys.subscriptions.all() })`
 *    invalidates every key below it. A builder whose root differs from its
 *    family's root is NOT covered by that family's `all()`; those cases are
 *    commented where they occur.
 * 3. Data that belongs to an Organization is keyed by the organization id, so
 *    switching the Active organization never serves the previous one's cache.
 * 4. Builders are pure and dependency-free. They take primitives, never domain
 *    types, so this module never imports from a feature.
 */

// =============================================================================
// Organizations
//
// These come from better-auth's client and each one is its own flat root
// (`organizations`, `activeOrganization`, `teamMembers`, ...). They are grouped
// here for discoverability, NOT nested under a shared prefix, because nesting
// them would change every serialized value.
// =============================================================================

export const organizationKeys = {
  list: () => ["organizations"] as const,
  active: () => ["activeOrganization"] as const,
  members: (organizationId?: string) => ["organizationMembers", organizationId] as const,
  invitations: (organizationId?: string) => ["organizationInvitations", organizationId] as const,
  /** Prefix of every organization's invitation list, for callers that only
   * hold an invitation id. */
  allInvitations: () => ["organizationInvitations"] as const,
  userInvitations: () => ["userInvitations"] as const,
  teams: (organizationId?: string) => ["teams", organizationId] as const,
  teamMembers: (teamId?: string) => ["teamMembers", teamId] as const,
} as const;

// =============================================================================
// Subscriptions and billing
// =============================================================================

const SUBSCRIPTIONS_ROOT = ["subscriptions"] as const;

export const subscriptionKeys = {
  all: () => SUBSCRIPTIONS_ROOT,
  /** `organizationId` is absent in user subscription mode. */
  list: (organizationId?: string) => [...SUBSCRIPTIONS_ROOT, "list", organizationId] as const,
  membership: (organizationId?: string) =>
    [...SUBSCRIPTIONS_ROOT, "membership", organizationId] as const,
  products: () => [...SUBSCRIPTIONS_ROOT, "products"] as const,
  productTiers: () => [...SUBSCRIPTIONS_ROOT, "products", "tiers"] as const,
  /** Scoped by the Current Subscription, which already belongs to one
   * organization, so a preview never crosses organizations. */
  planChangePreview: (subscriptionId?: string, targetTierId?: string, billingPeriod?: string) =>
    [
      ...SUBSCRIPTIONS_ROOT,
      "plan-change-preview",
      subscriptionId,
      targetTierId,
      billingPeriod,
    ] as const,
  /** Own root (`subscription-details`), keyed by the provider preapproval id,
   * which a caller may still hold as `null` before one is resolved. */
  details: (preapprovalId?: string | null) => ["subscription-details", preapprovalId] as const,
} as const;

/** Own root (`products`), distinct from `subscriptionKeys.products()`. */
export const productKeys = {
  all: () => ["products"] as const,
} as const;

// =============================================================================
// Account
// =============================================================================

export const userSessionKeys = {
  all: () => ["user-session"] as const,
} as const;

// =============================================================================
// Admin
// =============================================================================

const ADMIN_ROOT = ["admin"] as const;

export const adminKeys = {
  all: () => ADMIN_ROOT,
  stats: () => [...ADMIN_ROOT, "stats"] as const,
  userStats: () => [...ADMIN_ROOT, "user-stats"] as const,
  recentActivity: () => [...ADMIN_ROOT, "recent-activity"] as const,
  growth: () => [...ADMIN_ROOT, "analytics", "growth"] as const,
  systemMetrics: () => [...ADMIN_ROOT, "system-metrics"] as const,
  /** `query` is the admin user-list filter object, compared structurally. */
  users: (query?: unknown) => [...ADMIN_ROOT, "users", query] as const,
  userSessions: (userId: string) => [...ADMIN_ROOT, "user", userId, "sessions"] as const,
  /** Own root (`admin-plans-sync`), not matched by `adminKeys.all()`. */
  plansSync: () => ["admin-plans-sync"] as const,
} as const;

// =============================================================================
// AI
// =============================================================================

export const aiKeys = {
  all: () => ["ai"] as const,
} as const;

/**
 * One namespace so a caller can reach any family without importing each
 * symbol. The individual exports above stay available for narrow imports.
 */
export const queryKeys = {
  admin: adminKeys,
  ai: aiKeys,
  organizations: organizationKeys,
  products: productKeys,
  subscriptions: subscriptionKeys,
  userSession: userSessionKeys,
} as const;
