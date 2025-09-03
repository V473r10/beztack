import { adminClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
export const authClient = createAuthClient({
	/** The base URL of the server (optional if you're using the same domain) */
	baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
	fetchOptions: {
		credentials: "include",
	},
	plugins: [twoFactorClient(), adminClient()],
});
