// Types for Polar-integrated pricing tiers (from real Polar data)
export interface PolarPricingTier {
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
  readonly permissions?: readonly string[];
}

// Polar product structure from API
export interface PolarProduct {
  id: string;
  name: string;
  description?: string | null;
  recurringInterval: string;
  metadata?: {
    frequency?: string;
    [key: string]: any;
  };
  prices: Array<{
    id: string;
    priceAmount: number;
    priceCurrency: string;
    recurringInterval: string;
  }>;
  benefits?: Array<any>;
}
