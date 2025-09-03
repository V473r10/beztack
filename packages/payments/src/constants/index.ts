// Tier constants
export {
  MEMBERSHIP_TIERS,
  TIER_HIERARCHY,
  getTierConfig,
  getAllTiers,
  isValidTier,
  getTierLevel,
  isTierHigher,
} from "./tiers.ts";

// Permission constants
export {
  PERMISSIONS,
  PERMISSION_CATEGORIES,
  PERMISSION_DESCRIPTIONS,
  getAllPermissions,
  getPermissionsByCategory,
  isValidPermission,
  getPermissionDescription,
} from "./permissions.ts";

/**
 * Polar configuration constants
 */
export const POLAR_CONFIG = {
  WEBHOOK_PATH: "/polar/webhooks",
  CHECKOUT_PATH: "/polar/checkout",
  PORTAL_PATH: "/polar/portal",
  SUCCESS_URL: "/billing/success",
  CANCEL_URL: "/billing/canceled",
} as const;

/**
 * Billing configuration constants
 */
export const BILLING_CONFIG = {
  CURRENCY: "USD",
  DEFAULT_TRIAL_DAYS: 14,
  GRACE_PERIOD_DAYS: 7,
  INVOICE_DUE_DAYS: 7,
  MAX_FAILED_CHARGES: 3,
} as const;

/**
 * Usage tracking constants
 */
export const USAGE_EVENTS = {
  API_CALL: "api_call",
  STORAGE_UPLOAD: "storage_upload",
  USER_INVITE: "user_invite",
  ORGANIZATION_CREATE: "organization_create",
  TEAM_CREATE: "team_create",
} as const;

/**
 * Subscription change types
 */
export const SUBSCRIPTION_CHANGE_TYPES = {
  UPGRADE: "upgrade",
  DOWNGRADE: "downgrade",
  CANCEL: "cancel",
  REACTIVATE: "reactivate",
  CHANGE_BILLING_PERIOD: "change_billing_period",
} as const;