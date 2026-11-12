import { defineNitroPlugin } from "nitropack/runtime";
import { env } from "@/env";
import { isDemoBlockedPath } from "@/server/utils/demo-guards";

const HTTP_FORBIDDEN = 403;

/** In demo mode, refuses the unauthenticated email routes (docs/demo.md). */
export default defineNitroPlugin((nitroApp) => {
  if (!env.DEMO_MODE) {
    return;
  }

  nitroApp.hooks.hook("request", (event) => {
    const pathname = new URL(event.node.req.url ?? "/", "http://localhost").pathname;
    if (isDemoBlockedPath(pathname)) {
      event.node.res.statusCode = HTTP_FORBIDDEN;
      event.node.res.setHeader("Content-Type", "application/json");
      event.node.res.end(JSON.stringify({ statusMessage: "Disabled in the demo" }));
    }
  });
});
