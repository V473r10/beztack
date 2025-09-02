import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db/db";
import { schema } from "@/db/schema";
import { twoFactor } from "better-auth/plugins";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: schema }),
  emailAndPassword: { 
    enabled: true,
    requireEmailVerification: false,
  },
  socialProviders: {},
  trustedOrigins: ["http://localhost:5173", "https://vitro.vercel.app"],
  plugins: [
    twoFactor()
  ]
});