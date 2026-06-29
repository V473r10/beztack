#!/usr/bin/env node
/**
 * Beztack-owned Trusted Derived project registry.
 *
 * Implements the registry contract from issue #32. Trust is granted by
 * Beztack through a Beztack-owned registry file, not self-declared by
 * Derived projects (ADR-0006). The registry lives outside the Derived
 * project tree and is read-only from a Derived project's perspective.
 *
 * Public interface (kept small so the engine and tests cross the same
 * seam):
 *
 *   - loadRegistry(registryPath) -> parsed, schema-validated registry
 *   - resolveTrustClass(registry, derivedProjectId)
 *       -> { trustClass, entry, source }
 *       source ∈ {"registry-listed", "registry-absent-default-community",
 *                 "registry-revoked-default-community"}
 *   - assertRegistryMatches(derivedProjectId, request)
 *       -> throws if a Derived project owner attempts to escalate trust
 *          beyond what the registry grants (e.g. a copied project trying
 *          to self-declare trusted status)
 *
 * A separate `formatRegistryNotice` helper renders the registry decision
 * into a Markdown block for status / apply / BRANCH_README output. The
 * registry itself never mutates engine state; it only informs the
 * engine's trust decision.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validate } from "./validate.mjs";

export const REGISTRY_SCHEMA = "derived-project-registry";

export const DEFAULT_REGISTRY_PATH = "beztack/derived-project-registry.json";

export class RegistryError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = "RegistryError";
    this.code = code;
    if (detail !== undefined) this.detail = detail;
  }
}

export async function loadRegistry(registryPath, schemas) {
  const absolute = resolve(registryPath);
  let raw;
  try {
    raw = await readFile(absolute, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new RegistryError(
        "registry-missing",
        `Trusted Derived project registry not found at ${absolute}. Engines must refuse to plan or apply without a Beztack-owned registry because trust must not be self-declared by Derived projects (ADR-0006).`,
        { path: absolute }
      );
    }
    throw err;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new RegistryError(
      "registry-unparseable",
      `Trusted Derived project registry at ${absolute} is not valid JSON: ${err.message}`,
      { path: absolute }
    );
  }
  if (!schemas || !schemas[REGISTRY_SCHEMA]) {
    throw new RegistryError(
      "registry-schema-missing",
      `Trusted Derived project registry schema ('${REGISTRY_SCHEMA}') is not loaded. The engine cannot validate registry inputs without it.`,
      { path: absolute }
    );
  }
  const error = validate(parsed, schemas[REGISTRY_SCHEMA]);
  if (error) {
    throw new RegistryError(
      "registry-schema-invalid",
      `Trusted Derived project registry at ${absolute} failed schema validation: ${error}`,
      { path: absolute, schemaError: error }
    );
  }
  return { path: absolute, value: parsed };
}

/**
 * Resolve the trust class for a Derived project ID against the registry.
 * Trust decisions are one-way:
 *   - If the ID is in the registry and not revoked, the trust class is
 *     "trusted" (the only trust class the registry records).
 *   - If the ID is in the registry but revoked, the trust class falls
 *     back to "community" and the source marks it as revoked.
 *   - If the ID is absent, the trust class is "community" and the source
 *     marks it as absent. A copied Community Derived project that
 *     happens to share an ID with a Trusted entry still receives
 *     community trust unless Beztack re-issues the registry.
 *
 * Returns:
 *   {
 *     trustClass: "trusted" | "community",
 *     entry: <registry entry> | null,
 *     source: "registry-listed" |
 *             "registry-revoked-default-community" |
 *             "registry-absent-default-community",
 *     note: string
 *   }
 */
export function resolveTrustClass(registry, derivedProjectId) {
  const entries = registry?.value?.entries ?? [];
  const entry = entries.find((e) => e.derivedProjectId === derivedProjectId);
  if (!entry) {
    return {
      trustClass: "community",
      entry: null,
      source: "registry-absent-default-community",
      note:
        `Derived project ID ${derivedProjectId} is not on the Beztack-owned ` +
        `registry snapshot; trust class defaults to community. The maintainer ` +
        `consumes releases via local tooling without Beztack-held permissions.`,
    };
  }
  if (typeof entry.revokedAt === "string" && entry.revokedAt.length > 0) {
    return {
      trustClass: "community",
      entry,
      source: "registry-revoked-default-community",
      note:
        `Derived project ID ${derivedProjectId} was on the Beztack-owned ` +
        `registry but the trust grant was revoked at ${entry.revokedAt}. ` +
        `Engines must treat the project as community trust regardless of ` +
        `the entry's stored trustClass.`,
    };
  }
  return {
    trustClass: entry.trustClass,
    entry,
    source: "registry-listed",
    note:
      `Derived project ID ${derivedProjectId} is on the Beztack-owned ` +
      `registry; trust class is ${entry.trustClass}.`,
  };
}

