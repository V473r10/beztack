import { authClient } from "./auth-client";
import type { AdminUser } from "./admin-types";

/**
 * Check if the current user has admin permissions
 */
export function useIsAdmin() {
	const { data: session } = authClient.useSession();
	
	// Check if user has admin role or is in adminUserIds
	return session?.user?.role === "admin" || 
		   (Array.isArray(session?.user?.role) && session?.user?.role.includes("admin"));
}

/**
 * Get user role(s) as an array
 */
export function getUserRoles(user: AdminUser | undefined): string[] {
	if (!user?.role) return ["user"];
	
	if (typeof user.role === "string") {
		return user.role.split(",").map(r => r.trim());
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
			label: user.banExpires && new Date(user.banExpires) > new Date() 
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

/**
 * Format relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(date: Date | string): string {
	const d = new Date(date);
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffMinutes = Math.floor(diffMs / (1000 * 60));

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