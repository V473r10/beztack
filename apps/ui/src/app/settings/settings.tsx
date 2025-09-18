import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeCanvas } from "qrcode.react";
import { useCallback, useEffect, useMemo, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ThemeSelector } from "@/components/theme-selector";
import { type TourStep, useTour } from "@/components/tour";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { authClient } from "@/lib/auth-client";
import { TOUR_STEP_IDS } from "@/lib/tour-constants";
import { settingsReducer } from "./lib/settings-reducer";
import type { SettingsState } from "./types/settings-state";

// Time constants
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const CACHE_STALE_TIME_MINUTES = 5;
const USER_QUERY_STALE_TIME =
  MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE * CACHE_STALE_TIME_MINUTES;


// TOTP constants
const TOTP_CODE_LENGTH = 6;

type TwoFactorEnableSuccessData = {
  totpURI: string;
  backupCodes: string[];
};

const initialState: SettingsState = {
  profile: {
    username: "",
    email: "",
  },
  twoFactor: {
    isEnabled: false,
    isPasswordDialogOpen: false,
    passwordInput: "",
    action: null,
    isSubmitting: false,
    totpURI: null,
    backupCodes: null,
    totpCode: "",
    showTotpVerification: false,
    isVerifyingTotp: false,
    hasConfirmedBackupCodes: false,
  },
};

