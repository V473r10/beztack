import { defineNitroPlugin } from "nitropack/runtime";

// HTTP status code constants
const HTTP_NO_CONTENT = 204;

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173", // Vite preview
  "https://localhost:5173", // HTTPS local development
  "https://vitro-ui.vercel.app",
  "https://acervus-ui.vercel.app",
  "https://acervus-api.vercel.app", // Allow API domain for proxy requests
];

/**
 * Get the appropriate origin for CORS headers based on the request origin
 * @param requestOrigin - The origin from the request headers
 * @returns The origin to use in CORS headers, or null if not allowed
 */
function getAllowedOrigin(requestOrigin: string | undefined): string | null {
  if (!requestOrigin) {
    return null;
  }
  return ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : null;
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("request", (event) => {
    const requestOrigin = event.node.req.headers.origin as string | undefined;
    const allowedOrigin = getAllowedOrigin(requestOrigin);

    // Only set CORS headers if origin is allowed
    if (allowedOrigin) {
      // Handle preflight OPTIONS requests
      if (event.node.req.method === "OPTIONS") {
        event.node.res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
        event.node.res.setHeader(
          "Access-Control-Allow-Methods",
          "GET, POST, PUT, DELETE, OPTIONS"
        );
        event.node.res.setHeader(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization, Accept, Origin, X-Requested-With"
        );
        event.node.res.setHeader("Access-Control-Allow-Credentials", "true");
        event.node.res.setHeader("Access-Control-Max-Age", "86400");
        event.node.res.statusCode = HTTP_NO_CONTENT;
        event.node.res.end();
        return;
      }

      // Add CORS headers to all responses
      event.node.res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      event.node.res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      event.node.res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, Accept, Origin, X-Requested-With"
      );
      event.node.res.setHeader("Access-Control-Allow-Credentials", "true");
    }
  });
});
