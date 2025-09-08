import { defineEventHandler, createError, getQuery } from "h3";
import { requireAuth, getMembershipInfo, hasAccessToTier } from "@/server/utils/membership";

export default defineEventHandler(async (event) => {
  // Require authentication
  const user = await requireAuth(event);
  
  // Get organization ID from query params
  const query = getQuery(event);
  const organizationId = query.organizationId as string || user.session.activeOrganizationId;
  
  if (!organizationId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Organization ID is required'
    });
  }
  
  try {
    // Get membership info for the organization
    const membership = await getMembershipInfo(user.user.id, organizationId);
    
    // Define features available for each tier
    const features = {
      free: [
        'basic_dashboard',
        'up_to_5_users',
        'community_support'
      ],
      pro: [
        'basic_dashboard',
        'advanced_analytics',
        'up_to_50_users',
        'priority_support',
        'custom_integrations',
        'export_data'
      ],
      enterprise: [
        'basic_dashboard',
        'advanced_analytics',
        'unlimited_users',
        'dedicated_support',
        'custom_integrations',
        'export_data',
        'white_label',
        'sla_guarantee',
        'advanced_security',
        'audit_logs'
      ]
    };
    
    // Get available features based on membership tier
    let availableFeatures: string[] = features[membership.tier] || features.free;
    
    // Feature limits based on tier
    const limits = {
      free: {
        users: 5,
        projects: 3,
        storage_gb: 1,
        api_calls_per_month: 1000
      },
      pro: {
        users: 50,
        projects: 25,
        storage_gb: 50,
        api_calls_per_month: 50000
      },
      enterprise: {
        users: -1, // unlimited
        projects: -1,
        storage_gb: 500,
        api_calls_per_month: 1000000
      }
    };
    
    return {
      success: true,
      data: {
        organizationId,
        membership: {
          tier: membership.tier,
          hasActiveSubscription: membership.hasActiveSubscription,
          expiresAt: membership.expiresAt,
          benefits: membership.benefits
        },
        features: {
          available: availableFeatures,
          limits: limits[membership.tier] || limits.free
        },
        access: {
          canAccessPro: hasAccessToTier(membership.tier, 'pro'),
          canAccessEnterprise: hasAccessToTier(membership.tier, 'enterprise')
        }
      }
    };
  } catch (error) {
    console.error('Error fetching organization features:', error);
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch organization features'
    });
  }
});