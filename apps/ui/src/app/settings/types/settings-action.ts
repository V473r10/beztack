export type SettingsAction =
  | {
      type: "SET_USER_DATA";
      payload: { username: string; email: string; twoFactorEnabled: boolean };
    }
  | { type: "SET_PROFILE_FIELD"; field: "username" | "email"; value: string }
  | { type: "OPEN_PASSWORD_DIALOG"; action: "enable" | "disable" }
  | { type: "CLOSE_PASSWORD_DIALOG" }
  | { type: "SET_PASSWORD"; value: string }
  | { type: "START_SUBMITTING" }
  | { type: "STOP_SUBMITTING" }
  | { type: "SET_2FA_ENABLED"; enabled: boolean }
  | { type: "SET_2FA_SETUP_DATA"; totpURI: string; backupCodes: string[] }
  | { type: "CLEAR_2FA_SETUP_DATA" }
  | { type: "SET_TOTP_CODE"; value: string }
  | { type: "SHOW_TOTP_VERIFICATION" }
  | { type: "HIDE_TOTP_VERIFICATION" }
  | { type: "START_TOTP_VERIFICATION" }
  | { type: "STOP_TOTP_VERIFICATION" }
  | { type: "SET_BACKUP_CODES_CONFIRMED"; confirmed: boolean };
