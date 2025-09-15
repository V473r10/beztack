/**
 * @nvn/payments - Polar payment integration for nvn
 *
 * This package provides a complete payment and subscription management
 * solution integrated with Polar and Better Auth.
 */
/** biome-ignore-all lint/performance/noBarrelFile: main exports */

// Constants and configuration
export * from "./src/constants/index.ts";
// Core types
export type * from "./src/types/index.ts";

// Shared utilities (available in both server and client)
export * from "./src/utils/index.ts";

// Re-export server and client modules for selective imports
// Use these for specific imports to avoid bundling unnecessary code

/**
 * Client-side utilities and React hooks
 * Import with: import { ... } from "@nvn/payments/client"
 */
export * as client from "./src/client/index.ts";
/**
 * Server-side utilities
 * Import with: import { ... } from "@nvn/payments/server"
 */
export * as server from "./src/server/index.ts";

/**
 * Quick setup function for Better Auth integration
 */
export { setupPolarForBetterAuth } from "./src/server/polar-config.ts";

/**
 * Main validation functions (commonly used)
 */
export {
  hasPermission,
  validateMembership,
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
  name: "@nvn/payments",
  version: VERSION,
  description: "Polar payment integration for nvn monorepo",
  author: "nvn Team",
} as const;
