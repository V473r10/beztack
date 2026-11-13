import { describe, expect, it } from "vitest";
import { focusFirstInvalidField, visibleFieldErrors } from "./form-errors";

const errors = [{ message: "Required" }];

describe("visibleFieldErrors", () => {
  it("shows every error when the form does not defer them", () => {
    expect(
      visibleFieldErrors(errors, { deferred: false, isBlurred: false, submissionAttempts: 0 }),
    ).toEqual(errors);
  });

  it("hides errors of a field the user has not left yet", () => {
    expect(
      visibleFieldErrors(errors, { deferred: true, isBlurred: false, submissionAttempts: 0 }),
    ).toEqual([]);
  });

  it("shows errors once the field was left", () => {
    expect(
      visibleFieldErrors(errors, { deferred: true, isBlurred: true, submissionAttempts: 0 }),
    ).toEqual(errors);
  });

  it("shows errors of untouched fields after a submit attempt", () => {
    expect(
      visibleFieldErrors(errors, { deferred: true, isBlurred: false, submissionAttempts: 1 }),
    ).toEqual(errors);
  });
});

describe("focusFirstInvalidField", () => {
  it("focuses the first control marked invalid", () => {
    const focused: string[] = [];
    const root = {
      querySelector: (selector: string) =>
        selector === '[aria-invalid="true"]' ? { focus: () => focused.push("email") } : null,
    };

    expect(focusFirstInvalidField(root)).toBe(true);
    expect(focused).toEqual(["email"]);
  });

  it("does nothing when no control is invalid", () => {
    expect(focusFirstInvalidField({ querySelector: () => null })).toBe(false);
    expect(focusFirstInvalidField(null)).toBe(false);
  });
});
