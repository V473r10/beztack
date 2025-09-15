import { Polar } from "@polar-sh/sdk";

/**
 * Direct Polar API integration
 * Provides methods for interacting with Polar's API beyond what Better Auth plugins offer
 */

// Types for Polar API responses
type PolarOrganization = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
};

type PolarProduct = {
  id: string;
  name: string;
  description?: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
};

type PolarApiResponse<T> = {
  result?: T;
  data?: T;
};

type PolarCustomer = {
  id: string;
  email: string;
  name?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type PolarSubscription = {
  id: string;
  customer_id: string;
  product_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
  updated_at: string;
};

type PolarCheckout = {
  id: string;
  url: string;
  status: string;
  product_id?: string;
  customer_id?: string;
  created_at: string;
  updated_at: string;
};

type CustomerCreateData = {
  email: string;
  name?: string;
  metadata?: Record<string, unknown>;
};

type CustomerUpdateData = {
  name?: string;
  email?: string;
  metadata?: Record<string, unknown>;
};

type CheckoutCreateData = {
  product_id?: string;
  product_price_id?: string;
  customer_id?: string;
  success_url?: string;
  cancel_url?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Create configured Polar client
 */
export function createPolarClient(config?: {
  accessToken?: string;
  server?: "production" | "sandbox";
}): Polar {
  const accessToken = config?.accessToken || process.env.POLAR_ACCESS_TOKEN;
  const server =
    config?.server ||
    (process.env.POLAR_SERVER as "production" | "sandbox") ||
    "sandbox";

  if (!accessToken) {
    throw new Error("POLAR_ACCESS_TOKEN is required");
  }

  return new Polar({
    accessToken,
    server,
  });
}

/**
 * Polar API service class
 */
export class PolarApiService {
  private readonly client: Polar;

  constructor(config?: {
    accessToken?: string;
    server?: "production" | "sandbox";
  }) {
    this.client = createPolarClient(config);
  }

  /**
   * Get organization information
   */
  async getOrganization(orgId: string): Promise<PolarOrganization> {
    const response = await this.client.organizations.get({ id: orgId });
    return (response as PolarApiResponse<PolarOrganization>).result || (response as any);
  }

  /**
   * List all products for an organization
   */
  async getProducts(orgId: string): Promise<PolarProduct[]> {
    const response = await this.client.products.list({
      organizationId: orgId,
      isArchived: false,
    });
    return (response.result?.items || []) as any;
  }

  /**
   * Get specific product by ID
   */
  async getProduct(productId: string): Promise<PolarProduct> {
    const response = await this.client.products.get({ id: productId });
    return (response as PolarApiResponse<PolarProduct>).result || (response as any);
  }

  /**
   * Create a customer
   */
  async createCustomer(data: CustomerCreateData): Promise<PolarCustomer> {
    const response = await this.client.customers.create({
      email: data.email,
      name: data.name,
      metadata: data.metadata as { [k: string]: string | number | boolean; } | undefined,
    });
    return (response as PolarApiResponse<PolarCustomer>).result || (response as any);
  }

  /**
   * Get customer by ID
   */
  async getCustomer(customerId: string): Promise<PolarCustomer> {
    const response = await this.client.customers.get({ id: customerId });
    return (response as PolarApiResponse<PolarCustomer>).result || (response as any);
  }

  /**
   * Update customer
   */
  async updateCustomer(
    customerId: string,
    data: CustomerUpdateData
  ): Promise<PolarCustomer> {
    const response = await this.client.customers.update({
      id: customerId,
      customerUpdate: data as any,
    });
    return (response as PolarApiResponse<PolarCustomer>).result || (response as any);
  }

  /**
   * List customer subscriptions
   */
  async getCustomerSubscriptions(
    customerId: string
  ): Promise<PolarSubscription[]> {
    const response = await this.client.subscriptions.list({
      customerId,
    });
    return (response.result?.items || []) as any;
  }

  /**
   * Create a checkout session
   */
  async createCheckout(data: CheckoutCreateData): Promise<PolarCheckout> {
    const response = await this.client.checkouts.create(data as any);
    return (response as PolarApiResponse<PolarCheckout>).result || (response as any);
  }

  /**
   * Get checkout session
   */
  async getCheckout(checkoutId: string): Promise<PolarCheckout> {
    const response = await this.client.checkouts.get({ id: checkoutId });
    return (response as PolarApiResponse<PolarCheckout>).result || (response as any);
  }

  /**
   * Create custom checkout link for a product
   */
  createProductCheckout(data: {
    productId: string;
    customerId?: string;
    customerEmail?: string;
    successUrl?: string;
    metadata?: Record<string, unknown>;
  }): Promise<PolarCheckout> {
    const checkoutData: CheckoutCreateData = {
      product_id: data.productId,
      success_url: data.successUrl || process.env.POLAR_SUCCESS_URL,
      metadata: data.metadata,
    };

    if (data.customerId) {
      checkoutData.customer_id = data.customerId;
    }

    return this.createCheckout(checkoutData);
  }

  /**
   * Get customer benefits/entitlements
   */
  async getCustomerBenefits(customerId: string) {
    const customer = await this.getCustomer(customerId);
    return {
      customer,
      subscriptions: await this.getCustomerSubscriptions(customerId),
      // You can extend this to get benefit grants, etc.
    };
  }
}

/**
 * Default Polar API service instance
 */
export const polarApi = new PolarApiService();

/**
 * Utility functions for common operations
 */
export async function validatePolarConnection(): Promise<boolean> {
  try {
    const client = createPolarClient();
    // Try to make a simple API call to validate connection
    await client.organizations.list({ limit: 1 });
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Get organization products with tier mapping
 */
export async function getOrganizationProducts(orgId: string) {
  const products = await polarApi.getProducts(orgId);

  // Map products to tiers based on environment variables
  const tierMapping: Record<string, string> = {};

  if (process.env.POLAR_BASIC_MONTHLY_PRODUCT_ID) {
    tierMapping[process.env.POLAR_BASIC_MONTHLY_PRODUCT_ID] = "basic";
  }
  if (process.env.POLAR_BASIC_YEARLY_PRODUCT_ID) {
    tierMapping[process.env.POLAR_BASIC_YEARLY_PRODUCT_ID] = "basic";
  }
  if (process.env.POLAR_PRO_MONTHLY_PRODUCT_ID) {
    tierMapping[process.env.POLAR_PRO_MONTHLY_PRODUCT_ID] = "pro";
  }
  if (process.env.POLAR_PRO_YEARLY_PRODUCT_ID) {
    tierMapping[process.env.POLAR_PRO_YEARLY_PRODUCT_ID] = "pro";
  }
  if (process.env.POLAR_ULTIMATE_MONTHLY_PRODUCT_ID) {
    tierMapping[process.env.POLAR_ULTIMATE_MONTHLY_PRODUCT_ID] = "ultimate";
  }
  if (process.env.POLAR_ULTIMATE_YEARLY_PRODUCT_ID) {
    tierMapping[process.env.POLAR_ULTIMATE_YEARLY_PRODUCT_ID] = "ultimate";
  }

  return products.map((product) => ({
    ...product,
    tier: tierMapping[product.id] || "unknown",
  }));
}
