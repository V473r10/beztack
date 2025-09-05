import { createPolarClient } from "@nvn/payments/server";
import { defineEventHandler } from "h3";

interface PolarProduct {
  id: string;
  name: string;
  description?: string | null;
  recurringInterval: string;
  metadata?: Record<string, any>;
  prices: Array<{
    id: string;
    priceAmount: number;
    priceCurrency: string;
    recurringInterval: string;
  }>;
  benefits?: Array<any>;
}

interface ProductTier {
  id: string;
  name: string;
  description: string;
  monthly?: PolarProduct;
  yearly?: PolarProduct;
  price: {
    monthly: number;
    yearly: number;
  };
}

export default defineEventHandler(async (event) => {
  const polar = createPolarClient();

  const products = await polar.products.list({
    organizationId: process.env.POLAR_ORGANIZATION_ID,
    isArchived: false
  });

  // Group products by tier name (basic, pro, ultimate, etc.)
  const productsByTier: Record<string, ProductTier> = {};

  products.result.items.forEach((product: any) => {
    // Extract tier name from product name (e.g., "Basic - Monthly" -> "basic")
    const tierName = product.name.split(' - ')[0].toLowerCase();
    const isMonthly = product.recurringInterval === 'month';
    const isYearly = product.recurringInterval === 'year';

    if (!productsByTier[tierName]) {
      productsByTier[tierName] = {
        id: tierName,
        name: product.name.split(' - ')[0], // "Basic", "Pro", "Ultimate"
        description: product.description || `${product.name.split(' - ')[0]} tier`,
        price: { monthly: 0, yearly: 0 }
      };
    }

    const priceAmount = product.prices[0]?.priceAmount || 0;
    
    if (isMonthly) {
      productsByTier[tierName].monthly = product;
      productsByTier[tierName].price.monthly = priceAmount / 100; // Convert cents to dollars
    } else if (isYearly) {
      productsByTier[tierName].yearly = product;
      productsByTier[tierName].price.yearly = priceAmount / 100; // Convert cents to dollars
    }
  });

  return Object.values(productsByTier);
});