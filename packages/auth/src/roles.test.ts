import { describe, expect, it } from "vitest";
import {
  APP_ROLES,
  ORGANIZATION_ROLES,
  createOrganizationRoleRanking,
  getAuthRoles,
  getOrganizationRoleRank,
  hasAuthRole,
  hasOrganizationRoleAtLeast,
} from "./roles.js";

describe("getAuthRoles", () => {
  it("parses a single role", () => {
    expect(getAuthRoles("sudo")).toEqual(["sudo"]);
  });

  it("parses a comma-separated role string and trims entries", () => {
    expect(getAuthRoles(" user , sudo ,")).toEqual(["user", "sudo"]);
  });

  it("keeps only string entries of a role array", () => {
    expect(getAuthRoles(["sudo", 42, " user ", ""])).toEqual(["sudo", "user"]);
  });

  it("falls back to the default user role when the role is missing or empty", () => {
    expect(getAuthRoles(undefined)).toEqual(["user"]);
    expect(getAuthRoles(null)).toEqual(["user"]);
    expect(getAuthRoles("")).toEqual(["user"]);
    expect(getAuthRoles("  ")).toEqual(["user"]);
    expect(getAuthRoles([])).toEqual(["user"]);
    expect(getAuthRoles({ role: "sudo" })).toEqual(["user"]);
  });
});

describe("hasAuthRole", () => {
  it("matches an exact App role", () => {
    expect(hasAuthRole("sudo", "sudo")).toBe(true);
    expect(hasAuthRole("user,sudo", "sudo")).toBe(true);
    expect(hasAuthRole(["user", "sudo"], "sudo")).toBe(true);
  });

  it('never matches "sudo" inside "pseudo" or any role merely containing it', () => {
    expect(hasAuthRole("pseudo", "sudo")).toBe(false);
    expect(hasAuthRole(["pseudo"], "sudo")).toBe(false);
    expect(hasAuthRole("user,pseudo", "sudo")).toBe(false);
    expect(hasAuthRole("sudoer", "sudo")).toBe(false);
    expect(hasAuthRole("revoked-sudo", "sudo")).toBe(false);
  });

  it("treats a missing role as the default user role", () => {
    expect(hasAuthRole(undefined, "user")).toBe(true);
    expect(hasAuthRole(undefined, "sudo")).toBe(false);
  });

  it("accepts roles a derived project adds", () => {
    type DerivedRole = (typeof APP_ROLES)[number] | "consumer";
    expect(hasAuthRole<DerivedRole>("consumer", "consumer")).toBe(true);
    expect(hasAuthRole<DerivedRole>("user", "consumer")).toBe(false);
  });
});

describe("App roles", () => {
  it("are sudo and user", () => {
    expect(APP_ROLES).toEqual(["sudo", "user"]);
  });
});

describe("Organization role ranking", () => {
  it("orders member < admin < owner", () => {
    expect(ORGANIZATION_ROLES).toEqual(["member", "admin", "owner"]);
    expect(getOrganizationRoleRank("member")).toBeLessThan(getOrganizationRoleRank("admin"));
    expect(getOrganizationRoleRank("admin")).toBeLessThan(getOrganizationRoleRank("owner"));
  });

  it("ranks an unknown or missing role below every known role", () => {
    expect(getOrganizationRoleRank("guest")).toBeLessThan(getOrganizationRoleRank("member"));
    expect(getOrganizationRoleRank(undefined)).toBeLessThan(getOrganizationRoleRank("member"));
  });

  it("uses the highest role of a multi-role value", () => {
    expect(getOrganizationRoleRank("member,owner")).toBe(getOrganizationRoleRank("owner"));
  });

  it("lets a higher role pass a lower requirement", () => {
    expect(hasOrganizationRoleAtLeast("owner", "admin")).toBe(true);
    expect(hasOrganizationRoleAtLeast("admin", "admin")).toBe(true);
    expect(hasOrganizationRoleAtLeast("member", "admin")).toBe(false);
    expect(hasOrganizationRoleAtLeast(undefined, "member")).toBe(false);
    expect(hasOrganizationRoleAtLeast("pseudo-owner", "member")).toBe(false);
  });

  it("can be extended by a derived project", () => {
    const ranking = createOrganizationRoleRanking(["rider", "member", "admin", "owner"]);
    expect(ranking.roles).toEqual(["rider", "member", "admin", "owner"]);
    expect(ranking.hasAtLeast("rider", "member")).toBe(false);
    expect(ranking.hasAtLeast("member", "rider")).toBe(true);
    expect(ranking.rankOf("owner")).toBe(3);
  });
});
