import { describe, expect, it } from "vitest";
import { isAllowlistedAppAdminEmail, isAppAdminActor, parseAppAdminEmails } from "./app-admin";

describe("parseAppAdminEmails", () => {
  it("splits, trims, lowercases and drops empty entries", () => {
    expect(parseAppAdminEmails(" Admin@Example.com , ,ops@example.com,")).toEqual([
      "admin@example.com",
      "ops@example.com",
    ]);
    expect(parseAppAdminEmails("")).toEqual([]);
  });
});

describe("isAllowlistedAppAdminEmail", () => {
  it("matches case- and whitespace-insensitively and rejects a missing email", () => {
    expect(isAllowlistedAppAdminEmail(" ADMIN@example.com ", ["admin@example.com"])).toBe(true);
    expect(isAllowlistedAppAdminEmail("other@example.com", ["admin@example.com"])).toBe(false);
    expect(isAllowlistedAppAdminEmail(null, ["admin@example.com"])).toBe(false);
  });
});

describe("isAppAdminActor", () => {
  const appAdminEmails = ["admin@example.com"];
  const actor = (role: string | string[] | null) => ({
    id: "user_1",
    email: "Admin@Example.com",
    role,
  });

  it("requires the exact sudo App role and an allowlisted email", () => {
    expect(isAppAdminActor(actor("sudo"), appAdminEmails)).toBe(true);
    expect(isAppAdminActor(actor(["user", "sudo"]), appAdminEmails)).toBe(true);
    expect(isAppAdminActor(actor("sudo"), ["someone@example.com"])).toBe(false);
  });

  it('does not read "pseudo" or a role merely containing "sudo" as sudo', () => {
    expect(isAppAdminActor(actor("pseudo"), appAdminEmails)).toBe(false);
    expect(isAppAdminActor(actor("sudoer"), appAdminEmails)).toBe(false);
    expect(isAppAdminActor(actor("user,revoked-sudo"), appAdminEmails)).toBe(false);
    expect(isAppAdminActor(actor(null), appAdminEmails)).toBe(false);
  });
});
