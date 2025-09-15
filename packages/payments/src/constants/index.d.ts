export { getAllPermissions, getPermissionDescription, getPermissionsByCategory, isValidPermission, PERMISSION_CATEGORIES, PERMISSION_DESCRIPTIONS, PERMISSIONS, } from "./permissions.ts";
/**
 * Polar configuration constants
 */
export declare const POLAR_CONFIG: {
    readonly WEBHOOK_PATH: "/polar/webhooks";
    readonly CHECKOUT_PATH: "/polar/checkout";
    readonly PORTAL_PATH: "/polar/portal";
    readonly SUCCESS_URL: "/billing/success";
    readonly CANCEL_URL: "/billing/canceled";
};
/**
 * Billing configuration constants
 */
export declare const BILLING_CONFIG: {
    readonly CURRENCY: "USD";
    readonly DEFAULT_TRIAL_DAYS: 14;
    readonly GRACE_PERIOD_DAYS: 7;
    readonly INVOICE_DUE_DAYS: 7;
    readonly MAX_FAILED_CHARGES: 3;
};
/**
 * Usage tracking constants
 */
export declare const USAGE_EVENTS: {
    readonly API_CALL: "api_call";
    readonly STORAGE_UPLOAD: "storage_upload";
    readonly USER_INVITE: "user_invite";
    readonly ORGANIZATION_CREATE: "organization_create";
    readonly TEAM_CREATE: "team_create";
};
/**
 * Subscription change types
 */
export declare const SUBSCRIPTION_CHANGE_TYPES: {
    readonly UPGRADE: "upgrade";
    readonly DOWNGRADE: "downgrade";
    readonly CANCEL: "cancel";
    readonly REACTIVATE: "reactivate";
    readonly CHANGE_BILLING_PERIOD: "change_billing_period";
};
/**
 * Membership tiers
 */
export declare const MEMBERSHIP_TIERS: {
    readonly FREE: "free";
    readonly PRO: "pro";
    readonly TEAM: "team";
    readonly ENTERPRISE: "enterprise";
};
