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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeCanvas } from "qrcode.react";
import { useCallback, useEffect, useMemo, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface TwoFactorEnableSuccessData {
	totpURI: string;
	backupCodes: string[];
}

interface SettingsState {
	profile: {
		username: string;
		email: string;
	};
	twoFactor: {
		isEnabled: boolean;
		isPasswordDialogOpen: boolean;
		passwordInput: string;
		action: "enable" | "disable" | null;
		isSubmitting: boolean;
		totpURI: string | null;
		backupCodes: string[] | null;
		totpCode: string;
		showTotpVerification: boolean;
		isVerifyingTotp: boolean;
		hasConfirmedBackupCodes: boolean;
	};
}

type SettingsAction =
	| { type: "SET_USER_DATA"; payload: { username: string; email: string; twoFactorEnabled: boolean } }
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

function settingsReducer(state: SettingsState, action: SettingsAction): SettingsState {
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
		default:
			return state;
	}
}

export function Settings() {
	const { setSteps, startTour } = useTour();
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const [state, dispatch] = useReducer(settingsReducer, initialState);

	const steps: TourStep[] = useMemo(() => [
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
	], [t]);

	const userQuery = useQuery({
		queryKey: ["user-session"],
		queryFn: async () => {
			const session = await authClient.getSession();
			if (!session.data) throw new Error("No session");
			return session.data.user;
		},
		staleTime: 1000 * 60 * 5, // 5 minutes
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
					twoFactorEnabled: userQuery.data.twoFactorEnabled || false,
				},
			});
		}
	}, [userQuery.data]);

	const profileMutation = useMutation({
		mutationFn: async ({ username, email }: { username: string; email: string }) => {
			// TODO: Implement actual profile update API call
			await new Promise(resolve => setTimeout(resolve, 500)); // Simulated API call
			console.log("Profile saved:", { username, email });
			return { success: true };
		},
		onSuccess: () => {
			toast.success("Profile settings saved!");
			queryClient.invalidateQueries({ queryKey: ["user-session"] });
		},
		onError: (error) => {
			toast.error(`Failed to save profile: ${error.message}`);
		},
	});

	const twoFactorMutation = useMutation({
		mutationFn: async ({ action, password }: { action: "enable" | "disable"; password: string }) => {
			const response = action === "enable" 
				? await authClient.twoFactor.enable({ password })
				: await authClient.twoFactor.disable({ password });

			if (response.error) {
				throw new Error(response.error.message || "Two-factor authentication operation failed");
			}

			return { action, data: response.data };
		},
		onMutate: () => {
			dispatch({ type: "START_SUBMITTING" });
		},
		onSuccess: ({ action, data }) => {
			if (action === "enable" && data) {
				const enableData = data as TwoFactorEnableSuccessData;
				console.log("🔍 [DEBUG] Backup codes received from API:", enableData.backupCodes);
				console.log("🔍 [DEBUG] Backup codes length:", enableData.backupCodes?.length);
				console.log("🔍 [DEBUG] First code format:", enableData.backupCodes?.[0]);
				console.log("🔍 [DEBUG] First code length:", enableData.backupCodes?.[0]?.length);
				dispatch({ type: "SET_2FA_SETUP_DATA", totpURI: enableData.totpURI, backupCodes: enableData.backupCodes });
				dispatch({ type: "SHOW_TOTP_VERIFICATION" });
				toast.success("Scan QR, save codes, then enter verification code below.");
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
			toast.error(error.message || "Invalid verification code. Please try again.");
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
		dispatch({ type: "OPEN_PASSWORD_DIALOG", action: enabled ? "enable" : "disable" });
	}, []);

	const handlePasswordConfirm = useCallback(() => {
		if (!state.twoFactor.action || !state.twoFactor.passwordInput) {
			toast.error("Password is required.");
			return;
		}

		twoFactorMutation.mutate({
			action: state.twoFactor.action,
			password: state.twoFactor.passwordInput,
		});
	}, [twoFactorMutation, state.twoFactor.action, state.twoFactor.passwordInput]);

	const handleTotpVerification = useCallback(() => {
		if (state.twoFactor.totpCode.length !== 6) {
			toast.error("Please enter a 6-digit verification code.");
			return;
		}

		totpVerificationMutation.mutate(state.twoFactor.totpCode);
	}, [totpVerificationMutation, state.twoFactor.totpCode]);

	const handleCopyBackupCodes = useCallback(() => {
		if (!state.twoFactor.backupCodes) return;
		
		console.log("🔍 [DEBUG] Codes to copy:", state.twoFactor.backupCodes);
		const codesText = state.twoFactor.backupCodes.join('\n');
		console.log("🔍 [DEBUG] Final text for clipboard:", JSON.stringify(codesText));
		console.log("🔍 [DEBUG] Final text length:", codesText.length);
		
		navigator.clipboard.writeText(codesText).then(() => {
			toast.success("Backup codes copied to clipboard!");
		}).catch(() => {
			toast.error("Failed to copy backup codes.");
		});
	}, [state.twoFactor.backupCodes]);

	const handleDownloadBackupCodes = useCallback(() => {
		if (!state.twoFactor.backupCodes) return;
		
		const codesText = [
			"Two-Factor Authentication Backup Codes",
			"==========================================",
			"",
			"Save these backup codes in a secure location. Each code can only be used once.",
			"",
			...state.twoFactor.backupCodes,
			"",
			"Generated on: " + new Date().toLocaleString(),
		].join('\n');
		
		const blob = new Blob([codesText], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = '2fa-backup-codes.txt';
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
			<h1 className="text-2xl font-semibold">{t("account.settings.title")}</h1>

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
							value={state.profile.username}
							onChange={(e) => dispatch({ type: "SET_PROFILE_FIELD", field: "username", value: e.target.value })}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="email">{t("account.settings.profile.email")}</Label>
						<Input
							id="email"
							type="email"
							value={state.profile.email}
							onChange={(e) => dispatch({ type: "SET_PROFILE_FIELD", field: "email", value: e.target.value })}
						/>
					</div>
				</CardContent>
				<CardFooter>
					<Button 
						onClick={handleProfileSave}
						disabled={profileMutation.isPending}
					>
						{profileMutation.isPending 
							? t("account.settings.profile.saving")
							: t("account.settings.profile.save")
						}
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
							id="two-factor-switch"
							checked={state.twoFactor.isEnabled}
							onCheckedChange={handleTwoFactorToggle}
							disabled={state.twoFactor.isSubmitting}
						/>
					</div>
					<span className="font-normal leading-snug text-muted-foreground">
						{t("account.settings.twoFactor.willPrompt")}
					</span>

					{/* Section to display QR code and recovery codes after successful enablement */}
					<div className="space-y-4 pt-4 border-t">
						{state.twoFactor.totpURI && state.twoFactor.showTotpVerification && (
							<>
								<div className="p-4 border rounded-md bg-green-50 dark:bg-green-900/30">
									<h3 className="font-semibold text-green-700 dark:text-green-400">
										{t("account.settings.twoFactor.completeYour2FASetup")}
									</h3>
									<p className="text-sm text-green-600 dark:text-green-500 mb-2">
										{t("account.settings.twoFactor.scanQrCode")}
									</p>
									<div className="my-4 p-2 border rounded bg-white dark:bg-slate-800 flex justify-center">
										<QRCodeCanvas
											value={state.twoFactor.totpURI}
											size={200}
											bgColor={"#ffffff"}
											fgColor={"#000000"}
											level={"H"}
										/>
									</div>
								</div>

								{/* Backup Codes Section - Critical to save now */}
								{state.twoFactor.backupCodes && (
									<div className="p-4 border rounded-md bg-amber-50 dark:bg-amber-900/30">
										<h3 className="font-semibold text-amber-700 dark:text-amber-400 mb-2">
											⚠️ {t("account.settings.twoFactor.backupCodes")}
										</h3>
										<p className="text-sm text-amber-600 dark:text-amber-500 mb-3 font-medium">
											{t("account.settings.twoFactor.backupCodesWarning", {
												defaultValue: "Save these backup codes now! You won't be able to see them again. Each code can only be used once."
											})}
										</p>
										<div className="p-3 border rounded bg-white dark:bg-slate-800 space-y-1 mb-3">
											{state.twoFactor.backupCodes.map((code) => (
												<pre
													key={code}
													className="text-sm font-mono p-2 bg-slate-50 dark:bg-slate-700 rounded border"
												>
													{code}
												</pre>
											))}
										</div>
										<div className="flex gap-2 mb-4">
											<Button
												variant="outline"
												size="sm"
												onClick={handleCopyBackupCodes}
											>
												📋 Copy All Codes
											</Button>
											<Button
												variant="outline"
												size="sm"
												onClick={handleDownloadBackupCodes}
											>
												💾 Download as File
											</Button>
										</div>
										<div className="flex items-center space-x-2">
											<Checkbox 
												id="backup-codes-saved"
												checked={state.twoFactor.hasConfirmedBackupCodes}
												onCheckedChange={handleConfirmBackupCodes}
											/>
											<Label htmlFor="backup-codes-saved" className="text-sm font-medium">
												{t("account.settings.twoFactor.confirmSavedCodes", {
													defaultValue: "I have safely saved these backup codes"
												})}
											</Label>
										</div>
									</div>
								)}

								{/* TOTP Verification Input Section */}
								<div className="p-4 border rounded-md bg-sky-50 dark:bg-sky-900/30 mt-4">
									<h3 className="font-semibold text-sky-700 dark:text-sky-400">
										{t("account.settings.twoFactor.verifyAuthenticatorApp")}
									</h3>
									<p className="text-sm text-sky-600 dark:text-sky-500 mb-3">
										{t("account.settings.twoFactor.enter6DigitCode")}
									</p>
									<div className="flex items-center space-x-2">
										<InputOTP
											maxLength={6}
											value={state.twoFactor.totpCode}
											onChange={(value) => dispatch({ type: "SET_TOTP_CODE", value })}
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
											onClick={handleTotpVerification}
											disabled={
												state.twoFactor.isVerifyingTotp || 
												state.twoFactor.totpCode.length !== 6 || 
												!state.twoFactor.hasConfirmedBackupCodes
											}
										>
											{state.twoFactor.isVerifyingTotp
												? t("account.settings.twoFactor.verifying")
												: t("account.settings.twoFactor.verifyAndComplete")}
										</Button>
									</div>
									{!state.twoFactor.hasConfirmedBackupCodes && (
										<p className="text-xs text-red-600 dark:text-red-400 mt-2">
											⚠️ Please save your backup codes before completing setup
										</p>
									)}
								</div>
							</>
						)}
						
						{state.twoFactor.isEnabled && !state.twoFactor.showTotpVerification && (
							<div className="p-4 border rounded-md bg-green-50 dark:bg-green-900/30">
								<h3 className="font-semibold text-green-700 dark:text-green-400 mb-2">
									✅ Two-Factor Authentication Enabled
								</h3>
								<p className="text-sm text-green-600 dark:text-green-500">
									{t("account.settings.twoFactor.alreadyEnabled", {
										defaultValue: "Your account is protected with two-factor authentication. Your backup codes have been safely stored and encrypted."
									})}
								</p>
							</div>
						)}
					</div>
				</CardContent>
			</Card>

			<Dialog
				open={state.twoFactor.isPasswordDialogOpen}
				onOpenChange={(open) => {
					if (state.twoFactor.isSubmitting) return; // Prevent closing while submitting
					if (!open) {
						dispatch({ type: "CLOSE_PASSWORD_DIALOG" });
					}
				}}
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
							<Label htmlFor="password-confirm" className="text-right">
								{t("account.settings.twoFactor.passwordDialog.password")}
							</Label>
							<Input
								id="password-confirm"
								type="password"
								value={state.twoFactor.passwordInput}
								onChange={(e) => dispatch({ type: "SET_PASSWORD", value: e.target.value })}
								className="col-span-3"
								disabled={state.twoFactor.isSubmitting}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								if (state.twoFactor.isSubmitting) return;
								dispatch({ type: "CLOSE_PASSWORD_DIALOG" });
							}}
							disabled={state.twoFactor.isSubmitting}
						>
							{t("account.settings.twoFactor.passwordDialog.cancel")}
						</Button>
						<Button
							type="submit"
							onClick={handlePasswordConfirm}
							disabled={state.twoFactor.isSubmitting || !state.twoFactor.passwordInput}
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
