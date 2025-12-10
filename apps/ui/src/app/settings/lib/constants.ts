// Time constants
export const MILLISECONDS_PER_SECOND = 1000;
export const SECONDS_PER_MINUTE = 60;
export const CACHE_STALE_TIME_MINUTES = 5;
export const USER_QUERY_STALE_TIME =
  MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE * CACHE_STALE_TIME_MINUTES;

// TOTP constants
export const TOTP_CODE_LENGTH = 6;

// Initial state
export const INITIAL_SETTINGS_STATE = {
  profile: {
    username: "",
    email: "",
  },
  twoFactor: {
    isEnabled: false,
    isPasswordDialogOpen: false,
    passwordInput: "",
    dialogTotpCode: "",
    action: null as "enable" | "disable" | "regenerate" | null,
    isSubmitting: false,
    totpURI: null as string | null,
    backupCodes: null as string[] | null,
    totpCode: "",
    showTotpVerification: false,
    isVerifyingTotp: false,
    hasConfirmedBackupCodes: false,
    showRegeneratedCodes: false,
    regeneratedCodes: null as string[] | null,
  },
} as const;
