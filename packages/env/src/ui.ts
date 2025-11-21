import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Environment configuration for UI (Vite) applications
 * Uses @t3-oss/env-core with clientPrefix for client-side validation
 */
export const env = createEnv({
  /**
   * The prefix that client-side variables must have in Vite.
   * This is enforced both at a type-level and at runtime.
   */
  clientPrefix: "VITE_",

  /**
   * Specify your client-side environment variables schema here.
   * These variables are exposed to the client.
   */
  client: {
    VITE_API_URL: z.string().url().default("http://localhost:3000"),
    VITE_BASE_PATH: z.string().default("/").optional(),
  },

  /**
   * What object holds the environment variables at runtime.
   * For Vite, this is `import.meta.env`.
   */
  runtimeEnv: import.meta.env,

  /**
   * Makes it so empty strings are treated as undefined.
   * `SOME_VAR: z.string()` and `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
