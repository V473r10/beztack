import { Button } from "@/components/ui/button";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSeparator,
	InputOTPSlot,
} from "@/components/ui/input-otp";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";
import { Loader2, Shield, Key } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";

interface AuthError {
	error: {
		message?: string;
	};
}

const extractAuthErrorMessage = (result: unknown): string => {
	if (typeof result === "object" && result !== null && "error" in result) {
		return (
			(result as AuthError).error.message ||
			"An unknown authentication error occurred."
		);
	}
	return "An unknown authentication error occurred.";
};

const TwoFactor = () => {
	const { t } = useTranslation();
	const [totpCode, setTotpCode] = useState("");
	const [backupCode, setBackupCode] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [verificationMethod, setVerificationMethod] = useState<"totp" | "backup">("totp");
	const navigate = useNavigate();


	const handleTotpSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		e.stopPropagation();
		
		setIsLoading(true);
		try {
			await authClient.twoFactor.verifyTotp(
				{ code: totpCode },
				{
					async onSuccess() {
						toast.success("Signed in successfully with 2FA!");
						navigate("/");
					},
					async onError(res) {
						const errorDetail = extractAuthErrorMessage(res);
						toast.error(errorDetail);
					},
				},
			);
		} catch (err: unknown) {
			const errorDetail = extractAuthErrorMessage(err as object);
			toast.error(errorDetail);
		} finally {
			setIsLoading(false);
		}
	};

	const handleBackupCodeSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		e.stopPropagation();
		
		if (backupCode.length !== 11 || !isValidBackupCode(backupCode)) {
			toast.error("Please enter a valid backup code format (XXXXX-XXXXX)");
			return;
		}
		
		setIsLoading(true);
		
		try {
			// Try with dash format first (original format from API)
			await authClient.twoFactor.verifyBackupCode(
				{ code: backupCode },
				{
					async onSuccess() {
						toast.success("Signed in successfully with backup code!");
						navigate("/");
					},
					async onError(_res) {
						// If dash format fails, try without dash
						const codeWithoutDash = backupCode.replace('-', '');
						try {
							await authClient.twoFactor.verifyBackupCode(
								{ code: codeWithoutDash },
								{
									async onSuccess() {
										toast.success("Signed in successfully with backup code!");
										navigate("/");
									},
									async onError(res) {
										const errorDetail = extractAuthErrorMessage(res);
										toast.error(`Verification failed: ${errorDetail}`);
									},
								},
							);
						} catch (err: unknown) {
							const errorDetail = extractAuthErrorMessage(err as object);
							toast.error(`Verification failed: ${errorDetail}`);
						} finally {
							setIsLoading(false);
						}
					},
				},
			);
		} catch (err: unknown) {
			const errorDetail = extractAuthErrorMessage(err as object);
			toast.error(`Verification failed: ${errorDetail}`);
			setIsLoading(false);
		}
	};

	const isValidBackupCode = (value: string) => {
		// Primary format: 5 characters, dash, 5 characters (total 11)
		const primaryFormat = /^[A-Za-z0-9]{5}-[A-Za-z0-9]{5}$/;
		return primaryFormat.test(value);
	};

	const handleBackupCodeChange = (value: string) => {
		// Allow alphanumeric and dash, max 11 characters (preserve original case)
		const formattedValue = value.replace(/[^A-Za-z0-9-]/g, '').slice(0, 11);
		setBackupCode(formattedValue);
	};

	return (
		<div className="flex flex-col items-center justify-center space-y-6 pt-8">
			<div className="text-center">
				<h1 className="text-2xl font-semibold tracking-tight">
					{t("auth.signIn.twoFactor.title")}
				</h1>
				<p className="text-sm text-muted-foreground">
					{t("auth.signIn.twoFactor.description")}
				</p>
			</div>

			<Tabs value={verificationMethod} onValueChange={(value) => setVerificationMethod(value as "totp" | "backup")} className="w-full max-w-md">
				<TabsList className="grid w-full grid-cols-2">
					<TabsTrigger value="totp" className="flex items-center gap-2">
						<Shield className="h-4 w-4" />
						{t("auth.signIn.twoFactor.authenticatorApp", { defaultValue: "Authenticator App" })}
					</TabsTrigger>
					<TabsTrigger value="backup" className="flex items-center gap-2">
						<Key className="h-4 w-4" />
						{t("auth.signIn.twoFactor.backupCode", { defaultValue: "Backup Code" })}
					</TabsTrigger>
				</TabsList>

				<TabsContent value="totp" className="space-y-4">
					<div className="text-center space-y-2">
						<p className="text-sm text-muted-foreground">
							{t("auth.signIn.twoFactor.totpDescription", { defaultValue: "Enter the 6-digit code from your authenticator app" })}
						</p>
					</div>
					<form className="space-y-4" onSubmit={handleTotpSubmit}>
						<InputOTP
							maxLength={6}
							value={totpCode}
							onChange={(value) => setTotpCode(value)}
							disabled={isLoading}
							autoFocus
							pattern="[0-9]*"
						>
							<InputOTPGroup className="w-full flex justify-center">
								<InputOTPSlot index={0} />
								<InputOTPSlot index={1} />
								<InputOTPSlot index={2} />
							</InputOTPGroup>
							<InputOTPSeparator />
							<InputOTPGroup className="w-full flex justify-center">
								<InputOTPSlot index={3} />
								<InputOTPSlot index={4} />
								<InputOTPSlot index={5} />
							</InputOTPGroup>
						</InputOTP>
						<Button
							type="submit"
							className="w-full"
							disabled={isLoading || totpCode.length !== 6}
						>
							{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							{t("auth.signIn.twoFactor.verifyCode", { defaultValue: "Verify Code" })}
						</Button>
					</form>
				</TabsContent>

				<TabsContent value="backup" className="space-y-4">
					<div className="text-center space-y-2">
						<p className="text-sm text-muted-foreground">
							{t("auth.signIn.twoFactor.backupCodeDescription", { defaultValue: "Enter one of your backup codes" })}
						</p>
						<p className="text-xs text-amber-600 dark:text-amber-400">
							⚠️ {t("auth.signIn.twoFactor.backupCodeWarning", { defaultValue: "Each backup code can only be used once" })}
						</p>
					</div>
					<form className="space-y-4" onSubmit={handleBackupCodeSubmit}>
						<InputOTP
							maxLength={11}
							value={backupCode}
							onChange={handleBackupCodeChange}
							disabled={isLoading}
							autoFocus
						>
							<InputOTPGroup className="w-full flex justify-center">
								<InputOTPSlot index={0} />
								<InputOTPSlot index={1} />
								<InputOTPSlot index={2} />
								<InputOTPSlot index={3} />
								<InputOTPSlot index={4} />
							</InputOTPGroup>
							<InputOTPSeparator>
								<span className="text-muted-foreground">-</span>
							</InputOTPSeparator>
							<InputOTPGroup className="w-full flex justify-center">
								<InputOTPSlot index={6} />
								<InputOTPSlot index={7} />
								<InputOTPSlot index={8} />
								<InputOTPSlot index={9} />
								<InputOTPSlot index={10} />
							</InputOTPGroup>
						</InputOTP>
						<Button
							type="submit"
							className="w-full"
							disabled={isLoading || !isValidBackupCode(backupCode)}
						>
							{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							{t("auth.signIn.twoFactor.verifyBackupCode", { defaultValue: "Verify Backup Code" })}
						</Button>
					</form>
				</TabsContent>
			</Tabs>

			<Button
				variant="link"
				className="h-auto p-0 text-xs"
				onClick={() => navigate("/auth/sign-in")}
				disabled={isLoading}
			>
				{t("auth.signIn.backToSignIn")}
			</Button>
		</div>
	);
};

export default TwoFactor;
