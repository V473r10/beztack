import { Polar } from "@polar-sh/sdk";
import { defineEventHandler } from "h3";
import { env } from "@/env";

export default defineEventHandler(async (_event) => {
  const polar = new Polar({
    accessToken: env.POLAR_ACCESS_TOKEN,
    server: env.POLAR_SERVER,
  });

  const result = await polar.customerSessions.create({
    customerId: "customer-id",
  });

  return result.customerPortalUrl;
});
