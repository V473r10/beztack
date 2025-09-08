import { defineEventHandler, createError } from "h3";
import { polarApi, validatePolarConnection, createPolarClient } from "@nvn/payments/server";

/**
 * Test endpoint to validate Polar integration
 * Only available in development environment for security
 */
export default defineEventHandler(async (event) => {
  // Only allow in development environment
  if (process.env.NODE_ENV === 'production') {
    throw createError({
      statusCode: 404,
      statusMessage: 'Endpoint not available in production'
    });
  }

  try {
    // Validate connection
    const isConnected = await validatePolarConnection();
    
    if (!isConnected) {
      return {
        success: false,
        error: "Failed to connect to Polar API",
        message: "Check your POLAR_ACCESS_TOKEN and POLAR_SERVER environment variables"
      };
    }
    
    // Test API connection by listing organizations (safer endpoint)
    let organizationInfo = null;
    let products = null;
    try {
      const client = createPolarClient();
      const orgResponse = await client.organizations.list({ limit: 1 });
      if (orgResponse.result?.items && orgResponse.result.items.length > 0) {
        const org = orgResponse.result.items[0];
        organizationInfo = {
          id: org.id,
          name: org.name,
          slug: org.slug
        };
      }
    } catch (error) {
      console.log("Could not fetch organization info:", error);
    }
    
    // Try to list products if organization ID is available
    let productsCount = 0;
    if (process.env.POLAR_ORGANIZATION_ID) {
      try {
        products = await polarApi.getProducts(process.env.POLAR_ORGANIZATION_ID);
        productsCount = products?.length || 0;
      } catch (error) {
        console.log("Could not fetch products:", error);
      }
    }
    
    // Check environment configuration (without exposing sensitive values)
    const config = {
      hasAccessToken: !!process.env.POLAR_ACCESS_TOKEN,
      hasWebhookSecret: !!process.env.POLAR_WEBHOOK_SECRET,
      server: process.env.POLAR_SERVER || 'sandbox',
      hasBasicProductId: !!process.env.POLAR_BASIC_MONTHLY_PRODUCT_ID || !!process.env.POLAR_BASIC_YEARLY_PRODUCT_ID,
      hasProProductId: !!process.env.POLAR_PRO_MONTHLY_PRODUCT_ID || !!process.env.POLAR_PRO_YEARLY_PRODUCT_ID,
      hasUltimateProductId: !!process.env.POLAR_ULTIMATE_MONTHLY_PRODUCT_ID || !!process.env.POLAR_ULTIMATE_YEARLY_PRODUCT_ID,
      hasOrganizationId: !!process.env.POLAR_ORGANIZATION_ID,
    };
    
    return {
      success: true,
      message: "Polar integration is working",
      connection: isConnected,
      organizationInfo,
      productsCount,
      products,
      config,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    };
    
  } catch (error) {
    console.error('Polar test failed:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      message: "Check your Polar configuration and credentials",
      timestamp: new Date().toISOString()
    };
  }
});