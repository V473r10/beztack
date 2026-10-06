/**
 * App roles and Organization roles, parsed the same way by the API and the UI.
 *
 * better-auth stores a role as a single string, a comma-separated string or an
 * array depending on the plugin and the caller. Substring checks such as
 * `role.includes("sudo")` are wrong on a string (`"pseudo"` contains `"sudo"`),
 * so every check goes through {@link getAuthRoles}, which splits the value into
 * exact role names first.
 */

/** Default App roles. A derived project may add its own (see {@link hasAuthRole}). */
export const APP_ROLES = ["sudo", "user"] as const;

export type AppRole = (typeof APP_ROLES)[number];

/** App role every signed-in user has when better-auth stored none. */
export const DEFAULT_APP_ROLE: AppRole = "user";

/** Default Organization roles, lowest rank first: `member < admin < owner`. */
export const ORGANIZATION_ROLES = ["member", "admin", "owner"] as const;

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

/** Rank given to a missing or unknown role: below every known role. */
export const UNKNOWN_ROLE_RANK = -1;

function parseRoleList(role: unknown): string[] {
  if (Array.isArray(role)) {
    return role
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  if (typeof role === "string") {
    return role
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  return [];
}

/**
 * Normalise a better-auth App role value into exact role names.
 * A missing or empty value yields `["user"]`.
 */
export function getAuthRoles(role: unknown): string[] {
  const roles = parseRoleList(role);
  return roles.length > 0 ? roles : [DEFAULT_APP_ROLE];
}

/**
 * Whether the App role value contains exactly `expected`.
 *
 * A derived project that adds App roles widens the type parameter:
 * `hasAuthRole<AppRole | "consumer">(role, "consumer")`.
 */
export function hasAuthRole<Role extends string = AppRole>(role: unknown, expected: Role): boolean {
  return getAuthRoles(role).includes(expected);
}

export type OrganizationRoleRanking<Role extends string> = {
  /** Roles lowest rank first. */
  readonly roles: readonly Role[];
  /** Rank of the highest known role in the value, or {@link UNKNOWN_ROLE_RANK}. */
  rankOf(role: unknown): number;
  /** Whether the value holds a role ranked at least as high as `required`. */
  hasAtLeast(role: unknown, required: Role): boolean;
};

/**
 * Build an Organization role ranking from roles listed lowest rank first.
 * A derived project that adds Organization roles builds its own ranking.
 */
export function createOrganizationRoleRanking<const Role extends string>(
  roles: readonly Role[],
): OrganizationRoleRanking<Role> {
  const rankByRole = new Map<string, number>(roles.map((role, index) => [role, index]));

  const rankOf = (role: unknown): number =>
    parseRoleList(role).reduce(
      (highest, entry) => Math.max(highest, rankByRole.get(entry) ?? UNKNOWN_ROLE_RANK),
      UNKNOWN_ROLE_RANK,
    );

  return {
    roles,
    rankOf,
    hasAtLeast(role, required) {
      const requiredRank = rankByRole.get(required) ?? UNKNOWN_ROLE_RANK;
      const actualRank = rankOf(role);
      return actualRank !== UNKNOWN_ROLE_RANK && actualRank >= requiredRank;
    },
  };
}

/** The default `member < admin < owner` ranking. */
export const organizationRoleRanking = createOrganizationRoleRanking(ORGANIZATION_ROLES);

export function getOrganizationRoleRank(role: unknown): number {
  return organizationRoleRanking.rankOf(role);
}

export function hasOrganizationRoleAtLeast(role: unknown, required: OrganizationRole): boolean {
  return organizationRoleRanking.hasAtLeast(role, required);
}
