const EXTERNAL_REFERENCE_PREFIX = "beztack_";

type ExternalReferenceMetadata = {
  userId?: string;
  organizationId?: string;
  referenceId?: string;
  tier?: string;
  proratedUpgrade?: boolean;
  proratedDowngrade?: boolean;
  previousTier?: string;
  fullAmount?: number;
  targetPlanId?: string;
  previousSubscriptionId?: string;
};

function readString(
  source: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  const value = source?.[key];
  return typeof value === "string" ? value : undefined;
}

function isTruthy(value: unknown): boolean {
  return value === true || value === "true";
}

function pushStringPart(
  parts: string[],
  key: string,
  value: string | undefined
): void {
  if (value) {
    parts.push(`${key}=${value}`);
  }
}

function buildReferenceParts(
  metadata: Record<string, unknown> | undefined,
  customerId: string | undefined
): string[] {
  const userId = readString(metadata, "userId") ?? customerId;
  const parts: string[] = [];

  pushStringPart(parts, "uid", userId);
  pushStringPart(parts, "org", readString(metadata, "organizationId"));
  pushStringPart(parts, "tier", readString(metadata, "tier"));
  pushStringPart(parts, "ref", readString(metadata, "referenceId"));

  if (isTruthy(metadata?.proratedUpgrade)) {
    parts.push("prorated=1");
  }
  if (isTruthy(metadata?.proratedDowngrade)) {
    parts.push("downgrade=1");
  }

  pushStringPart(parts, "prevtier", readString(metadata, "previousTier"));
  pushStringPart(parts, "prev", readString(metadata, "previousSubscriptionId"));

  const fullAmount = metadata?.fullAmount;
  if (typeof fullAmount === "number" || typeof fullAmount === "string") {
    parts.push(`fullamt=${fullAmount}`);
  }

  pushStringPart(parts, "tplan", readString(metadata, "targetPlanId"));

  return parts;
}

export function encodeExternalReference(options: {
  customerId?: string;
  metadata?: Record<string, unknown>;
}): string | undefined {
  const parts = buildReferenceParts(options.metadata, options.customerId);

  if (parts.length === 0) {
    const referenceId = readString(options.metadata, "referenceId");
    return options.customerId ?? referenceId;
  }

  return `${EXTERNAL_REFERENCE_PREFIX}${parts.join("&")}`;
}

export function decodeExternalReference(
  rawExternalReference?: string
): ExternalReferenceMetadata | undefined {
  if (!rawExternalReference) {
    return;
  }

  if (!rawExternalReference.startsWith(EXTERNAL_REFERENCE_PREFIX)) {
    return {
      userId: rawExternalReference,
      referenceId: rawExternalReference,
    };
  }

  const raw = rawExternalReference.slice(EXTERNAL_REFERENCE_PREFIX.length);
  const params = new URLSearchParams(raw);
  const metadata: ExternalReferenceMetadata = {};

  const userId = params.get("uid");
  if (userId) {
    metadata.userId = userId;
  }

  const organizationId = params.get("org");
  if (organizationId) {
    metadata.organizationId = organizationId;
  }

  const referenceId = params.get("ref");
  if (referenceId) {
    metadata.referenceId = referenceId;
  }

  const tier = params.get("tier");
  if (tier) {
    metadata.tier = tier;
  }

  const prorated = params.get("prorated");
  if (prorated === "1") {
    metadata.proratedUpgrade = true;
  }

  const downgrade = params.get("downgrade");
  if (downgrade === "1") {
    metadata.proratedDowngrade = true;
  }

  const previousTier = params.get("prevtier");
  if (previousTier) {
    metadata.previousTier = previousTier;
  }

  const previousSubscriptionId = params.get("prev");
  if (previousSubscriptionId) {
    metadata.previousSubscriptionId = previousSubscriptionId;
  }

  const fullAmount = params.get("fullamt");
  if (fullAmount) {
    metadata.fullAmount = Number(fullAmount);
  }

  const targetPlanId = params.get("tplan");
  if (targetPlanId) {
    metadata.targetPlanId = targetPlanId;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}
