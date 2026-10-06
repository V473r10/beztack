import { describe, expect, it } from "vitest";
import { getPostSignInTarget, getSignInPath, withNext } from "./auth-redirect";

describe("getSignInPath", () => {
  it("carries the protected location as next", () => {
    expect(getSignInPath({ pathname: "/billing", search: "?plan=pro", hash: "#top" })).toBe(
      `/auth/sign-in?next=${encodeURIComponent("/billing?plan=pro#top")}`,
    );
  });

  it("omits next for the home page", () => {
    expect(getSignInPath({ pathname: "/", search: "", hash: "" })).toBe("/auth/sign-in");
  });

  it("omits next for a target that is not a safe in-app path", () => {
    expect(getSignInPath({ pathname: "//evil.example", search: "", hash: "" })).toBe(
      "/auth/sign-in",
    );
    expect(getSignInPath({ pathname: "/auth/sign-up", search: "", hash: "" })).toBe(
      "/auth/sign-in",
    );
  });
});

describe("getPostSignInTarget", () => {
  it("honours a safe next", () => {
    expect(getPostSignInTarget(`?next=${encodeURIComponent("/billing?plan=pro")}`)).toBe(
      "/billing?plan=pro",
    );
  });

  it("falls back to home without next", () => {
    expect(getPostSignInTarget("")).toBe("/");
  });

  it("rejects external and protocol-relative targets", () => {
    expect(getPostSignInTarget(`?next=${encodeURIComponent("https://evil.example")}`)).toBe("/");
    expect(getPostSignInTarget(`?next=${encodeURIComponent("//evil.example")}`)).toBe("/");
  });
});

describe("withNext", () => {
  it("passes a safe next on to the next auth step", () => {
    expect(withNext("/auth/sign-in/two-factor", "?next=%2Fbilling")).toBe(
      "/auth/sign-in/two-factor?next=%2Fbilling",
    );
  });

  it("drops an unsafe or missing next", () => {
    expect(withNext("/auth/sign-in/two-factor", "?next=%2F%2Fevil.example")).toBe(
      "/auth/sign-in/two-factor",
    );
    expect(withNext("/auth/sign-in/two-factor", "")).toBe("/auth/sign-in/two-factor");
  });
});