/**
 * Refuse trust escalations that the registry does not authorize.
 *
 * A Derived project owner may run the engine with a CLI hint such as
 * `--trust-class trusted` to advertise intent, but the registry is the
 * source of truth. This function refuses to grant trust when the
 * requested trust class exceeds what the registry allows. It is a
 * no-op (returns null) when the request matches or is below the
 * registry grant, so Community projects can still run the engine and
 * force the community class explicitly.
 *
 * Returns null on success or throws a RegistryError on refusal.
 */
export function assertRegistryMatches(derivedProjectId, resolved, request) {
  if (!request || request === resolved.trustClass) return null;
  if (resolved.trustClass === "trusted" && request === "community") {
    // Caller asked for community but registry says trusted. This is
    // allowed: a Trusted Derived project maintainer may opt out of
    // trusted dispatch for a single run by passing --trust-class
    // community. The engine honors the caller's intent for that run.
    return null;
  }
  if (request === "trusted" && resolved.trustClass !== "trusted") {
    const detail =
      resolved.source === "registry-absent-default-community"
        ? "the Derived project ID is not on the Beztack-owned registry"
        : resolved.source === "registry-revoked-default-community"
          ? "the registry entry was revoked"
          : "the registry grants a different trust class";
    throw new RegistryError(
      "trust-escalation-refused",
      `Refused to grant trust class "trusted" for Derived project ${derivedProjectId}: ${detail}. Beztack decides trust through its registry; Derived projects cannot self-declare trusted status (ADR-0006).`,
      {
        derivedProjectId,
        registrySource: resolved.source,
        requestedTrustClass: request,
        registryTrustClass: resolved.trustClass,
      }
    );
  }
  return null;
}

/**
 * Render a short Markdown block describing the registry decision. Used
 * by the human-readable status / apply / BRANCH_README views.
 */
export function formatRegistryNotice({ resolved, registry }) {
  const lines = [];
  const meta = registry?.value;
  if (meta) {
    lines.push(`- **Registry:** \`${meta.registryId}\` (version \`${meta.registryVersion}\`, issued \`${meta.issuedAt}\`)`);
  }
  lines.push(`- **Trust class:** \`${resolved.trustClass}\``);
  lines.push(`- **Trust source:** \`${resolved.source}\``);
  if (resolved.entry?.repository) {
    const repo = resolved.entry.repository;
    lines.push(`- **Repository:** \`${repo.canonicalUrl}\``);
    if (repo.displayName) lines.push(`- **Display name:** \`${repo.displayName}\``);
    if (Array.isArray(repo.knownUrls) && repo.knownUrls.length > 1) {
      lines.push(`- **Known remote URLs (rename history):** ${repo.knownUrls.map((u) => `\`${u}\``).join(", ")}`);
    }
  }
  if (resolved.source !== "registry-listed") {
    lines.push(
      `- **Note:** ${resolved.note}`
    );
  }
  return lines.join("\n");
}

/**
 * Build the structured registry-decision payload that the engine
 * attaches to sync-state, apply-plan, and promotion-metadata outputs.
 * The shape is intentionally small so the schemas can pin it tightly.
 */
export function buildRegistryDecision({ derivedProjectId, registry }) {
  const resolved = resolveTrustClass(registry, derivedProjectId);
  const out = {
    trustClass: resolved.trustClass,
    source: resolved.source,
    note: resolved.note,
    repository: null,
  };
  if (registry?.value) {
    out.registryId = registry.value.registryId;
    out.registryVersion = registry.value.registryVersion;
  }
  if (resolved.entry?.repository) {
    out.repository = {
      canonicalUrl: resolved.entry.repository.canonicalUrl,
      displayName: resolved.entry.repository.displayName ?? null,
      knownUrls: resolved.entry.repository.knownUrls ?? [],
    };
  }
  return { resolved, payload: out };
}