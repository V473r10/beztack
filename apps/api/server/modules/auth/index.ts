/**
 * Auth Module
 *
 * Core authentication module using Better Auth.
 * This module is required and cannot be removed.
 *
 * Features:
 * - Email/password authentication
 * - OAuth providers (Google, GitHub, etc.)
 * - Two-factor authentication (TOTP)
 * - Session management
 * - Organization support
 */
export const AuthModule = {
  name: "auth",
  required: true,
  description: "Core authentication with Better Auth",
};
