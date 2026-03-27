/**
 * Payment provider configuration
 *
 * Centralizes product ID mappings for auth plugin integration.
 * Previously hardcoded in apps/api/server/utils/auth.ts.
 */
import { env } from "@/env";

export type ProductMapping = {
  productId: string;
  slug: string;
};

export function getPolarProductMappings(): ProductMapping[] {
  return [
    { productId: env.POLAR_BASIC_MONTHLY_PRODUCT_ID, slug: "basic-monthly" },
    { productId: env.POLAR_BASIC_YEARLY_PRODUCT_ID, slug: "basic-yearly" },
    { productId: env.POLAR_PRO_MONTHLY_PRODUCT_ID, slug: "pro-monthly" },
    { productId: env.POLAR_PRO_YEARLY_PRODUCT_ID, slug: "pro-yearly" },
    {
      productId: env.POLAR_ULTIMATE_MONTHLY_PRODUCT_ID,
      slug: "ultimate-monthly",
    },
    {
      productId: env.POLAR_ULTIMATE_YEARLY_PRODUCT_ID,
      slug: "ultimate-yearly",
    },
  ];
}
