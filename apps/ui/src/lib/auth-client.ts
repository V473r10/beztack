import {
  adminClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
// Note: @polar-sh/better-auth/client integration will be handled on the server side
// The client-side Polar functionality is exposed through the auth client after server setup
export const authClient = createAuthClient({
  /** The base URL of the server (optional if you're using the same domain) */
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
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
    // Polar client integration will be handled server-side
  ],
});
