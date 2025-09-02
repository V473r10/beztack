import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { SignInForm } from "./components/form";

export default function SignIn() {
	const { t } = useTranslation();
	return (
		<>
			<div className="text-center space-y-1">
				<h1 className="text-2xl font-semibold tracking-tight">
					{t("auth.signIn.title")}
				</h1>
				<p className="text-sm text-muted-foreground">
					{t("auth.signIn.description")}
				</p>
			</div>

			<Card className="w-full">
				<CardHeader className="space-y-1">
					<CardTitle className="text-2xl">{t("auth.signIn.title")}</CardTitle>
					<CardDescription>{t("auth.signIn.description")}</CardDescription>
				</CardHeader>
				<CardContent>
					<SignInForm />
				</CardContent>
				<CardFooter className="flex flex-wrap items-center justify-between gap-2">
					<div className="text-sm text-muted-foreground">
						<span className="mr-1 hidden sm:inline-block">
							{t("auth.signIn.noAccount")}
						</span>
						<Button
							aria-label="Sign up"
							variant="link"
							className="h-auto p-0 text-primary"
							asChild
						>
							<Link to="/auth/sign-up">{t("auth.signIn.signUp")}</Link>
						</Button>
					</div>
					<Button
						aria-label="Reset password"
						variant="link"
						className="h-auto p-0 text-primary"
						asChild
					>
						<Link to="/auth/reset-password">{t("auth.signIn.forgotPassword")}</Link>
					</Button>
				</CardFooter>
			</Card>
		</>
	);
}
