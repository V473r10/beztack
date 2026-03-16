import { env } from "@/env";
import type { CreatePlanState } from "./types";

export const API_URL = env.VITE_API_URL;

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

export const MAX_FEATURES_DISPLAY = 4;
export const QUERY_KEY = ["admin-plans-sync"] as const;
// biome-ignore lint/style/noMagicNumbers: Skeleton items array
export const SKELETON_ITEMS = [1, 2, 3, 4] as const;

export const INITIAL_CREATE_STATE: CreatePlanState = {
  displayName: "",
  description: "",
  canonicalTierId: "basic",
  price: "",
  currency: "USD",
  interval: "month",
  intervalCount: "1",
  features: "",
  limits: "{}",
  permissions: "",
  displayOrder: "",
  highlighted: false,
  visible: true,
};
