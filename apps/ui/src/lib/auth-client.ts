import { polarClient } from "@polar-sh/better-auth";
import {
  adminClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Determine the base URL based on environment
const getBaseURL = () => {
  // In production, use the proxy route
  if (window.location.hostname === "acervus-ui.vercel.app") {
    return "/api";
  }
  // In development or other environments, use the configured URL
  return import.meta.env.VITE_API_URL || "http://localhost:3000";
};

export const authClient = createAuthClient({
  /** The base URL of the server (optional if you're using the same domain) */
  baseURL: getBaseURL(),
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
