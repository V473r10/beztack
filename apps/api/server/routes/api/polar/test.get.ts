import { defineEventHandler, createError } from "h3";
import { polarApi, validatePolarConnection } from "@nvn/payments/server";

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
    
    // Get current user info (only basic info, not sensitive data)
    let userInfo = null;
    try {
      const userResponse = await polarApi.client.users.get();
      userInfo = {
        id: userResponse.user.id,
        email: userResponse.user.email,
        username: userResponse.user.username
      };
    } catch (error) {
      console.log("Could not fetch user info:", error);
    }
    
    // Try to list products if organization ID is available
    let productsCount = 0;
    if (process.env.POLAR_ORGANIZATION_ID) {
      try {
        const products = await polarApi.getProducts(process.env.POLAR_ORGANIZATION_ID);
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
      hasProProductId: !!process.env.POLAR_PRO_PRODUCT_ID,
      hasTeamProductId: !!process.env.POLAR_TEAM_PRODUCT_ID,
      hasEnterpriseProductId: !!process.env.POLAR_ENTERPRISE_PRODUCT_ID,
      hasOrganizationId: !!process.env.POLAR_ORGANIZATION_ID,
    };
    
    return {
      success: true,
      message: "Polar integration is working",
      connection: isConnected,
      userInfo,
      productsCount,
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