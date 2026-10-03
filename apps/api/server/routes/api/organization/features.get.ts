import { createError, defineEventHandler, getQuery } from "h3";
import {
  getMembershipInfo,
  hasAccessToTier,
  type MembershipTier,
  requireAuth,
} from "@/server/utils/membership";

export default defineEventHandler(async (event) => {
  // Require authentication
  const user = await requireAuth(event);

  // Get organization ID from query params
  const query = getQuery(event);
  const organizationId = (query.organizationId as string) || user.session.activeOrganizationId;

  if (!organizationId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Organization ID is required",
    });
  }

  try {
    // Get membership info for the organization
    const membership = await getMembershipInfo(user.user.id, organizationId);

    // Define features available for each tier. Typed as a partial map over
    // every tier so indexing by `basic`/`ultimate` type-checks; the `|| free`
    // fallback below preserves the existing runtime behaviour for tiers that
    // are not explicitly listed here.
    const features: Record<"free", string[]> & Partial<Record<MembershipTier, string[]>> = {
      free: ["basic_dashboard", "up_to_5_users", "community_support"],
      pro: [
        "basic_dashboard",
        "advanced_analytics",
        "up_to_50_users",
        "priority_support",
        "custom_integrations",
        "export_data",
      ],
      enterprise: [
        "basic_dashboard",
        "advanced_analytics",
        "unlimited_users",
        "dedicated_support",
        "custom_integrations",
        "export_data",
        "white_label",
        "sla_guarantee",
        "advanced_security",
        "audit_logs",
      ],
    };

    // Get available features based on membership tier
    const availableFeatures: string[] = features[membership.tier] || features.free;

    // Feature limits based on tier (same partial-map typing as `features`).
    type TierLimits = {
      users: number;
      projects: number;
      storage_gb: number;
      api_calls_per_month: number;
    };
    const limits: Record<"free", TierLimits> & Partial<Record<MembershipTier, TierLimits>> = {
      free: {
        users: 5,
        projects: 3,
        storage_gb: 1,
        api_calls_per_month: 1000,
      },
      pro: {
        users: 50,
        projects: 25,
        storage_gb: 50,
        api_calls_per_month: 50_000,
      },
      enterprise: {
        users: -1, // unlimited
        projects: -1,
        storage_gb: 500,
        api_calls_per_month: 1_000_000,
      },
    };

    return {
      success: true,
      data: {
        organizationId,
        membership: {
          tier: membership.tier,
          hasActiveSubscription: membership.hasActiveSubscription,
          expiresAt: membership.expiresAt,
          benefits: membership.benefits,
        },
        features: {
          available: availableFeatures,
          limits: limits[membership.tier] || limits.free,
        },
        access: {
          canAccessPro: hasAccessToTier(membership.tier, "pro"),
          canAccessEnterprise: hasAccessToTier(membership.tier, "enterprise"),
        },
      },
    };
  } catch (_error) {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to fetch organization features",
    });
  }
});
