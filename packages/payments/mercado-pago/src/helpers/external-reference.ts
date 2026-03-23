const EXTERNAL_REFERENCE_PREFIX = "beztack_";

type ExternalReferenceMetadata = {
  userId?: string;
  organizationId?: string;
  referenceId?: string;
  tier?: string;
  proratedUpgrade?: boolean;
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

export function encodeExternalReference(options: {
  customerId?: string;
  metadata?: Record<string, unknown>;
}): string | undefined {
  const userId = readString(options.metadata, "userId") ?? options.customerId;
  const organizationId = readString(options.metadata, "organizationId");
  const referenceId = readString(options.metadata, "referenceId");
  const tier = readString(options.metadata, "tier");
  const previousSubscriptionId = readString(
    options.metadata,
    "previousSubscriptionId"
  );

  const parts: string[] = [];
  if (userId) {
    parts.push(`uid=${userId}`);
  }
  if (organizationId) {
    parts.push(`org=${organizationId}`);
  }
  if (tier) {
    parts.push(`tier=${tier}`);
  }
  if (referenceId) {
    parts.push(`ref=${referenceId}`);
  }

  const proratedUpgrade =
    options.metadata?.proratedUpgrade === true ||
    options.metadata?.proratedUpgrade === "true";
  if (proratedUpgrade) {
    parts.push("prorated=1");
  }

  if (previousSubscriptionId) {
    parts.push(`prev=${previousSubscriptionId}`);
  }

  const fullAmount = options.metadata?.fullAmount;
  if (typeof fullAmount === "number" || typeof fullAmount === "string") {
    parts.push(`fullamt=${fullAmount}`);
  }

  const targetPlanId =
    typeof options.metadata?.targetPlanId === "string"
      ? options.metadata.targetPlanId
      : undefined;
  if (targetPlanId) {
    parts.push(`tplan=${targetPlanId}`);
  }

  if (parts.length === 0) {
    return options.customerId ?? referenceId;
  }
  const result = `${EXTERNAL_REFERENCE_PREFIX}${parts.join("&")}`;

  return result;
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
