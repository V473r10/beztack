import {
  createPolarClient,
  polarApi,
  validatePolarConnection,
} from "@nvn/payments/server";
import { createError, defineEventHandler } from "h3";

type OrganizationInfo = {
  id: string;
  name: string;
  slug: string;
} | null;

type ProductInfo = unknown[] | null;

// Helper function to fetch organization information
async function fetchOrganizationInfo(): Promise<OrganizationInfo> {
  try {
    const client = createPolarClient();
    const orgResponse = await client.organizations.list({ limit: 1 });
    if (orgResponse.result?.items && orgResponse.result.items.length > 0) {
      const org = orgResponse.result.items[0];
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
      };
    }
  } catch (_error) {
    // Silently handle organization fetch errors
  }
  return null;
}

// Helper function to fetch products
async function fetchProducts(): Promise<{
  products: ProductInfo;
  count: number;
}> {
  if (!process.env.POLAR_ORGANIZATION_ID) {
    return { products: null, count: 0 };
  }

  try {
    const products = await polarApi.getProducts(
      process.env.POLAR_ORGANIZATION_ID
    );
    return {
      products,
      count: products?.length || 0,
    };
  } catch (_error) {
    // Silently handle products fetch errors
  }
  return { products: null, count: 0 };
}

// Helper function to build configuration object
function buildConfigurationInfo() {
  return {
    hasAccessToken: !!process.env.POLAR_ACCESS_TOKEN,
    hasWebhookSecret: !!process.env.POLAR_WEBHOOK_SECRET,
    server: process.env.POLAR_SERVER || "sandbox",
    hasBasicProductId:
      !!process.env.POLAR_BASIC_MONTHLY_PRODUCT_ID ||
      !!process.env.POLAR_BASIC_YEARLY_PRODUCT_ID,
    hasProProductId:
      !!process.env.POLAR_PRO_MONTHLY_PRODUCT_ID ||
      !!process.env.POLAR_PRO_YEARLY_PRODUCT_ID,
    hasUltimateProductId:
      !!process.env.POLAR_ULTIMATE_MONTHLY_PRODUCT_ID ||
      !!process.env.POLAR_ULTIMATE_YEARLY_PRODUCT_ID,
    hasOrganizationId: !!process.env.POLAR_ORGANIZATION_ID,
  };
}

/**
 * Test endpoint to validate Polar integration
 * Only available in development environment for security
 */
export default defineEventHandler(async (_event) => {
  // Only allow in development environment
  if (process.env.NODE_ENV === "production") {
    throw createError({
      statusCode: 404,
      statusMessage: "Endpoint not available in production",
    });
  }

  try {
    // Validate connection
    const isConnected = await validatePolarConnection();

    if (!isConnected) {
      return {
        success: false,
        error: "Failed to connect to Polar API",
        message:
          "Check your POLAR_ACCESS_TOKEN and POLAR_SERVER environment variables",
      };
    }

    // Fetch organization and product information
    const organizationInfo = await fetchOrganizationInfo();
    const { products, count: productsCount } = await fetchProducts();
    const config = buildConfigurationInfo();

    return {
      success: true,
      message: "Polar integration is working",
      connection: isConnected,
      organizationInfo,
      productsCount,
      products,
      config,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      message: "Check your Polar configuration and credentials",
      timestamp: new Date().toISOString(),
    };
  }
});
