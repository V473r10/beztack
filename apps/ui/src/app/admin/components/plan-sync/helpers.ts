import { majorToMinor } from "@beztack/payments/money";
import type { DbPlan, EditState, SyncedPlanView } from "./types";

export function planToEditState(plan: DbPlan): EditState {
  return {
    canonicalTierId: plan.canonicalTierId,
    displayName: plan.displayName,
    description: plan.description ?? "",
    features: (plan.features ?? []).join("\n"),
    limits: plan.limits ? JSON.stringify(plan.limits, null, 2) : "{}",
    permissions: (plan.permissions ?? []).join("\n"),
    displayOrder: plan.displayOrder,
    highlighted: plan.highlighted ?? false,
    soon: plan.soon,
    visible: plan.visible ?? true,
  };
}

export function getPlanDisplayName(view: SyncedPlanView): string {
  if (view.localPlan) {
    return view.localPlan.displayName;
  }
  if (view.remoteProduct) {
    return view.remoteProduct.name;
  }
  return "Unknown Plan";
}

export function getPlanKey(view: SyncedPlanView): string {
  if (view.localPlan) {
    return view.localPlan.id;
  }
  if (view.remoteProduct) {
    return `remote-${view.remoteProduct.id}`;
  }
  return `unknown-${Math.random()}`;
}

/**
 * The price an App admin typed in a form (`"9.99"`, in the plan's currency) as
 * the integer minor units the API takes (ADR 0007). `null` when it is not a
 * positive amount or the currency is not an ISO 4217 code.
 */
export function priceInputToMinorUnits(input: string, currency: string): number | null {
  const major = Number.parseFloat(input);
  if (!(Number.isFinite(major) && major > 0)) {
    return null;
  }
  try {
    const minor = majorToMinor(major, currency.trim().toUpperCase(), {
      rounding: "half-away-from-zero",
    });
    return minor > 0 ? minor : null;
  } catch {
    return null;
  }
}
