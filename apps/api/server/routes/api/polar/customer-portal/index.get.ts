import { Polar } from "@polar-sh/sdk";
import { defineEventHandler } from "h3";

export default defineEventHandler(async (_event) => {
  const polar = new Polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN,
    server: process.env.POLAR_SERVER as "production" | "sandbox",
  });

  const result = await polar.customerSessions.create({
    customerId: "customer-id",
  });

  return result.customerPortalUrl;
});
