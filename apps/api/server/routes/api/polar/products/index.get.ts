import { createPolarClient } from "@nvn/payments/server";
import { defineEventHandler } from "h3";


interface ProductsByFrequency {
    monthly: Object | null;
    yearly: Object | null;
}

export default defineEventHandler(async (event) => {
  const polar = createPolarClient();

  const products = await polar.products.list({
    organizationId: process.env.POLAR_ORGANIZATION_ID,
    isArchived: false
  });

  const productsByFrequency: ProductsByFrequency = {
    monthly: products.result.items.find(item => item.metadata["frequency"] === "month") || null,
    yearly: products.result.items.find(item => item.metadata["frequency"] === "year") || null
  };

  return productsByFrequency;
});