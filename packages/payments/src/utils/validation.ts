import { z } from "zod";
import { MEMBERSHIP_TIERS, USAGE_EVENTS } from "../constants/index.ts";
import type {
  BillingPeriod,
  CheckoutSessionParams,
  MembershipTier,
  UsageEvent,
} from "../types/index.ts";

// Top-level regex constants for performance
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEBHOOK_SIGNATURE_REGEX = /^(sha256=)?[a-f0-9]{64}$/i;

/**
 * Membership tier validation schema
 */
export const membershipTierSchema = z.enum([
  "free",
  "pro",
  "team",
  "enterprise",
]);

/**
 * Billing period validation schema
 */
export const billingPeriodSchema = z.enum(["monthly", "yearly"]);

/**
 * Checkout session params validation schema
 */
export const checkoutSessionParamsSchema = z
  .object({
    productIds: z.array(z.string()).optional(),
    slug: z.string().optional(),
    metadata: z
      .object({
        userId: z.string().optional(),
        organizationId: z.string().optional(),
        tier: membershipTierSchema.optional(),
        referenceId: z.string().optional(),
      })
      .optional(),
    successUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
    allowPromotionCodes: z.boolean().optional(),
  })
  .refine((data) => data.productIds || data.slug, {
    message: "Either productIds or slug must be provided",
  });

/**
 * Usage event validation schema
 */
export const usageEventSchema = z.object({
  eventName: z.string().min(1, "Event name is required"),
  customerId: z.string().min(1, "Customer ID is required"),
  timestamp: z.date(),
  quantity: z.number().min(0, "Quantity must be non-negative"),
  metadata: z
    .object({
      userId: z.string().optional(),
      organizationId: z.string().optional(),
      feature: z.string().optional(),
    })
    .optional(),
});

/**
 * Membership change request validation schema
 */
export const membershipChangeRequestSchema = z
  .object({
    userId: z.string().min(1, "User ID is required"),
    fromTier: membershipTierSchema,
    toTier: membershipTierSchema,
    billingPeriod: billingPeriodSchema,
    organizationId: z.string().optional(),
    prorationBehavior: z.enum(["create_prorations", "none"]).optional(),
  })
  .refine((data) => data.fromTier !== data.toTier, {
    message: "From tier and to tier must be different",
  });

/**
 * User membership validation schema
 */
export const userMembershipSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  tier: membershipTierSchema,
  status: z.enum(["active", "inactive", "canceled", "past_due"]),
  subscriptionId: z.string().optional(),
  customerId: z.string().optional(),
  organizationId: z.string().optional(),
  validUntil: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Usage metrics validation schema
 */
export const usageMetricsSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  organizationId: z.string().optional(),
  period: z
    .object({
      start: z.date(),
      end: z.date(),
    })
    .refine((data) => data.start < data.end, {
      message: "Start date must be before end date",
    }),
  metrics: z.object({
    apiCalls: z.number().min(0),
    storageUsed: z.number().min(0),
    activeUsers: z.number().min(0),
    organizations: z.number().min(0),
    teams: z.number().min(0),
  }),
});

/**
 * Webhook payload validation schema
 */
export const webhookPayloadSchema = z.object({
  type: z.string().min(1, "Webhook type is required"),
  data: z.record(z.string(), z.unknown()),
});

/**
 * Validate membership tier
 */
export function validateMembershipTier(tier: unknown): MembershipTier {
  return membershipTierSchema.parse(tier);
}

/**
 * Validate billing period
 */
export function validateBillingPeriod(period: unknown): BillingPeriod {
  return billingPeriodSchema.parse(period);
}

/**
 * Validate checkout session parameters
 */
export function validateCheckoutSessionParams(
  params: unknown
): CheckoutSessionParams {
  return checkoutSessionParamsSchema.parse(params);
}

/**
 * Validate usage event
 */
export function validateUsageEvent(event: unknown): UsageEvent {
  return usageEventSchema.parse(event);
}

/**
 * Validate tier upgrade/downgrade
 */
export function validateTierChange(
  fromTier: MembershipTier,
  toTier: MembershipTier
): {
  isValid: boolean;
  changeType: "upgrade" | "downgrade" | "same";
  error?: string;
} {
  if (fromTier === toTier) {
    return {
      isValid: false,
      changeType: "same",
      error: "Cannot change to the same tier",
    };
  }

  const fromConfig = MEMBERSHIP_TIERS[fromTier.toUpperCase() as keyof typeof MEMBERSHIP_TIERS];
  const toConfig = MEMBERSHIP_TIERS[toTier.toUpperCase() as keyof typeof MEMBERSHIP_TIERS];

  if (!(fromConfig && toConfig)) {
    return {
      isValid: false,
      changeType: fromTier === "free" ? "upgrade" : "downgrade",
      error: "Invalid tier configuration",
    };
  }

  const tierHierarchy = ["free", "pro", "team", "enterprise"];
  const fromIndex = tierHierarchy.indexOf(fromTier);
  const toIndex = tierHierarchy.indexOf(toTier);

  const changeType = toIndex > fromIndex ? "upgrade" : "downgrade";

  return {
    isValid: true,
    changeType,
  };
}

/**
 * Validate usage event name
 */
export function validateUsageEventName(eventName: string): boolean {
  return Object.values(USAGE_EVENTS).includes(
    eventName as (typeof USAGE_EVENTS)[keyof typeof USAGE_EVENTS]
  );
}

/**
 * Validate organization ID format
 */
export function validateOrganizationId(organizationId: string): boolean {
  // Basic UUID format validation
  return UUID_REGEX.test(organizationId);
}

/**
 * Validate user ID format
 */
export function validateUserId(userId: string): boolean {
  // Basic UUID format validation
  return UUID_REGEX.test(userId);
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

/**
 * Validate webhook signature format
 */
export function validateWebhookSignature(signature: string): boolean {
  // Polar uses sha256 signatures
  return WEBHOOK_SIGNATURE_REGEX.test(signature);
}

/**
 * Sanitize metadata object
 */
export function sanitizeMetadata(
  metadata: Record<string, unknown>
): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(metadata)) {
    // Only include string values, convert others to string
    if (typeof value === "string") {
      sanitized[key] = value;
    } else if (value != null) {
      sanitized[key] = String(value);
    }
  }

  return sanitized;
}

/**
 * Validate API response structure
 */
export function validateApiResponse<T>(
  response: unknown,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = schema.parse(response);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `Validation error: ${error.issues.map((e: z.ZodIssue) => e.message).join(", ")}`,
      };
    }
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Unknown validation error",
    };
  }
}
