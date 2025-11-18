import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import type { SettingsAction } from "../types/settings-action";

type TwoFactorEnableSuccessData = {
  totpURI: string;
  backupCodes: string[];
};

type TwoFactorMutationParams = {
  action: "enable" | "disable";
  password: string;
  totpCode?: string;
};

export function useTwoFactorMutation(
  dispatch: React.Dispatch<SettingsAction>,
  currentAction: "enable" | "disable" | null
) {
  return useMutation({
    mutationFn: async ({
      action,
      password,
      totpCode,
    }: TwoFactorMutationParams) => {
      // When disabling 2FA, verify TOTP code first
      if (action === "disable") {
        if (!totpCode) {
          throw new Error("TOTP code is required to disable 2FA");
        }

        // Verify TOTP code before disabling
        const verifyResponse = await authClient.twoFactor.verifyTotp({
          code: totpCode,
        });

        if (verifyResponse.error) {
          throw new Error(verifyResponse.error.message || "Invalid TOTP code");
        }
      }

      // Proceed with enable/disable
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
      toast.error(`Failed to ${currentAction} 2FA: ${errorMessage}`);

      if (error.code === "INVALID_PASSWORD") {
        dispatch({ type: "SET_PASSWORD", value: "" });
      } else {
        dispatch({ type: "CLOSE_PASSWORD_DIALOG" });
      }

      if (currentAction === "enable") {
        dispatch({ type: "CLEAR_2FA_SETUP_DATA" });
      }
    },
    onSettled: () => {
      dispatch({ type: "STOP_SUBMITTING" });
    },
  });
}

export function useTotpVerification(dispatch: React.Dispatch<SettingsAction>) {
  const queryClient = useQueryClient();

  return useMutation({
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
}
