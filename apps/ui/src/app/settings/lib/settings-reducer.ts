import type { SettingsAction } from "../types/settings-action";
import type { SettingsState } from "../types/settings-state";

export function settingsReducer(
  state: SettingsState,
  action: SettingsAction
): SettingsState {
  switch (action.type) {
    case "SET_USER_DATA":
      return {
        ...state,
        profile: {
          username: action.payload.username,
          email: action.payload.email,
        },
        twoFactor: {
          ...state.twoFactor,
          isEnabled: action.payload.twoFactorEnabled,
        },
      };
    case "SET_PROFILE_FIELD":
      return {
        ...state,
        profile: {
          ...state.profile,
          [action.field]: action.value,
        },
      };
    case "OPEN_PASSWORD_DIALOG":
      return {
        ...state,
        twoFactor: {
          ...state.twoFactor,
          isPasswordDialogOpen: true,
          action: action.action,
        },
      };
    case "CLOSE_PASSWORD_DIALOG":
      return {
        ...state,
        twoFactor: {
          ...state.twoFactor,
          isPasswordDialogOpen: false,
          passwordInput: "",
          dialogTotpCode: "",
          action: null,
        },
      };
    case "SET_PASSWORD":
      return {
        ...state,
        twoFactor: {
          ...state.twoFactor,
          passwordInput: action.value,
        },
      };
    case "SET_DIALOG_TOTP_CODE":
      return {
        ...state,
        twoFactor: {
          ...state.twoFactor,
          dialogTotpCode: action.value,
        },
      };
    case "START_SUBMITTING":
      return {
        ...state,
        twoFactor: {
          ...state.twoFactor,
          isSubmitting: true,
        },
      };
    case "STOP_SUBMITTING":
      return {
        ...state,
        twoFactor: {
          ...state.twoFactor,
          isSubmitting: false,
        },
      };
    case "SET_2FA_ENABLED":
      return {
        ...state,
        twoFactor: {
          ...state.twoFactor,
          isEnabled: action.enabled,
        },
      };
    case "SET_2FA_SETUP_DATA":
      return {
        ...state,
        twoFactor: {
          ...state.twoFactor,
          totpURI: action.totpURI,
          backupCodes: action.backupCodes,
        },
      };
    case "CLEAR_2FA_SETUP_DATA":
      return {
        ...state,
        twoFactor: {
          ...state.twoFactor,
          totpURI: null,
          backupCodes: null,
          hasConfirmedBackupCodes: false,
        },
      };
    case "SET_TOTP_CODE":
      return {
        ...state,
        twoFactor: {
          ...state.twoFactor,
          totpCode: action.value,
        },
      };
    case "SHOW_TOTP_VERIFICATION":
      return {
        ...state,
        twoFactor: {
          ...state.twoFactor,
          showTotpVerification: true,
        },
      };
    case "HIDE_TOTP_VERIFICATION":
      return {
        ...state,
        twoFactor: {
          ...state.twoFactor,
          showTotpVerification: false,
          totpCode: "",
          hasConfirmedBackupCodes: false,
        },
      };
    case "START_TOTP_VERIFICATION":
      return {
        ...state,
        twoFactor: {
          ...state.twoFactor,
          isVerifyingTotp: true,
        },
      };
    case "STOP_TOTP_VERIFICATION":
      return {
        ...state,
        twoFactor: {
          ...state.twoFactor,
          isVerifyingTotp: false,
        },
      };
    case "SET_BACKUP_CODES_CONFIRMED":
      return {
        ...state,
        twoFactor: {
          ...state.twoFactor,
          hasConfirmedBackupCodes: action.confirmed,
        },
      };
    case "SET_REGENERATED_CODES":
      return {
        ...state,
        twoFactor: {
          ...state.twoFactor,
          regeneratedCodes: action.codes,
          showRegeneratedCodes: true,
          hasConfirmedBackupCodes: false,
        },
      };
    case "CLOSE_REGENERATED_CODES":
      return {
        ...state,
        twoFactor: {
          ...state.twoFactor,
          regeneratedCodes: null,
          showRegeneratedCodes: false,
          hasConfirmedBackupCodes: false,
        },
      };
    default:
      return state;
  }
}
