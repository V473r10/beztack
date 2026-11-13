import type { TFunction } from "i18next";

/**
 * Known Better Auth error codes (sign-in, sign-up and 2FA operations)
 */
const AUTH_ERROR_CODES = {
  INVALID_PASSWORD: "INVALID_PASSWORD",
  INVALID_TOTP_CODE: "INVALID_TOTP_CODE",
  TOTP_NOT_ENABLED: "TOTP_NOT_ENABLED",
  INVALID_TWO_FACTOR_COOKIE: "INVALID_TWO_FACTOR_COOKIE",
  BACKUP_CODE_NOT_FOUND: "BACKUP_CODE_NOT_FOUND",
  BACKUP_CODE_USED: "BACKUP_CODE_USED",
} as const;

const SERVER_ERROR_STATUS = 500;
const SERVER_ERROR_KEY = "notifications.auth.errors.serverError";

/**
 * Maps Better Auth error codes to i18n translation keys
 */
const ERROR_CODE_TO_I18N_KEY: Record<string, string> = {
  [AUTH_ERROR_CODES.INVALID_PASSWORD]: "notifications.twoFactor.errors.invalidPassword",
  [AUTH_ERROR_CODES.INVALID_TOTP_CODE]: "notifications.twoFactor.errors.invalidTotpCode",
  [AUTH_ERROR_CODES.TOTP_NOT_ENABLED]: "notifications.twoFactor.errors.totpNotEnabled",
  [AUTH_ERROR_CODES.INVALID_TWO_FACTOR_COOKIE]: "notifications.twoFactor.errors.invalidCookie",
  [AUTH_ERROR_CODES.BACKUP_CODE_NOT_FOUND]: "notifications.twoFactor.errors.backupCodeNotFound",
  [AUTH_ERROR_CODES.BACKUP_CODE_USED]: "notifications.twoFactor.errors.backupCodeUsed",
  USER_ALREADY_EXISTS: "notifications.auth.errors.userAlreadyExists",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "notifications.auth.errors.userAlreadyExists",
  INVALID_EMAIL_OR_PASSWORD: "notifications.auth.errors.invalidCredentials",
  INVALID_EMAIL: "notifications.auth.errors.invalidEmail",
  PASSWORD_TOO_SHORT: "notifications.auth.errors.passwordTooShort",
  PASSWORD_TOO_LONG: "notifications.auth.errors.passwordTooLong",
  EMAIL_NOT_VERIFIED: "notifications.auth.errors.emailNotVerified",
  FAILED_TO_CREATE_USER: SERVER_ERROR_KEY,
  FAILED_TO_CREATE_SESSION: SERVER_ERROR_KEY,
};

/**
 * The error half of a Better Auth client result. Every field is optional:
 * a failed request can carry any subset of them.
 */
type AuthError = {
  code?: string;
  message?: string;
  status?: number;
  statusText?: string;
};

/**
 * The Better Auth client does not throw on a failed request: it resolves to
 * `{ data, error }`. Returns that `error`, or null when the call succeeded.
 */
export function readAuthError(result: unknown): AuthError | null {
  if (typeof result !== "object" || result === null || !("error" in result)) {
    return null;
  }
  const { error } = result as { error?: AuthError | null };
  return error ?? null;
}

/**
 * Gets a user-friendly translated error message for auth errors.
 *
 * Order: translation of the error code, then the fallback key interpolated
 * with the server message, then the server message itself, then a generic
 * message for 5xx responses, then the generic unknown error.
 */
export function getAuthErrorMessage(t: TFunction, error: AuthError, fallbackKey?: string): string {
  const errorCode = error.code;

  if (errorCode && errorCode in ERROR_CODE_TO_I18N_KEY) {
    const i18nKey = ERROR_CODE_TO_I18N_KEY[errorCode];
    const translated = t(i18nKey);
    if (translated !== i18nKey) {
      return translated;
    }
  }

  if (fallbackKey && error.message) {
    const translated = t(fallbackKey, { message: error.message });
    if (translated !== fallbackKey) {
      return translated;
    }
  }

  if (error.message) {
    return error.message;
  }

  if (error.status !== undefined && error.status >= SERVER_ERROR_STATUS) {
    return t(SERVER_ERROR_KEY);
  }

  return t("notifications.twoFactor.errors.unknownError");
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
