import { Button } from "@/components/ui/button";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSeparator,
	InputOTPSlot,
} from "@/components/ui/input-otp";
import { authClient } from "@/lib/auth-client";
import { Loader2 } from "lucide-react";
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
	console.log(result);
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
	const [otp, setOtp] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const navigate = useNavigate();

	const handleOtpSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsLoading(true);
		try {
			await authClient.twoFactor.verifyTotp(
				{ code: otp },
				{
					async onSuccess() {
						toast.success("Signed in successfully with 2FA!");
						navigate("/");
					},
					async onError(res) {
						const errorDetail = extractAuthErrorMessage(res);
						toast.error(errorDetail);
						console.error("2FA verification failed:", res);
					},
				},
			);
		} catch (err: unknown) {
			const errorDetail = extractAuthErrorMessage(err as object);
			toast.error(errorDetail);
			console.error("2FA verification failed:", err);
		} finally {
			setIsLoading(false);
		}
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
			<form className="space-y-4 w-full max-w-xs" onSubmit={handleOtpSubmit}>
				<InputOTP
					maxLength={6}
					value={otp}
					onChange={(value) => setOtp(value)}
					disabled={isLoading}
					autoFocus
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
					disabled={isLoading || otp.length !== 6}
				>
					{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
					{t("auth.signIn.twoFactor.button")}
				</Button>
			</form>
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
