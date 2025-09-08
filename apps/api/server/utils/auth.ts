import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db/db";
import { schema } from "@/db/schema";
import { twoFactor, admin, organization } from "better-auth/plugins";
import { setupPolarForBetterAuth } from "@nvn/payments/server";

// Setup Polar configuration with proper validation
function getPolarPlugin() {
  // Check required environment variables
  const hasAccessToken = !!process.env.POLAR_ACCESS_TOKEN;
  const hasWebhookSecret = !!process.env.POLAR_WEBHOOK_SECRET;
  
  if (!hasAccessToken) {
    console.info('Polar integration disabled: POLAR_ACCESS_TOKEN not provided');
    return null;
  }
  
  if (!hasWebhookSecret) {
    console.warn('Polar webhooks disabled: POLAR_WEBHOOK_SECRET not provided');
    // Continue without webhooks
  }

  try {
    const polarPlugin = setupPolarForBetterAuth();
    
    if (polarPlugin) {
      console.info('Polar integration enabled:', {
        server: process.env.POLAR_SERVER || 'sandbox',
        webhooksEnabled: hasWebhookSecret,
        hasBasicProduct: !!process.env.POLAR_BASIC_MONTHLY_PRODUCT_ID || !!process.env.POLAR_BASIC_YEARLY_PRODUCT_ID,
        hasProProduct: !!process.env.POLAR_PRO_MONTHLY_PRODUCT_ID || !!process.env.POLAR_PRO_YEARLY_PRODUCT_ID,
        hasUltimateProduct: !!process.env.POLAR_ULTIMATE_MONTHLY_PRODUCT_ID || !!process.env.POLAR_ULTIMATE_YEARLY_PRODUCT_ID
      });
      
      return polarPlugin;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to setup Polar integration:', error instanceof Error ? error.message : String(error));
    console.warn('Continuing without Polar integration. Check your configuration.');
    return null;
  }
}

const polarPlugin = getPolarPlugin();

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: schema }),
  emailAndPassword: { 
    enabled: true,
    requireEmailVerification: false,
  },
  socialProviders: {},
  trustedOrigins: ["http://localhost:5173", "http://localhost:5174", "https://nvn.vercel.app"],
  plugins: [
    twoFactor({
      issuer: "nvn", 
    }),
    admin(),
    organization({
      requireEmailVerificationOnInvitation: false, // Start with false for development
      async sendInvitationEmail(data) {
        // TODO: Implement email sending logic
        // For now, just log the invitation details
        console.log('Organization invitation:', {
          email: data.email,
          organizationName: data.organization.name,
          inviterName: data.inviter.user.name,
          role: data.role,
          invitation: data.invitation
        });
      },
      organizationDeletion: {
        disabled: false,
        beforeDelete: async (data, request) => {
          console.log('Organization deletion started:', data.organization.id);
        },
        afterDelete: async (data, request) => {
          console.log('Organization deleted:', data.organization.id);
        }
      },
      teams: {
        enabled: true,
        maximumTeams: 50, // Allow up to 50 teams per organization
        allowRemovingAllTeams: false // Prevent removing the last team
      }
    }),
    // Integrate Polar plugin if available
    ...(polarPlugin ? [polarPlugin] : [])
  ]
});