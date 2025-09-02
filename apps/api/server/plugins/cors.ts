import { defineNitroPlugin } from "nitropack/runtime";

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("render:response", (response, { event }) => {
    if (!response.headers) {
      response.headers = {};
    }
    response.headers["Access-Control-Allow-Origin"] = "http://localhost:5173";
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS";
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Accept, Origin, X-Requested-With";
    response.headers["Access-Control-Allow-Credentials"] = "true";
  });

  nitroApp.hooks.hook("request", async (event) => {
    // Handle preflight OPTIONS requests
    if (event.node.req.method === "OPTIONS") {
      event.node.res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
      event.node.res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      event.node.res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, Origin, X-Requested-With");
      event.node.res.setHeader("Access-Control-Allow-Credentials", "true");
      event.node.res.setHeader("Access-Control-Max-Age", "86400");
      event.node.res.statusCode = 204;
      event.node.res.end();
      return;
    }

    // Add CORS headers to all responses
    event.node.res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
    event.node.res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    event.node.res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, Origin, X-Requested-With");
    event.node.res.setHeader("Access-Control-Allow-Credentials", "true");
  });
});