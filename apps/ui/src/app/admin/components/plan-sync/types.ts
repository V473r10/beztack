export type SyncStatus =
  | "synced"
  | "local-only"
  | "remote-only"
  | "out-of-sync";

export type SyncDiff = {
  field: string;
  localValue: unknown;
  remoteValue: unknown;
};

export type Product = {
  id: string;
  name: string;
  description?: string;
  type: string;
  price: { amount: number; currency: string };
  interval: string;
  intervalCount: number;
  metadata?: Record<string, unknown>;
};

export type DbPlan = {
  id: string;
  provider: string;
  providerPlanId: string | null;
  canonicalTierId: string;
  displayName: string;
  description: string | null;
  features: string[] | null;
  limits: Record<string, number> | null;
  permissions: string[] | null;
  price: string;
  currency: string;
  interval: string | null;
  intervalCount: number | null;
  displayOrder: number | null;
  highlighted: boolean | null;
  visible: boolean | null;
  status: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SyncedPlanView = {
  localPlan: DbPlan | null;
  remoteProduct: Product | null;
  syncStatus: SyncStatus;
  diffs: SyncDiff[];
};

export type EditState = {
  canonicalTierId: string | null;
  displayName: string;
  description: string;
  features: string;
  limits: string;
  permissions: string;
  displayOrder: number | null;
  highlighted: boolean;
  visible: boolean;
};

export type CreatePlanState = {
  displayName: string;
  description: string;
  canonicalTierId: string;
  price: string;
  currency: string;
  interval: string;
  intervalCount: string;
  features: string;
  limits: string;
  permissions: string;
  displayOrder: string;
  highlighted: boolean;
  visible: boolean;
};
