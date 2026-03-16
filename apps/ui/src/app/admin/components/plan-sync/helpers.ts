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
    visible: plan.visible ?? true,
  };
}

export function formatPrice(amount: number | string, currency: string): string {
  const num = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  return `${num.toFixed(2)} ${currency}`;
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
