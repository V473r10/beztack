import { env } from "@/env";
import type { CreatePlanState } from "./types";

export const TIER_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "basic", label: "Basic" },
  { value: "pro", label: "Pro" },
  { value: "ultimate", label: "Ultimate" },
  { value: "custom", label: "Custom" },
];

export const INTERVAL_OPTIONS = [
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
];

export const MP_INTERVAL_OPTIONS = [{ value: "month", label: "Month" }];

/**
 * Pushing a plan to the payment provider sends its stored price as-is, and the
 * stored price is not yet in the provider's unit (it would arrive 100x off).
 * Keep this `false` until the minor-unit price contract lands (BZ-105, tickets 05-08).
 */
export const PLAN_SYNC_PUSH_ENABLED = false;

export const PLAN_SYNC_PUSH_DISABLED_TITLE =
  "Disabled until prices use one unit across the app and the payment provider";

export const MAX_FEATURES_DISPLAY = 4;
// biome-ignore lint/style/noMagicNumbers: Skeleton items array
export const SKELETON_ITEMS = [1, 2, 3, 4] as const;

export const INITIAL_CREATE_STATE: CreatePlanState = {
  displayName: "",
  description: "",
  canonicalTierId: "basic",
  price: "",
  currency: env.VITE_DEFAULT_CURRENCY,
  interval: "month",
  intervalCount: "1",
  features: "",
  limits: "{}",
  permissions: "",
  displayOrder: "",
  highlighted: false,
  soon: false,
  visible: true,
};
