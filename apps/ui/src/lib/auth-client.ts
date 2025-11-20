import { polarClient } from "@polar-sh/better-auth";
import {
  adminClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { env } from "@/env";

export const authClient = createAuthClient({
  /** The base URL of the server (optional if you're using the same domain) */
  baseURL: env.VITE_API_URL,
  fetchOptions: {
    credentials: "include",
  },
  plugins: [
    twoFactorClient(),
    adminClient(),
    organizationClient({
      teams: {
        enabled: true,
      },
    }),
    polarClient(),
  ],
});
