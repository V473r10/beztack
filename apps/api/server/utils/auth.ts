import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db/db";
import { schema } from "@/db/schema";
import { twoFactor, admin } from "better-auth/plugins";

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
    admin()
  ]
});