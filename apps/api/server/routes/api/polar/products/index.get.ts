import { createPolarClient } from "@nvn/payments/server";
import { defineEventHandler } from "h3";


interface ProductsByFrequency {
    monthly: Object;
    yearly: Object;
}

export default defineEventHandler(async (event) => {
  const polar = createPolarClient();

  const products = await polar.products.list({
    organizationId: process.env.POLAR_ORGANIZATION_ID,
    isArchived: false
  });

  const productsByFrequency: ProductsByFrequency = {
    monthly: products.result.items.find(item => item.metadata["frequency"] === "month"),
    yearly: products.result.items.find(item => item.metadata["frequency"] === "year")
  };

  return productsByFrequency;
});