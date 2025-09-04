import { Polar } from "@polar-sh/sdk";

/**
 * Direct Polar API integration
 * Provides methods for interacting with Polar's API beyond what Better Auth plugins offer
 */

/**
 * Create configured Polar client
 */
export function createPolarClient(config?: { accessToken?: string; server?: "production" | "sandbox" }): Polar {
  const accessToken = config?.accessToken || process.env.POLAR_ACCESS_TOKEN;
  const server = config?.server || (process.env.POLAR_SERVER as "production" | "sandbox") || "sandbox";
  
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
  private client: Polar;
  
  constructor(config?: { accessToken?: string; server?: "production" | "sandbox" }) {
    this.client = createPolarClient(config);
  }
  
  /**
   * Get organization information
   */
  async getOrganization(orgId: string): Promise<any> {
    const response = await this.client.organizations.get({ id: orgId });
    return (response as any).result || response;
  }
  
  /**
   * List all products for an organization
   */
  async getProducts(orgId: string): Promise<any[]> {
    const response = await this.client.products.list({ 
      organizationId: orgId,
      isArchived: false 
    });
    return response.result?.items || [];
  }
  
  /**
   * Get specific product by ID
   */
  async getProduct(productId: string): Promise<any> {
    const response = await this.client.products.get({ id: productId });
    return (response as any).result || response;
  }
  
  /**
   * Create a customer
   */
  async createCustomer(data: {
    email: string;
    name?: string;
    metadata?: Record<string, any>;
  }): Promise<any> {
    const response = await this.client.customers.create({
      email: data.email,
      name: data.name,
      metadata: data.metadata,
    });
    return (response as any).result || response;
  }
  
  /**
   * Get customer by ID
   */
  async getCustomer(customerId: string): Promise<any> {
    const response = await this.client.customers.get({ id: customerId });
    return (response as any).result || response;
  }
  
  /**
   * Update customer
   */
  async updateCustomer(customerId: string, data: {
    name?: string;
    email?: string;
    metadata?: Record<string, any>;
  }): Promise<any> {
    const response = await this.client.customers.update({
      id: customerId,
      customerUpdate: data
    });
    return (response as any).result || response;
  }
  
  /**
   * List customer subscriptions
   */
  async getCustomerSubscriptions(customerId: string): Promise<any[]> {
    const response = await this.client.subscriptions.list({
      customerId,
    });
    return response.result?.items || [];
  }
  
  /**
   * Create a checkout session
   */
  async createCheckout(data: any): Promise<any> {
    const response = await this.client.checkouts.create(data);
    return (response as any).result || response;
  }
  
  /**
   * Get checkout session
   */
  async getCheckout(checkoutId: string): Promise<any> {
    const response = await this.client.checkouts.get({ id: checkoutId });
    return (response as any).result || response;
  }
  
  /**
   * Create custom checkout link for a product
   */
  async createProductCheckout(data: {
    productId: string;
    customerId?: string;
    customerEmail?: string;
    successUrl?: string;
    metadata?: Record<string, any>;
  }): Promise<any> {
    const checkoutData: any = {
      productId: data.productId,
      successUrl: data.successUrl || process.env.POLAR_SUCCESS_URL,
      metadata: data.metadata,
    };
    
    if (data.customerId) {
      checkoutData.customerId = data.customerId;
    } else if (data.customerEmail) {
      checkoutData.customerEmail = data.customerEmail;
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
  } catch (error) {
    console.error('Polar connection validation failed:', error);
    return false;
  }
}

/**
 * Get organization products with tier mapping
 */
export async function getOrganizationProducts(orgId: string) {
  const products = await polarApi.getProducts(orgId);
  
  // Map products to tiers based on environment variables
  const tierMapping = {
    [process.env.POLAR_PRO_PRODUCT_ID!]: 'pro',
    [process.env.POLAR_TEAM_PRODUCT_ID!]: 'team', 
    [process.env.POLAR_ENTERPRISE_PRODUCT_ID!]: 'enterprise',
  };
  
  return products.map(product => ({
    ...product,
    tier: tierMapping[product.id] || 'unknown'
  }));
}