export function Settings() {
  const { setSteps, startTour } = useTour();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(settingsReducer, initialState);

  const steps: TourStep[] = useMemo(
    () => [
      {
        content: <div className="p-2">{t("tour.settingsTour.step1")}</div>,
        selectorId: TOUR_STEP_IDS.Settings.TwoFactor.CARD,
        position: "top",
      },
      {
        content: <div className="p-2">{t("tour.settingsTour.step2")}</div>,
        selectorId: TOUR_STEP_IDS.Settings.TwoFactor.SWITCH,
        position: "right",
      },
    ],
    [t]
  );

  const userQuery = useQuery({
    queryKey: ["user-session"],
    queryFn: async () => {
      const session = await authClient.getSession();
      if (!session.data) {
        throw new Error("No session");
      }
      return session.data.user;
    },
    staleTime: USER_QUERY_STALE_TIME, // 5 minutes
  });

  useEffect(() => {
    if (localStorage.getItem("settings_tour_completed") === "true") {
      return;
    }
    setSteps(steps);
    startTour();
  }, [setSteps, startTour, steps]);

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

  const profileMutation = useMutation({
    mutationFn: async (profileData: { username: string; email: string }) => {
      const currentUser = userQuery.data;
      
      // Handle name update
      const nameUpdateResult = await authClient.updateUser({
        name: profileData.username, // Better Auth uses 'name' instead of 'username'
      });
      
      if (nameUpdateResult.error) {
        throw new Error(nameUpdateResult.error.message || "Failed to update profile");
      }
      
      // Handle email change separately if email has changed
      if (currentUser?.email !== profileData.email) {
        const emailChangeResult = await authClient.changeEmail({
          newEmail: profileData.email,
          callbackURL: "/settings", // Redirect back to settings after verification
        });
        
        if (emailChangeResult.error) {
          throw new Error(emailChangeResult.error.message || "Failed to change email");
        }
        
        // Show different success message for email changes
        toast.success("Profile updated! Please check your email to verify the new address.");
        return { nameUpdated: true, emailChangeRequested: true };
      }
      
      return { nameUpdated: true, emailChangeRequested: false };
    },
    onSuccess: (data) => {
      // Only show generic success message if email wasn't changed 
      // (email changes show their own message in mutationFn)
      if (!data?.emailChangeRequested) {
        toast.success("Profile settings saved!");
      }
      queryClient.invalidateQueries({ queryKey: ["user-session"] });
    },
    onError: (error) => {
      toast.error(`Failed to save profile: ${error.message}`);
    },
  });

  const twoFactorMutation = useMutation({
    mutationFn: async ({
      action,
      password,
    }: {
      action: "enable" | "disable";
      password: string;
    }) => {
      const response =
        action === "enable"
          ? await authClient.twoFactor.enable({ password })
          : await authClient.twoFactor.disable({ password });

      if (response.error) {
        throw new Error(
          response.error.message || "Two-factor authentication operation failed"
        );
      }

      return { action, data: response.data };
    },
    onMutate: () => {
      dispatch({ type: "START_SUBMITTING" });
    },
    onSuccess: ({ action, data }) => {
      if (action === "enable" && data) {
        const enableData = data as TwoFactorEnableSuccessData;
        dispatch({
          type: "SET_2FA_SETUP_DATA",
          totpURI: enableData.totpURI,
          backupCodes: enableData.backupCodes,
        });
        dispatch({ type: "SHOW_TOTP_VERIFICATION" });
        toast.success(
          "Scan QR, save codes, then enter verification code below."
        );
      } else {
        dispatch({ type: "SET_2FA_ENABLED", enabled: false });
        dispatch({ type: "CLEAR_2FA_SETUP_DATA" });
        toast.success("Two-Factor Authentication disabled successfully!");
      }
      dispatch({ type: "CLOSE_PASSWORD_DIALOG" });
    },
    onError: (error: Error & { code?: string }) => {
      const errorMessage = error.message || "An unexpected error occurred.";
      toast.error(`Failed to ${state.twoFactor.action} 2FA: ${errorMessage}`);

      if (error.code === "INVALID_PASSWORD") {
        dispatch({ type: "SET_PASSWORD", value: "" });
        // Keep dialog open for retry
      } else {
        dispatch({ type: "CLOSE_PASSWORD_DIALOG" });
      }

      if (state.twoFactor.action === "enable") {
        dispatch({ type: "CLEAR_2FA_SETUP_DATA" });
      }
    },
    onSettled: () => {
      dispatch({ type: "STOP_SUBMITTING" });
    },
  });

  const totpVerificationMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await authClient.twoFactor.verifyTotp({ code });
      if (response.error) {
        throw new Error(response.error.message || "Invalid verification code");
      }
      return response.data;
    },
    onMutate: () => {
      dispatch({ type: "START_TOTP_VERIFICATION" });
    },
    onSuccess: () => {
      toast.success("Two-Factor Authentication setup complete and verified!");
      dispatch({ type: "SET_2FA_ENABLED", enabled: true });
      dispatch({ type: "HIDE_TOTP_VERIFICATION" });
      queryClient.invalidateQueries({ queryKey: ["user-session"] });
    },
    onError: (error: Error) => {
      toast.error(
        error.message || "Invalid verification code. Please try again."
      );
      dispatch({ type: "SET_TOTP_CODE", value: "" });
    },
    onSettled: () => {
      dispatch({ type: "STOP_TOTP_VERIFICATION" });
    },
  });

  const handleProfileSave = useCallback(() => {
    profileMutation.mutate({
      username: state.profile.username,
      email: state.profile.email,
    });
  }, [profileMutation, state.profile]);

  const handleTwoFactorToggle = useCallback((enabled: boolean) => {
    dispatch({
      type: "OPEN_PASSWORD_DIALOG",
      action: enabled ? "enable" : "disable",
    });
  }, []);

  const handlePasswordConfirm = useCallback(() => {
    if (!(state.twoFactor.action && state.twoFactor.passwordInput)) {
      toast.error("Password is required.");
      return;
    }

    twoFactorMutation.mutate({
      action: state.twoFactor.action,
      password: state.twoFactor.passwordInput,
    });
  }, [
    twoFactorMutation,
    state.twoFactor.action,
    state.twoFactor.passwordInput,
  ]);

  const handleTotpVerification = useCallback(() => {
    if (state.twoFactor.totpCode.length !== TOTP_CODE_LENGTH) {
      toast.error("Please enter a 6-digit verification code.");
      return;
    }

    totpVerificationMutation.mutate(state.twoFactor.totpCode);
  }, [totpVerificationMutation, state.twoFactor.totpCode]);

  const handleCopyBackupCodes = useCallback(() => {
    if (!state.twoFactor.backupCodes) {
      return;
    }

    const codesText = state.twoFactor.backupCodes.join("\n");
    navigator.clipboard
      .writeText(codesText)
      .then(() => {
        toast.success("Backup codes copied to clipboard!");
      })
      .catch(() => {
        toast.error("Failed to copy backup codes.");
      });
  }, [state.twoFactor.backupCodes]);

  const handleDownloadBackupCodes = useCallback(() => {
    if (!state.twoFactor.backupCodes) {
      return;
    }

    const codesText = [
      "Two-Factor Authentication Backup Codes",
      "==========================================",
      "",
      "Save these backup codes in a secure location. Each code can only be used once.",
      "",
      ...state.twoFactor.backupCodes,
      "",
      `Generated on: ${new Date().toLocaleString()}`,
    ].join("\n");

    const blob = new Blob([codesText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "2fa-backup-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Backup codes downloaded!");
  }, [state.twoFactor.backupCodes]);

  const handleConfirmBackupCodes = useCallback(() => {
    dispatch({ type: "SET_BACKUP_CODES_CONFIRMED", confirmed: true });
  }, []);

  return (
    <div className="space-y-6 p-4 md:p-8">
      <h1 className="font-semibold text-2xl">{t("account.settings.title")}</h1>

      <ThemeSelector />

      <Card>
        <CardHeader>
          <CardTitle>{t("account.settings.profile.title")}</CardTitle>
          <CardDescription>
            {t("account.settings.profile.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">
              {t("account.settings.profile.username")}
            </Label>
            <Input
              id="username"
              onChange={(e) =>
                dispatch({
                  type: "SET_PROFILE_FIELD",
                  field: "username",
                  value: e.target.value,
                })
              }
              value={state.profile.username}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("account.settings.profile.email")}</Label>
            <Input
              id="email"
              onChange={(e) =>
                dispatch({
                  type: "SET_PROFILE_FIELD",
                  field: "email",
                  value: e.target.value,
                })
              }
              type="email"
              value={state.profile.email}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button
            disabled={profileMutation.isPending}
            onClick={handleProfileSave}
          >
            {profileMutation.isPending
              ? t("account.settings.profile.saving")
              : t("account.settings.profile.save")}
          </Button>
        </CardFooter>
      </Card>

      <Card id={TOUR_STEP_IDS.Settings.TwoFactor.CARD}>
        <CardHeader>
          <CardTitle>{t("account.settings.twoFactor.title")}</CardTitle>
          <CardDescription>
            {t("account.settings.twoFactor.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="flex items-center space-x-2"
            id={TOUR_STEP_IDS.Settings.TwoFactor.SWITCH}
          >
            <Label htmlFor="two-factor-switch">
              <span>{t("account.settings.twoFactor.enable")}</span>
            </Label>
            <Switch
              checked={state.twoFactor.isEnabled}
              disabled={state.twoFactor.isSubmitting}
              id="two-factor-switch"
              onCheckedChange={handleTwoFactorToggle}
            />
          </div>
          <span className="font-normal text-muted-foreground leading-snug">
            {t("account.settings.twoFactor.willPrompt")}
          </span>

          {/* Section to display QR code and recovery codes after successful enablement */}
          <div className="space-y-4 border-t pt-4">
            {state.twoFactor.totpURI &&
              state.twoFactor.showTotpVerification && (
                <>
                  <div className="rounded-md border bg-green-50 p-4 dark:bg-green-900/30">
                    <h3 className="font-semibold text-green-700 dark:text-green-400">
                      {t("account.settings.twoFactor.completeYour2FASetup")}
                    </h3>
                    <p className="mb-2 text-green-600 text-sm dark:text-green-500">
                      {t("account.settings.twoFactor.scanQrCode")}
                    </p>
                    <div className="my-4 flex justify-center rounded border bg-white p-4 dark:bg-slate-800">
                      <QRCodeCanvas
                        bgColor={"#ffffff"}
                        fgColor={"#000000"}
                        level={"M"}
                        marginSize={1}
                        size={300}
                        value={state.twoFactor.totpURI}
                      />
                    </div>
                  </div>

                  {/* Backup Codes Section - Critical to save now */}
                  {state.twoFactor.backupCodes && (
                    <div className="rounded-md border bg-amber-50 p-4 dark:bg-amber-900/30">
                      <h3 className="mb-2 font-semibold text-amber-700 dark:text-amber-400">
                        ⚠️ {t("account.settings.twoFactor.backupCodes")}
                      </h3>
                      <p className="mb-3 font-medium text-amber-600 text-sm dark:text-amber-500">
                        {t("account.settings.twoFactor.backupCodesWarning", {
                          defaultValue:
                            "Save these backup codes now! You won't be able to see them again. Each code can only be used once.",
                        })}
                      </p>
                      <div className="mb-3 space-y-1 rounded border bg-white p-3 dark:bg-slate-800">
                        {state.twoFactor.backupCodes.map((code) => (
                          <pre
                            className="rounded border bg-slate-50 p-2 font-mono text-sm dark:bg-slate-700"
                            key={code}
                          >
                            {code}
                          </pre>
                        ))}
                      </div>
                      <div className="mb-4 flex gap-2">
                        <Button
                          onClick={handleCopyBackupCodes}
                          size="sm"
                          variant="outline"
                        >
                          📋 Copy All Codes
                        </Button>
                        <Button
                          onClick={handleDownloadBackupCodes}
                          size="sm"
                          variant="outline"
                        >
                          💾 Download as File
                        </Button>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={state.twoFactor.hasConfirmedBackupCodes}
                          id="backup-codes-saved"
                          onCheckedChange={handleConfirmBackupCodes}
                        />
                        <Label
                          className="font-medium text-sm"
                          htmlFor="backup-codes-saved"
                        >
                          {t("account.settings.twoFactor.confirmSavedCodes", {
                            defaultValue:
                              "I have safely saved these backup codes",
                          })}
                        </Label>
                      </div>
                    </div>
                  )}

                  {/* TOTP Verification Input Section */}
                  <div className="mt-4 rounded-md border bg-sky-50 p-4 dark:bg-sky-900/30">
                    <h3 className="font-semibold text-sky-700 dark:text-sky-400">
                      {t("account.settings.twoFactor.verifyAuthenticatorApp")}
                    </h3>
                    <p className="mb-3 text-sky-600 text-sm dark:text-sky-500">
                      {t("account.settings.twoFactor.enter6DigitCode")}
                    </p>
                    <div className="flex items-center space-x-2">
                      <InputOTP
                        maxLength={6}
                        onChange={(value) =>
                          dispatch({ type: "SET_TOTP_CODE", value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleTotpVerification();
                          }
                        }}
                        value={state.twoFactor.totpCode}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                        </InputOTPGroup>
                        <InputOTPGroup>
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                      <Button
                        disabled={
                          state.twoFactor.isVerifyingTotp ||
                          state.twoFactor.totpCode.length !==
                            TOTP_CODE_LENGTH ||
                          !state.twoFactor.hasConfirmedBackupCodes
                        }
                        onClick={handleTotpVerification}
                      >
                        {state.twoFactor.isVerifyingTotp
                          ? t("account.settings.twoFactor.verifying")
                          : t("account.settings.twoFactor.verifyAndComplete")}
                      </Button>
                    </div>
                    {!state.twoFactor.hasConfirmedBackupCodes && (
                      <p className="mt-2 text-red-600 text-xs dark:text-red-400">
                        ⚠️ Please save your backup codes before completing setup
                      </p>
                    )}
                  </div>
                </>
              )}

            {state.twoFactor.isEnabled &&
              !state.twoFactor.showTotpVerification && (
                <div className="rounded-md border bg-green-50 p-4 dark:bg-green-900/30">
                  <h3 className="mb-2 font-semibold text-green-700 dark:text-green-400">
                    ✅ Two-Factor Authentication Enabled
                  </h3>
                  <p className="text-green-600 text-sm dark:text-green-500">
                    {t("account.settings.twoFactor.alreadyEnabled", {
                      defaultValue:
                        "Your account is protected with two-factor authentication. Your backup codes have been safely stored and encrypted.",
                    })}
                  </p>
                </div>
              )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        onOpenChange={(open) => {
          if (state.twoFactor.isSubmitting) {
            return; // Prevent closing while submitting
          }
          if (!open) {
            dispatch({ type: "CLOSE_PASSWORD_DIALOG" });
          }
        }}
        open={state.twoFactor.isPasswordDialogOpen}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {t("account.settings.twoFactor.passwordDialog.title")}
            </DialogTitle>
            <DialogDescription>
              {t("account.settings.twoFactor.passwordDialog.description", {
                action: state.twoFactor.action,
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right" htmlFor="password-confirm">
                {t("account.settings.twoFactor.passwordDialog.password")}
              </Label>
              <Input
                className="col-span-3"
                disabled={state.twoFactor.isSubmitting}
                id="password-confirm"
                onChange={(e) =>
                  dispatch({ type: "SET_PASSWORD", value: e.target.value })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handlePasswordConfirm();
                  }
                }}
                type="password"
                value={state.twoFactor.passwordInput}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={state.twoFactor.isSubmitting}
              onClick={() => {
                if (state.twoFactor.isSubmitting) {
                  return;
                }
                dispatch({ type: "CLOSE_PASSWORD_DIALOG" });
              }}
              variant="outline"
            >
              {t("account.settings.twoFactor.passwordDialog.cancel")}
            </Button>
            <Button
              disabled={
                state.twoFactor.isSubmitting || !state.twoFactor.passwordInput
              }
              onClick={handlePasswordConfirm}
              type="submit"
            >
              {state.twoFactor.isSubmitting
                ? t("account.settings.twoFactor.passwordDialog.confirming")
                : t("account.settings.twoFactor.passwordDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Settings;
