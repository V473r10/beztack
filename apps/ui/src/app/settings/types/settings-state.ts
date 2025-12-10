export type SettingsState = {
  profile: {
    username: string;
    email: string;
  };
  twoFactor: {
    isEnabled: boolean;
    isPasswordDialogOpen: boolean;
    passwordInput: string;
    dialogTotpCode: string;
    action: "enable" | "disable" | "regenerate" | null;
    isSubmitting: boolean;
    totpURI: string | null;
    backupCodes: string[] | null;
    totpCode: string;
    showTotpVerification: boolean;
    isVerifyingTotp: boolean;
    hasConfirmedBackupCodes: boolean;
    showRegeneratedCodes: boolean;
    regeneratedCodes: string[] | null;
  };
};
