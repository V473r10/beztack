export type OwnershipStrategy =
  | "template-owned"
  | "custom-owned"
  | "mixed";

export interface TemplateManifest {
  templateId: string;
  currentVersion: string;
  lastAppliedAt?: string;
  strategyByPath: Record<string, OwnershipStrategy>;
  customZones?: Record<string, string[]>;
  appliedMigrations: string[];
}

export type ChangeType = "add" | "modify" | "delete";

export interface FileChange {
  path: string;
  type: ChangeType;
  currentContent?: string;
  templateContent?: string;
  userModified?: boolean;
}

export interface PlannedChange extends FileChange {
  ownership: OwnershipStrategy;
  conflictReason?: string;
}

export interface UpdatePlan {
  changes: PlannedChange[];
  conflicts: PlannedChange[];
  skippedUnchangedTemplateFiles: number;
}
