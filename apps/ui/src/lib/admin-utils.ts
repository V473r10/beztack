import type { AdminUser } from "./admin-types";
import { authClient } from "./auth-client";

/**
 * Check if the current user has admin permissions
 */
export function useIsAdmin() {
  const { data: session } = authClient.useSession();

  // Check if user has admin role or is in adminUserIds
  return (
    session?.user?.role === "admin" ||
    (Array.isArray(session?.user?.role) &&
      session?.user?.role.includes("admin"))
  );
}

/**
 * Get user role(s) as an array
 */
export function getUserRoles(user: AdminUser | undefined): string[] {
  if (!user?.role) {
    return ["user"];
  }

  if (typeof user.role === "string") {
    return user.role.split(",").map((r) => r.trim());
  }

  return Array.isArray(user.role) ? user.role : ["user"];
}

/**
 * Check if user has a specific role
 */
export function hasRole(user: AdminUser | undefined, role: string): boolean {
  const roles = getUserRoles(user);
  return roles.includes(role);
}

/**
 * Format user status for display
 */
export function getUserStatus(user: AdminUser): {
  status: "active" | "banned" | "unverified";
  label: string;
  variant: "default" | "destructive" | "secondary";
} {
  if (user.banned) {
    return {
      status: "banned",
      label:
        user.banExpires && new Date(user.banExpires) > new Date()
          ? "Temporarily Banned"
          : "Banned",
      variant: "destructive",
    };
  }

  if (!user.emailVerified) {
    return {
      status: "unverified",
      label: "Email Unverified",
      variant: "secondary",
    };
  }

  return {
    status: "active",
    label: "Active",
    variant: "default",
  };
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Time calculation constants
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

const MILLISECONDS_PER_MINUTE = MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE;
const MILLISECONDS_PER_HOUR = MILLISECONDS_PER_MINUTE * MINUTES_PER_HOUR;
const MILLISECONDS_PER_DAY = MILLISECONDS_PER_HOUR * HOURS_PER_DAY;

/**
 * Format relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / MILLISECONDS_PER_DAY);
  const diffHours = Math.floor(diffMs / MILLISECONDS_PER_HOUR);
  const diffMinutes = Math.floor(diffMs / MILLISECONDS_PER_MINUTE);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }
  if (diffHours > 0) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }
  if (diffMinutes > 0) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }
  return "Just now";
}
