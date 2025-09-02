import { LanguageToggle } from "@/components/language-toggle";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";

interface AuthLayoutProps {
	className?: string;
}

const AuthLayout = ({ className }: AuthLayoutProps) => {
	const { t } = useTranslation();
	return (
		<div className="min-h-screen flex">
			{/* Sidebar */}
			<div className="hidden lg:flex w-1/2 bg-primary text-primary-foreground p-12 flex-col justify-between">
				<div>
					<h1 className="text-4xl font-bold mb-4">{t("auth.signIn.title")}</h1>
					<p className="text-primary-foreground/80">
						{t("common.workflowStreamline")}
					</p>
				</div>
				<div className="text-sm text-primary-foreground/60">
					{t("common.footer", { year: new Date().getFullYear() })}
				</div>
			</div>

			{/* Main Content */}
			<div className="relative w-full lg:w-1/2 flex items-center justify-center p-8">
				<div className="absolute top-8 right-8">
					<LanguageToggle />
				</div>
				<div className={cn("w-full max-w-md space-y-8", className)}>
					<div className="text-center lg:hidden mb-8">
						<h1 className="text-3xl font-bold">{t("common.yourLogo")}</h1>
					</div>
					<Outlet />
				</div>
			</div>
		</div>
	);
};

export default AuthLayout;
