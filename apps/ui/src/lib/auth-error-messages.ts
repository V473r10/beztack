import type { TFunction } from "i18next";

/**
 * Known Better Auth error codes for 2FA operations
 */
const AUTH_ERROR_CODES = {
  INVALID_PASSWORD: "INVALID_PASSWORD",
  INVALID_TOTP_CODE: "INVALID_TOTP_CODE",
  TOTP_NOT_ENABLED: "TOTP_NOT_ENABLED",
  INVALID_TWO_FACTOR_COOKIE: "INVALID_TWO_FACTOR_COOKIE",
  BACKUP_CODE_NOT_FOUND: "BACKUP_CODE_NOT_FOUND",
  BACKUP_CODE_USED: "BACKUP_CODE_USED",
} as const;

/**
 * Maps Better Auth error codes to i18n translation keys
 */
const ERROR_CODE_TO_I18N_KEY: Record<string, string> = {
  [AUTH_ERROR_CODES.INVALID_PASSWORD]:
    "notifications.twoFactor.errors.invalidPassword",
  [AUTH_ERROR_CODES.INVALID_TOTP_CODE]:
    "notifications.twoFactor.errors.invalidTotpCode",
  [AUTH_ERROR_CODES.TOTP_NOT_ENABLED]:
    "notifications.twoFactor.errors.totpNotEnabled",
  [AUTH_ERROR_CODES.INVALID_TWO_FACTOR_COOKIE]:
    "notifications.twoFactor.errors.invalidCookie",
  [AUTH_ERROR_CODES.BACKUP_CODE_NOT_FOUND]:
    "notifications.twoFactor.errors.backupCodeNotFound",
  [AUTH_ERROR_CODES.BACKUP_CODE_USED]:
    "notifications.twoFactor.errors.backupCodeUsed",
};

type AuthError = Error & {
  code?: string;
};

/**
 * Gets a user-friendly translated error message for auth errors
 * Falls back to the original error message if no translation is found
 */
export function getAuthErrorMessage(
  t: TFunction,
  error: AuthError,
  fallbackKey?: string
): string {
  const errorCode = error.code;

  // Try to get a translated message for the error code
  if (errorCode && errorCode in ERROR_CODE_TO_I18N_KEY) {
    const i18nKey = ERROR_CODE_TO_I18N_KEY[errorCode];
    const translated = t(i18nKey);
    if (translated !== i18nKey) {
      return translated;
    }
  }

  // If we have a fallback key with a message placeholder, use it
  if (fallbackKey && error.message) {
    const translated = t(fallbackKey, { message: error.message });
    if (translated !== fallbackKey) {
      return translated;
    }
  }

  // Fall back to the original error message or a generic error
  return error.message || t("notifications.twoFactor.errors.unknownError");
}

/**
 * Checks if the error is a password-related error
 */
export function isPasswordError(error: AuthError): boolean {
  return error.code === AUTH_ERROR_CODES.INVALID_PASSWORD;
}

/**
 * Checks if the error is a TOTP code error
 */
export function isTotpCodeError(error: AuthError): boolean {
  return (
    error.code === AUTH_ERROR_CODES.INVALID_TOTP_CODE ||
    error.code === AUTH_ERROR_CODES.TOTP_NOT_ENABLED
  );
}

export type { AuthError };
