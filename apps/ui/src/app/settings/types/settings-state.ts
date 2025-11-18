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
    action: "enable" | "disable" | null;
    isSubmitting: boolean;
    totpURI: string | null;
    backupCodes: string[] | null;
    totpCode: string;
    showTotpVerification: boolean;
    isVerifyingTotp: boolean;
    hasConfirmedBackupCodes: boolean;
  };
};
