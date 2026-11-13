import { describe, expect, it } from "vitest";
import { evaluatePasswordRules } from "./password-rules";

const metIds = (password: string) =>
  evaluatePasswordRules(password)
    .filter((rule) => rule.met)
    .map((rule) => rule.id);

describe("evaluatePasswordRules", () => {
  it("meets nothing for an empty password", () => {
    expect(metIds("")).toEqual([]);
  });

  it("reports each rule independently", () => {
    expect(metIds("abc")).toEqual(["lowercase"]);
    expect(metIds("ABC")).toEqual(["uppercase"]);
    expect(metIds("123")).toEqual(["number"]);
    expect(metIds("!!!")).toEqual(["special"]);
    expect(metIds("abcdefgh")).toEqual(["length", "lowercase"]);
  });

  it("lists the rules in the order the checklist shows them", () => {
    expect(evaluatePasswordRules("").map((rule) => rule.id)).toEqual([
      "length",
      "uppercase",
      "lowercase",
      "number",
      "special",
    ]);
  });
});

describe("all rules met", () => {
  const allMet = (password: string) => evaluatePasswordRules(password).every((rule) => rule.met);

  it("needs every rule", () => {
    expect(allMet("Abcdef1!")).toBe(true); // ggignore: test fixture, not a credential
    expect(allMet("Abcdef1")).toBe(false); // ggignore: test fixture, not a credential
    expect(allMet("abcdef1!")).toBe(false); // ggignore: test fixture, not a credential
  });
});
