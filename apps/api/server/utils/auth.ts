import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db/db";
import { schema } from "@/db/schema";
import { twoFactor, admin, organization } from "better-auth/plugins";
import { setupPolarForBetterAuth } from "@buncn/payments/server";

// Setup Polar configuration conditionally
function getPolarPlugin() {
  try {
    const polarConfig = setupPolarForBetterAuth();
    return polarConfig ? polarConfig.plugin : null;
  } catch (error) {
    console.warn('Polar configuration not available:', error.message);
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
  trustedOrigins: ["http://localhost:5173", "http://localhost:5174", "https://vitro.vercel.app"],
  plugins: [
    twoFactor({
      issuer: "Vitro", 
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