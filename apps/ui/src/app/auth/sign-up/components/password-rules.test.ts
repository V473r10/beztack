import { describe, expect, it } from "vitest";
import { evaluatePasswordRules, isPasswordValid } from "./password-rules";

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

describe("isPasswordValid", () => {
  it("needs every rule", () => {
    expect(isPasswordValid("Abcdef1!")).toBe(true);
    expect(isPasswordValid("Abcdef1")).toBe(false);
    expect(isPasswordValid("abcdef1!")).toBe(false);
  });
});
