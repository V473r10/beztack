import { Polar } from "@polar-sh/sdk";
import { eq } from "drizzle-orm";
import { defineEventHandler } from "h3";
import { db } from "@/db/db";
import {
  feature,
  limit,
  permission,
  planFeature,
  planLimit,
  planPermission,
} from "@/db/schema";

type ProductTier = {
  id: string;
  name: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
  };
  monthly?: unknown; // Full Polar product object
  yearly?: unknown; // Full Polar product object
  features: string[];
  limits: Record<string, number>;
  permissions: string[];
};

export default defineEventHandler(async (_event) => {
  const polar = new Polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN,
    server: process.env.POLAR_SERVER as "production" | "sandbox",
  });

  const products = await polar.products.list({
    organizationId: process.env.POLAR_ORGANIZATION_ID,
    isArchived: false,
  });

  // Group products by tier name (basic, pro, ultimate, etc.)
  const productsByTier: Record<string, ProductTier> = {};

  // First pass: group products by tier
  for (const product of products.result.items.sort((a, b) =>
    a.name.localeCompare(b.name)
  )) {
    // Extract tier name from product name (e.g., "Basic - Monthly" -> "basic")
    const tierName = product.name.split(" - ")[0].toLowerCase();
    const isMonthly = product.recurringInterval === "month";
    const isYearly = product.recurringInterval === "year";

    if (!productsByTier[tierName]) {
      productsByTier[tierName] = {
        id: tierName,
        name: product.name.split(" - ")[0], // "Basic", "Pro", "Ultimate"
        description:
          product.description || `${product.name.split(" - ")[0]} tier`,
        price: { monthly: 0, yearly: 0 },
        features: [],
        limits: {},
        permissions: [],
      };
    }

    const priceAmount =
      (product.prices[0] as { priceAmount?: number })?.priceAmount || 0;

    if (isMonthly) {
      // Include the complete product object for monthly
      productsByTier[tierName].monthly = {
        ...product,
        // Ensure all properties from the Polar API are included
      };
      const CENTS_TO_DOLLARS = 100;
      productsByTier[tierName].price.monthly = priceAmount / CENTS_TO_DOLLARS; // Convert cents to dollars
    } else if (isYearly) {
      // Include the complete product object for yearly
      productsByTier[tierName].yearly = {
        ...product,
        // Ensure all properties from the Polar API are included
      };
      const CENTS_TO_DOLLARS_YEARLY = 100;
      productsByTier[tierName].price.yearly =
        priceAmount / CENTS_TO_DOLLARS_YEARLY; // Convert cents to dollars
    }
  }

  // Second pass: fetch database details for each product
  for (const product of products.result.items) {
    const tierName = product.name.split(" - ")[0].toLowerCase();

    // Get features for this plan
    const planFeatures = await db
      .select({
        name: feature.name,
      })
      .from(planFeature)
      .innerJoin(feature, eq(planFeature.featureId, feature.id))
      .where(eq(planFeature.planId, product.id));

    // Get permissions for this plan
    const planPermissions = await db
      .select({
        name: permission.name,
      })
      .from(planPermission)
      .innerJoin(permission, eq(planPermission.permissionId, permission.id))
      .where(eq(planPermission.planId, product.id));

    // Get limits for this plan
    const planLimits = await db
      .select({
        name: limit.name,
        value: planLimit.value,
      })
      .from(planLimit)
      .innerJoin(limit, eq(planLimit.limitId, limit.id))
      .where(eq(planLimit.planId, product.id));

    // Update the tier with database values (only once per tier)
    if (
      productsByTier[tierName] &&
      productsByTier[tierName].features.length === 0
    ) {
      productsByTier[tierName].features = planFeatures.map((f) => f.name);
      productsByTier[tierName].permissions = planPermissions.map((p) => p.name);
      productsByTier[tierName].limits = planLimits.reduce(
        (acc, l) => {
          acc[l.name] = l.value;
          return acc;
        },
        {} as Record<string, number>
      );
    }
  }

  return Object.values(productsByTier);
});
