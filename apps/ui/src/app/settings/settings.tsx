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
import { useQuery } from "@tanstack/react-query";
import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

// Define interfaces for Better Auth error structure
interface BetterAuthErrorDetail {
	code?: string;
	message?: string;
	status?: number;
	statusText?: string;
}

export function Settings() {
	const { setSteps, startTour } = useTour();
	const { t } = useTranslation();
	const [user, setUser] = useState<Awaited<ReturnType<typeof authClient.getSession>>["data"]["user"] | null>(null);
	const [username, setUsername] = useState<string>();
	const [email, setEmail] = useState<string>();
	const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState<boolean>(false);
	const [isBackupCodesVisible, setIsBackupCodesVisible] = useState<boolean>(false);

	const steps: TourStep[] = [
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
	];

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		if (localStorage.getItem("settings_tour_completed") === "true") {
			return;
		}
		setSteps(steps);
		startTour();
	}, [setSteps]);

	useEffect(() => {
		const fetchSession = async () => {
			const session = await authClient.getSession();
			if (!session.data) {
				return;
			}
			setUser(session.data.user);
			setUsername(session.data.user.name);
			setEmail(session.data.user.email);
			setIsTwoFactorEnabled(session.data.user.twoFactorEnabled || false);
		};
		fetchSession();
	}, []);

	const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
	const [passwordInput, setPasswordInput] = useState("");
	const [twoFactorAction, setTwoFactorAction] = useState<
		"enable" | "disable" | null
	>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// State for QR code and recovery codes
	const [totpURIForQrCode, setTotpURIForQrCode] = useState<string | null>(null);
	const [currentBackupCodes, setCurrentBackupCodes] = useState<string[] | null>(
		null,
	);

	// State for TOTP verification step
	const [totpCodeInput, setTotpCodeInput] = useState<string>("");
	const [showTotpVerificationInput, setShowTotpVerificationInput] =
		useState<boolean>(false);
	const [isVerifyingTotp, setIsVerifyingTotp] = useState<boolean>(false);

	const backupCodesQuery = useQuery({
		queryKey: ["backupCodes", user?.id],
		queryFn: async () => {
			if (!user?.id) return null;
			const response = await fetch(
				`${import.meta.env.VITE_API_URL}/api/auth/backup-codes`,
				{credentials: 'include'}
			);
			if (!response.ok) {
				throw new Error("Failed to fetch backup codes");
			}
			const data = await response.json();
			return data.backupCodes as string[];
		},
		enabled: !!user?.id,
	});

	// Placeholder for the data structure returned on successful 2FA enablement
	interface TwoFactorEnableSuccessData {
		totpURI: string; // Corrected from otpauth_url based on lint
		backupCodes: string[]; // Corrected from recovery_codes based on lint
	}

	// Placeholder for the data structure returned on successful 2FA disablement
	interface TwoFactorDisableSuccessData {
		status: boolean;
	}

	const handleProfileSave = () => {
		// Add logic to save profile data
		console.log("Profile saved:", { username, email });
		toast.success("Profile settings saved!");
	};

	const handleTwoFactorToggleSwitch = (enabled: boolean) => {
		setTwoFactorAction(enabled ? "enable" : "disable");
		setIsPasswordDialogOpen(true);
		// Note: We don't immediately set isTwoFactorEnabled here.
		// The switch will visually change, but the actual state is updated after successful API call.
	};

	const confirmTwoFactorChange = async () => {
		if (!twoFactorAction || !passwordInput) {
			toast.error("Password is required.");
			return;
		}

		setIsSubmitting(true);
		let keepDialogOpenDueToError = false;

		type TwoFactorResponse = {
			data: TwoFactorEnableSuccessData | TwoFactorDisableSuccessData | null;
			error: BetterAuthErrorDetail | null;
		};

		let response: TwoFactorResponse;

		if (twoFactorAction === "enable") {
			// Explicitly type the expected response for the enable action
			response = (await authClient.twoFactor.enable({
				password: passwordInput,
			})) as {
				data: TwoFactorEnableSuccessData | null;
				error: BetterAuthErrorDetail | null;
			};
		} else {
			// Explicitly type the expected response for the disable action
			response = (await authClient.twoFactor.disable({
				password: passwordInput,
			})) as {
				data: TwoFactorDisableSuccessData | null;
				error: BetterAuthErrorDetail | null;
			};
		}

		if (response.error) {
			console.error(`Failed to ${twoFactorAction} 2FA:`, response.error);
			let errorMessage =
				response.error.message || "An unexpected error occurred.";

			if (response.error.code === "INVALID_PASSWORD") {
				errorMessage =
					response.error.message || "Invalid password. Please try again.";
				setPasswordInput("");
				keepDialogOpenDueToError = true;
			}
			toast.error(`Failed to ${twoFactorAction} 2FA: ${errorMessage}`);
			if (!keepDialogOpenDueToError) {
				setIsPasswordDialogOpen(false);
				setPasswordInput("");
			}
			// If enabling failed, clear any stale QR/recovery data
			if (twoFactorAction === "enable") {
				setTotpURIForQrCode(null);
				setCurrentBackupCodes(null);
			}
		} else if (response.data) {
			// Success case
			if (twoFactorAction === "enable") {
				const enableData = response.data as TwoFactorEnableSuccessData;
				console.log("2FA Enable Data:", enableData);

				setTotpURIForQrCode(enableData.totpURI);
				setCurrentBackupCodes(enableData.backupCodes);
				setShowTotpVerificationInput(true); // Show TOTP input for verification
				// setIsTwoFactorEnabled(true); // Don't set this true until TOTP is verified
				toast.success(
					"Scan QR, save codes, then enter verification code below.",
				);
			} else {
				// const disableData = response.data as TwoFactorDisableSuccessData; // if needed
				setIsTwoFactorEnabled(false);
				toast.success("Two-Factor Authentication disabled successfully!");
				// Clear QR/recovery data when disabling
				setTotpURIForQrCode(null);
				setCurrentBackupCodes(null);
			}
			setIsPasswordDialogOpen(false);
			setPasswordInput("");
		} else {
			// Should not happen if API guarantees data or error
			console.error("2FA response had no data and no error", response);
			toast.error("An unexpected issue occurred with the 2FA service.");
			setIsPasswordDialogOpen(false);
			setPasswordInput("");
		}

		setIsSubmitting(false);
		if (!keepDialogOpenDueToError) {
			setTwoFactorAction(null); // Reset action only if dialog is not kept open for retry
		}
	};

	const handleVerifyTotpCode = async () => {
		if (totpCodeInput.length !== 6) {
			toast.error("Please enter a 6-digit verification code.");
			return;
		}
		setIsVerifyingTotp(true);
		const { data, error } = await authClient.twoFactor.verifyTotp({
			code: totpCodeInput,
		});

		if (error) {
			console.error("Failed to verify TOTP code:", error);
			toast.error(
				error.message || "Invalid verification code. Please try again.",
			);
			setTotpCodeInput(""); // Clear input on error
		} else if (data) {
			// Assuming data confirms verification, e.g., data.verified === true or similar
			// For now, we'll assume any non-error response means success
			console.log("TOTP Verification Success:", data);
			toast.success("Two-Factor Authentication setup complete and verified!");
			setIsTwoFactorEnabled(true); // Now 2FA is fully enabled
			setShowTotpVerificationInput(false);
			setTotpCodeInput("");
			// Optionally, clear QR and backup codes from state if they are not meant to be shown persistently after setup
			// setTotpURIForQrCode(null);
			// setCurrentBackupCodes(null);
		}
		setIsVerifyingTotp(false);
	};

	const toggleViewBackupCodes = async () => {
		if (!user.id) {
			toast.error("Could not load your user ID.");
			return;
		}
		if (!backupCodesQuery.data) {
			toast.error("Could not load your backup codes.");
			return;
		}
		setCurrentBackupCodes(backupCodesQuery.data);
		setIsBackupCodesVisible(!isBackupCodesVisible);
	};

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
							value={username}
							onChange={(e) => setUsername(e.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="email">{t("account.settings.profile.email")}</Label>
						<Input
							id="email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
						/>
					</div>
				</CardContent>
				<CardFooter>
					<Button onClick={handleProfileSave}>
						{t("account.settings.profile.save")}
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
							checked={isTwoFactorEnabled}
							onCheckedChange={handleTwoFactorToggleSwitch}
							disabled={isSubmitting}
						/>
					</div>
					<span className="font-normal leading-snug text-muted-foreground">
						{t("account.settings.twoFactor.willPrompt")}
					</span>

					{/* Section to display QR code and recovery codes after successful enablement */}
					<div className="space-y-4 pt-4 border-t">
						{totpURIForQrCode && showTotpVerificationInput && (
							<>
								<div className="p-4 border rounded-md bg-green-50 dark:bg-green-900/30">
									<h3 className="font-semibold text-green-700 dark:text-green-400">
										{t("account.settings.twoFactor.completeYour2FASetup")}
									</h3>
									<p className="text-sm text-green-600 dark:text-green-500 mb-2">
										{t("account.settings.twoFactor.scanQrCode")}
									</p>
									<div className="my-4 p-2 border rounded bg-white dark:bg-slate-800 flex justify-center">
										{totpURIForQrCode && (
											<QRCodeCanvas
												value={totpURIForQrCode}
												size={200}
												bgColor={"#ffffff"}
												fgColor={"#000000"}
												level={"H"}
											/>
										)}
									</div>
								</div>

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
											value={totpCodeInput}
											onChange={(value) => setTotpCodeInput(value)}
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
											onClick={handleVerifyTotpCode}
											disabled={isVerifyingTotp || totpCodeInput.length !== 6}
										>
											{isVerifyingTotp
												? t("account.settings.twoFactor.verifying")
												: t("account.settings.twoFactor.verifyAndComplete")}
										</Button>
									</div>
								</div>
							</>
						)}
						<Button variant="outline" onClick={toggleViewBackupCodes}>
							{isBackupCodesVisible ? "Hide Backup Codes" : "View Backup Codes"}
						</Button>
						{currentBackupCodes && isBackupCodesVisible && (
							<div className="p-4 border rounded-md bg-amber-50 dark:bg-amber-900/30">
								<h3 className="font-semibold text-amber-700 dark:text-amber-400">
									{t("account.settings.twoFactor.backupCodes")}
								</h3>
								<p className="text-sm text-amber-600 dark:text-amber-500 mb-2">
									{t("account.settings.twoFactor.backupCodesDescription")}
								</p>
								<div className="p-2 border rounded bg-slate-100 dark:bg-slate-800 space-y-1">
									{currentBackupCodes.map((code) => (
										<pre
											key={code}
											className="text-sm font-mono p-1 bg-white dark:bg-slate-700 rounded"
										>
											{code}
										</pre>
									))}
								</div>
								<Button
									variant="outline"
									className="mt-3"
									onClick={() =>
										navigator.clipboard.writeText(currentBackupCodes.join("\n"))
									}
								>
									{t("account.settings.twoFactor.copyBackupCodes")}
								</Button>
							</div>
						)}
					</div>
				</CardContent>
			</Card>

			<Dialog
				open={isPasswordDialogOpen}
				onOpenChange={(open) => {
					if (isSubmitting) return; // Prevent closing while submitting
					setIsPasswordDialogOpen(open);
					if (!open) {
						setPasswordInput("");
						setTwoFactorAction(null);
						// If dialog is closed without confirming, and 2FA wasn't actually changed,
						// revert switch if necessary (though `checked` prop should handle this by binding to `isTwoFactorEnabled`)
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
								action: twoFactorAction,
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
								value={passwordInput}
								onChange={(e) => setPasswordInput(e.target.value)}
								className="col-span-3"
								disabled={isSubmitting}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								if (isSubmitting) return;
								setIsPasswordDialogOpen(false);
							}}
							disabled={isSubmitting}
						>
							{t("account.settings.twoFactor.passwordDialog.cancel")}
						</Button>
						<Button
							type="submit"
							onClick={confirmTwoFactorChange}
							disabled={isSubmitting || !passwordInput}
						>
							{isSubmitting
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
