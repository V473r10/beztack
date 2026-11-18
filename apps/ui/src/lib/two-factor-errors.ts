const ERROR_KEYS = new Map<string, string>([
  ["INVALID_CODE", "invalidTotpCode"],
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
  // Preserve messages for older Better Auth responses.
  ["INVALID_TOTP_CODE", "invalidTotpCode"],
  ["BACKUP_CODE_NOT_FOUND", "backupCodeNotFound"],
  ["BACKUP_CODE_USED", "backupCodeUsed"],
]);

/** Maps Better Auth two-factor codes without exposing server messages. */
export function twoFactorErrorKey(code: string | undefined): string {
  return `notifications.twoFactor.errors.${ERROR_KEYS.get(code ?? "") ?? "unknownError"}`;
}
