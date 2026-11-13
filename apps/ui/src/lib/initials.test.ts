import { describe, expect, it } from "vitest";
import { getInitials } from "./initials";

describe("getInitials", () => {
  it("uses the first letters of the first and last name", () => {
    expect(getInitials({ name: "Ada Lovelace", email: "ada@example.com" })).toBe("AL");
    expect(getInitials({ name: "Grace Brewster Murray Hopper" })).toBe("GH");
  });

  it("uses one letter for a single name", () => {
    expect(getInitials({ name: "ada" })).toBe("A");
  });

  it("ignores extra whitespace", () => {
    expect(getInitials({ name: "  ada   lovelace  " })).toBe("AL");
  });

  it("falls back to the email when there is no name", () => {
    expect(getInitials({ name: "", email: "ada.lovelace@example.com" })).toBe("A");
    expect(getInitials({ email: "zed@example.com" })).toBe("Z");
  });

  it("returns an empty string when there is nothing to go on", () => {
    expect(getInitials({})).toBe("");
    expect(getInitials({ name: " ", email: "" })).toBe("");
  });

  it("keeps non-latin letters intact", () => {
    expect(getInitials({ name: "Ñandú Pérez" })).toBe("ÑP");
  });
});
