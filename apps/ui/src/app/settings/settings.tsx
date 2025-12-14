import { useCallback, useEffect, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ThemeSelector } from "@/components/theme-selector";
import { PasswordConfirmDialog } from "./components/password-confirm-dialog";
import { ProfileCard } from "./components/profile-card";
import { TwoFactorCard } from "./components/two-factor-card";
import { useProfileMutation } from "./hooks/use-profile-mutation";
import { useSettingsTour } from "./hooks/use-settings-tour";
import {
  useBackupCodesRegenerate,
  useTotpVerification,
  useTwoFactorMutation,
} from "./hooks/use-two-factor";
import { useUserSession } from "./hooks/use-user-session";
import {
  copyBackupCodesToClipboard,
  downloadBackupCodes,
} from "./lib/backup-codes";
import { INITIAL_SETTINGS_STATE, TOTP_CODE_LENGTH } from "./lib/constants";
import { settingsReducer } from "./lib/settings-reducer";

export function Settings() {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(settingsReducer, INITIAL_SETTINGS_STATE);

  // Data fetching
  const userQuery = useUserSession();

  // Mutations
  const profileMutation = useProfileMutation(userQuery.data?.email);
  const twoFactorMutation = useTwoFactorMutation(
    dispatch,
    state.twoFactor.action === "regenerate" ? null : state.twoFactor.action,
    t
  );
  const totpVerificationMutation = useTotpVerification(dispatch, t);
  const backupCodesRegenerateMutation = useBackupCodesRegenerate(dispatch, t);

  // Tour initialization
  useSettingsTour();

  // Sync user data with state
  useEffect(() => {
    if (userQuery.data) {
      dispatch({
        type: "SET_USER_DATA",
        payload: {
          username: userQuery.data.name || "",
          email: userQuery.data.email || "",
          twoFactorEnabled: userQuery.data.twoFactorEnabled ?? false,
        },
      });
    }
  }, [userQuery.data]);

  // Profile handlers
  const handleProfileSave = useCallback(() => {
    profileMutation.mutate({
      username: state.profile.username,
      email: state.profile.email,
    });
  }, [profileMutation, state.profile]);

  // Two-factor handlers
  const handleTwoFactorToggle = useCallback((enabled: boolean) => {
    dispatch({
      type: "OPEN_PASSWORD_DIALOG",
      action: enabled ? "enable" : "disable",
    });
  }, []);

  const handlePasswordConfirm = useCallback(() => {
    if (!(state.twoFactor.action && state.twoFactor.passwordInput)) {
      toast.error(t("notifications.twoFactor.errors.passwordRequired"));
      return;
    }

    if (
      state.twoFactor.action === "disable" &&
      state.twoFactor.dialogTotpCode.length !== TOTP_CODE_LENGTH
    ) {
      toast.error(t("notifications.twoFactor.errors.totpRequired"));
      return;
    }

    // Handle regenerate action separately
    if (state.twoFactor.action === "regenerate") {
      backupCodesRegenerateMutation.mutate(state.twoFactor.passwordInput);
      return;
    }

    twoFactorMutation.mutate({
      action: state.twoFactor.action,
      password: state.twoFactor.passwordInput,
      totpCode: state.twoFactor.dialogTotpCode || undefined,
    });
  }, [
    twoFactorMutation,
    backupCodesRegenerateMutation,
    state.twoFactor.action,
    state.twoFactor.passwordInput,
    state.twoFactor.dialogTotpCode,
  ]);

  const handleTotpVerification = useCallback(() => {
    if (state.twoFactor.totpCode.length !== TOTP_CODE_LENGTH) {
      toast.error(t("notifications.twoFactor.errors.invalidCode"));
      return;
    }

    totpVerificationMutation.mutate(state.twoFactor.totpCode);
  }, [totpVerificationMutation, state.twoFactor.totpCode, t]);

  // Backup codes handlers
  const handleCopyBackupCodes = useCallback(() => {
    if (state.twoFactor.backupCodes) {
      copyBackupCodesToClipboard(state.twoFactor.backupCodes);
    }
  }, [state.twoFactor.backupCodes]);

  const handleDownloadBackupCodes = useCallback(() => {
    if (state.twoFactor.backupCodes) {
      downloadBackupCodes(state.twoFactor.backupCodes);
    }
  }, [state.twoFactor.backupCodes]);

  // Regenerated backup codes handlers
  const handleRegenerateBackupCodes = useCallback(() => {
    dispatch({ type: "OPEN_PASSWORD_DIALOG", action: "regenerate" });
  }, []);

  const handleCopyRegeneratedCodes = useCallback(() => {
    if (state.twoFactor.regeneratedCodes) {
      copyBackupCodesToClipboard(state.twoFactor.regeneratedCodes);
    }
  }, [state.twoFactor.regeneratedCodes]);

  const handleDownloadRegeneratedCodes = useCallback(() => {
    if (state.twoFactor.regeneratedCodes) {
      downloadBackupCodes(state.twoFactor.regeneratedCodes);
    }
  }, [state.twoFactor.regeneratedCodes]);

  const handleCloseRegeneratedCodes = useCallback(() => {
    dispatch({ type: "CLOSE_REGENERATED_CODES" });
  }, []);

  return (
    <div className="space-y-6 p-4 md:p-8">
      <h1 className="font-semibold text-2xl">{t("account.settings.title")}</h1>

      <ThemeSelector />

      <ProfileCard
        email={state.profile.email}
        isPending={profileMutation.isPending}
        onEmailChange={(value) =>
          dispatch({ type: "SET_PROFILE_FIELD", field: "email", value })
        }
        onSave={handleProfileSave}
        onUsernameChange={(value) =>
          dispatch({ type: "SET_PROFILE_FIELD", field: "username", value })
        }
        username={state.profile.username}
      />

      <TwoFactorCard
        backupCodes={state.twoFactor.backupCodes}
        hasConfirmedBackupCodes={state.twoFactor.hasConfirmedBackupCodes}
        isEnabled={state.twoFactor.isEnabled}
        isSubmitting={state.twoFactor.isSubmitting}
        isVerifying={state.twoFactor.isVerifyingTotp}
        onCloseRegeneratedCodes={handleCloseRegeneratedCodes}
        onConfirmBackupCodes={(confirmed) =>
          dispatch({ type: "SET_BACKUP_CODES_CONFIRMED", confirmed })
        }
        onCopyBackupCodes={handleCopyBackupCodes}
        onCopyRegeneratedCodes={handleCopyRegeneratedCodes}
        onDownloadBackupCodes={handleDownloadBackupCodes}
        onDownloadRegeneratedCodes={handleDownloadRegeneratedCodes}
        onRegenerateBackupCodes={handleRegenerateBackupCodes}
        onToggle={handleTwoFactorToggle}
        onTotpCodeChange={(value) => dispatch({ type: "SET_TOTP_CODE", value })}
        onVerifyTotp={handleTotpVerification}
        regeneratedCodes={state.twoFactor.regeneratedCodes}
        showRegeneratedCodes={state.twoFactor.showRegeneratedCodes}
        showSetup={state.twoFactor.showTotpVerification}
        totpCode={state.twoFactor.totpCode}
        totpURI={state.twoFactor.totpURI}
      />

      <PasswordConfirmDialog
        action={state.twoFactor.action}
        isSubmitting={state.twoFactor.isSubmitting}
        onCancel={() => dispatch({ type: "CLOSE_PASSWORD_DIALOG" })}
        onConfirm={handlePasswordConfirm}
        onPasswordChange={(value) => dispatch({ type: "SET_PASSWORD", value })}
        onTotpCodeChange={(value) =>
          dispatch({ type: "SET_DIALOG_TOTP_CODE", value })
        }
        open={state.twoFactor.isPasswordDialogOpen}
        password={state.twoFactor.passwordInput}
        totpCode={state.twoFactor.dialogTotpCode}
      />
    </div>
  );
}

export default Settings;
