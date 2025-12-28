// Types for Polar-integrated pricing tiers (from real Polar data)
export type PolarPricingTier = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly price: {
    readonly monthly: number;
    readonly yearly: number;
  };
  readonly monthly?: PolarProduct;
  readonly yearly?: PolarProduct;
  readonly features?: readonly string[];
  readonly limits?: Record<string, number>;
  readonly permissions?: Record<string, boolean>;
};

// Polar product structure from API
export type PolarProduct = {
  id: string;
  name: string;
  description?: string | null;
  recurringInterval: string;
  metadata?: {
    frequency?: string;
    [key: string]: unknown;
  };
  prices: Array<{
    id: string;
    priceAmount: number;
    priceCurrency: string;
    recurringInterval: string;
  }>;
  benefits?: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
};
