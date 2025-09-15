/**
 * All available permissions in the system
 */
export declare const PERMISSIONS: {
    readonly AUTH_BASIC: "auth:basic";
    readonly AUTH_2FA: "auth:2fa";
    readonly AUTH_PASSKEYS: "auth:passkeys";
    readonly DASHBOARD_VIEW: "dashboard:view";
    readonly DASHBOARD_ANALYTICS: "dashboard:analytics";
    readonly PROFILE_MANAGE: "profile:manage";
    readonly API_ACCESS: "api:access";
    readonly DATA_EXPORT: "data:export";
    readonly ORG_MANAGE: "org:manage";
    readonly ORG_INVITE: "org:invite";
    readonly TEAM_MANAGE: "team:manage";
    readonly TEAM_ANALYTICS: "team:analytics";
    readonly ENTERPRISE_FEATURES: "enterprise:features";
    readonly ENTERPRISE_SUPPORT: "enterprise:support";
    readonly AUDIT_VIEW: "audit:view";
    readonly SECURITY_ADVANCED: "security:advanced";
};
/**
 * Permission categories for organization
 */
export declare const PERMISSION_CATEGORIES: {
    readonly AUTHENTICATION: readonly ["auth:basic", "auth:2fa", "auth:passkeys"];
    readonly DASHBOARD: readonly ["dashboard:view", "dashboard:analytics"];
    readonly PROFILE: readonly ["profile:manage"];
    readonly API: readonly ["api:access"];
    readonly DATA: readonly ["data:export"];
    readonly ORGANIZATION: readonly ["org:manage", "org:invite"];
    readonly TEAM: readonly ["team:manage", "team:analytics"];
    readonly ENTERPRISE: readonly ["enterprise:features", "enterprise:support"];
    readonly AUDIT: readonly ["audit:view"];
    readonly SECURITY: readonly ["security:advanced"];
};
/**
 * Permission descriptions for UI display
 */
export declare const PERMISSION_DESCRIPTIONS: {
    readonly "auth:basic": "Basic email/password and social authentication";
    readonly "auth:2fa": "Two-factor authentication support";
    readonly "auth:passkeys": "Passwordless authentication with passkeys";
    readonly "dashboard:view": "Access to main dashboard";
    readonly "dashboard:analytics": "View advanced analytics and insights";
    readonly "profile:manage": "Manage user profile and settings";
    readonly "api:access": "Access to API endpoints";
    readonly "data:export": "Export user data and analytics";
    readonly "org:manage": "Create and manage organizations";
    readonly "org:invite": "Invite users to organizations";
    readonly "team:manage": "Create and manage teams within organizations";
    readonly "team:analytics": "View team analytics and performance";
    readonly "enterprise:features": "Access to custom enterprise features";
    readonly "enterprise:support": "Dedicated enterprise support";
    readonly "audit:view": "View audit logs and security events";
    readonly "security:advanced": "Advanced security features and controls";
};
/**
 * Get all permissions as an array
 */
export declare function getAllPermissions(): readonly string[];
/**
 * Get permissions by category
 */
export declare function getPermissionsByCategory(category: keyof typeof PERMISSION_CATEGORIES): readonly string[];
/**
 * Check if a permission is valid
 */
export declare function isValidPermission(permission: string): permission is (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
/**
 * Get permission description
 */
export declare function getPermissionDescription(permission: string): string | undefined;
