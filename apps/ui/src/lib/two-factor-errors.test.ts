import { describe, expect, it } from "vitest";
import { twoFactor } from "better-auth/plugins";
import { twoFactorErrorKey } from "./two-factor-errors";

describe("twoFactorErrorKey", () => {
  it("translates invalid authenticator codes", () => {
    expect(twoFactorErrorKey("INVALID_CODE")).toBe(
      "notifications.twoFactor.errors.invalidTotpCode",
    );
  });
  it.each([
    ["INVALID_BACKUP_CODE", "backupCodeNotFound"],
    ["OTP_HAS_EXPIRED", "codeExpired"],
    ["TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE", "tooManyAttempts"],
    ["ACCOUNT_TEMPORARILY_LOCKED", "accountLocked"],
    ["INVALID_TWO_FACTOR_COOKIE", "invalidCookie"],
    ["OTP_NOT_ENABLED", "otpNotEnabled"],
    ["OTP_NOT_CONFIGURED", "otpNotConfigured"],
    ["TOTP_NOT_ENABLED", "totpNotEnabled"],
    ["TOTP_ALREADY_ENABLED", "totpAlreadyEnabled"],
    ["TOTP_NOT_CONFIGURED", "totpNotConfigured"],
    ["TWO_FACTOR_NOT_ENABLED", "totpNotEnabled"],
    ["BACKUP_CODES_NOT_ENABLED", "backupCodesNotEnabled"],
  ])("maps %s to its own message", (code, key) => {
    expect(twoFactorErrorKey(code)).toBe(`notifications.twoFactor.errors.${key}`);
  });
  it("has a specific translation for every installed two-factor error", () => {
    for (const code of Object.keys(twoFactor().$ERROR_CODES)) {
      expect(twoFactorErrorKey(code)).not.toBe("notifications.twoFactor.errors.unknownError");
    }
  });
  it.each([undefined, "FUTURE_ERROR", "toString", "__proto__"])(
    "uses the generic message for %s",
    (code) => {
      expect(twoFactorErrorKey(code)).toBe("notifications.twoFactor.errors.unknownError");
    },
  );
});
