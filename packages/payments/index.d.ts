/**
 * @nvn/payments - Polar payment integration for nvn
 *
 * This package provides a complete payment and subscription management
 * solution integrated with Polar and Better Auth.
 */
/** biome-ignore-all lint/performance/noBarrelFile: main exports */
export * from "./src/constants/index.ts";
export type * from "./src/types/index.ts";
export * from "./src/utils/index.ts";
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
export declare const VERSION = "1.0.0";
/**
 * Package metadata
 */
export declare const PACKAGE_INFO: {
  readonly name: "@nvn/payments";
  readonly version: "1.0.0";
  readonly description: "Polar payment integration for nvn monorepo";
  readonly author: "nvn Team";
};
