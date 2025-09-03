/**
 * @buncn/payments - Polar payment integration for Vitro
 * 
 * This package provides a complete payment and subscription management
 * solution integrated with Polar and Better Auth.
 */

// Core types
export type * from "./src/types/index.ts";

// Constants and configuration
export * from "./src/constants/index.ts";

// Shared utilities (available in both server and client)
export * from "./src/utils/index.ts";

// Re-export server and client modules for selective imports
// Use these for specific imports to avoid bundling unnecessary code

/**
 * Server-side utilities
 * Import with: import { ... } from "@buncn/payments/server"
 */
export * as server from "./src/server/index.ts";

/**
 * Client-side utilities and React hooks
 * Import with: import { ... } from "@buncn/payments/client"
 */
export * as client from "./src/client/index.ts";

/**
 * Quick setup function for Better Auth integration
 */
export { setupPolarForBetterAuth } from "./src/server/polar-config.ts";

/**
 * Main validation functions (commonly used)
 */
export { 
  validateMembership,
  hasPermission,
  validateMembershipTier,
  validateTierChange,
} from "./src/utils/index.ts";

/**
 * Package version
 */
export const VERSION = "1.0.0";

/**
 * Package metadata
 */
export const PACKAGE_INFO = {
  name: "@buncn/payments",
  version: VERSION,
  description: "Polar payment integration for Vitro monorepo",
  author: "Vitro Team",
} as const;