/**
 * All available permissions in the system
 */
export const PERMISSIONS = {
  // Authentication permissions
  AUTH_BASIC: "auth:basic",
  AUTH_2FA: "auth:2fa", 
  AUTH_PASSKEYS: "auth:passkeys",

  // Dashboard permissions
  DASHBOARD_VIEW: "dashboard:view",
  DASHBOARD_ANALYTICS: "dashboard:analytics",

  // Profile permissions
  PROFILE_MANAGE: "profile:manage",

  // API permissions
  API_ACCESS: "api:access",

  // Data permissions
  DATA_EXPORT: "data:export",

  // Organization permissions
  ORG_MANAGE: "org:manage",
  ORG_INVITE: "org:invite",

  // Team permissions
  TEAM_MANAGE: "team:manage",
  TEAM_ANALYTICS: "team:analytics",

  // Enterprise permissions
  ENTERPRISE_FEATURES: "enterprise:features",
  ENTERPRISE_SUPPORT: "enterprise:support",

  // Audit permissions
  AUDIT_VIEW: "audit:view",

  // Security permissions
  SECURITY_ADVANCED: "security:advanced",
} as const;

/**
 * Permission categories for organization
 */
export const PERMISSION_CATEGORIES = {
  AUTHENTICATION: [
    PERMISSIONS.AUTH_BASIC,
    PERMISSIONS.AUTH_2FA,
    PERMISSIONS.AUTH_PASSKEYS,
  ],
  DASHBOARD: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.DASHBOARD_ANALYTICS,
  ],
  PROFILE: [
    PERMISSIONS.PROFILE_MANAGE,
  ],
  API: [
    PERMISSIONS.API_ACCESS,
  ],
  DATA: [
    PERMISSIONS.DATA_EXPORT,
  ],
  ORGANIZATION: [
    PERMISSIONS.ORG_MANAGE,
    PERMISSIONS.ORG_INVITE,
  ],
  TEAM: [
    PERMISSIONS.TEAM_MANAGE,
    PERMISSIONS.TEAM_ANALYTICS,
  ],
  ENTERPRISE: [
    PERMISSIONS.ENTERPRISE_FEATURES,
    PERMISSIONS.ENTERPRISE_SUPPORT,
  ],
  AUDIT: [
    PERMISSIONS.AUDIT_VIEW,
  ],
  SECURITY: [
    PERMISSIONS.SECURITY_ADVANCED,
  ],
} as const;

/**
 * Permission descriptions for UI display
 */
export const PERMISSION_DESCRIPTIONS = {
  [PERMISSIONS.AUTH_BASIC]: "Basic email/password and social authentication",
  [PERMISSIONS.AUTH_2FA]: "Two-factor authentication support",
  [PERMISSIONS.AUTH_PASSKEYS]: "Passwordless authentication with passkeys",
  [PERMISSIONS.DASHBOARD_VIEW]: "Access to main dashboard",
  [PERMISSIONS.DASHBOARD_ANALYTICS]: "View advanced analytics and insights",
  [PERMISSIONS.PROFILE_MANAGE]: "Manage user profile and settings",
  [PERMISSIONS.API_ACCESS]: "Access to API endpoints",
  [PERMISSIONS.DATA_EXPORT]: "Export user data and analytics",
  [PERMISSIONS.ORG_MANAGE]: "Create and manage organizations",
  [PERMISSIONS.ORG_INVITE]: "Invite users to organizations",
  [PERMISSIONS.TEAM_MANAGE]: "Create and manage teams within organizations",
  [PERMISSIONS.TEAM_ANALYTICS]: "View team analytics and performance",
  [PERMISSIONS.ENTERPRISE_FEATURES]: "Access to custom enterprise features",
  [PERMISSIONS.ENTERPRISE_SUPPORT]: "Dedicated enterprise support",
  [PERMISSIONS.AUDIT_VIEW]: "View audit logs and security events",
  [PERMISSIONS.SECURITY_ADVANCED]: "Advanced security features and controls",
} as const;

/**
 * Get all permissions as an array
 */
export function getAllPermissions(): readonly string[] {
  return Object.values(PERMISSIONS);
}

/**
 * Get permissions by category
 */
export function getPermissionsByCategory(category: keyof typeof PERMISSION_CATEGORIES): readonly string[] {
  return PERMISSION_CATEGORIES[category];
}

/**
 * Check if a permission is valid
 */
export function isValidPermission(permission: string): permission is typeof PERMISSIONS[keyof typeof PERMISSIONS] {
  return Object.values(PERMISSIONS).includes(permission as any);
}

/**
 * Get permission description
 */
export function getPermissionDescription(permission: string): string | undefined {
  return PERMISSION_DESCRIPTIONS[permission as keyof typeof PERMISSION_DESCRIPTIONS];
}