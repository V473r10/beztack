import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppForm } from "@/components/ui/tanstack-form";
import { authClient } from "@/lib/auth-client";
import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";

const passwordSchema = (t: (key: string) => string) => z
	.string()
	.min(8, { message: t("validation.password.length") })
	.regex(/[A-Z]/, { message: t("validation.password.uppercase") })
	.regex(/[a-z]/, { message: t("validation.password.lowercase") })
	.regex(/[0-9]/, { message: t("validation.password.number") })
	.regex(/[^A-Za-z0-9]/, {
		message: t("validation.password.special"),
	});

const getFormSchema = (t: (key: string) => string) => z
	.object({
		name: z.string().min(2, {
			message: t("validation.name.length"),
		}),
		email: z.string().email({
			message: t("validation.email.invalid"),
		}),
		password: passwordSchema(t),
		confirmPassword: z.string(),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: t("validation.confirmPassword.match"),
		path: ["confirmPassword"],
	});

export function SignUpForm() {
	const { t } = useTranslation();
	const [isLoading, setIsLoading] = useState(false);
	const FormSchema = getFormSchema(t);
	const navigate = useNavigate();

	const form = useAppForm({
		validators: { onChange: FormSchema },
		defaultValues: {
			name: "",
			email: "",
			password: "",
			confirmPassword: "",
		},
		onSubmit: async ({ value }) => {
			setIsLoading(true);
			try {
				await authClient.signUp.email({
					name: value.name,
					email: value.email,
					password: value.password,
				});
				toast.success(t("notifications.account.created"));
				navigate("/");
			} catch (err) {
				const errorMessage =
					err instanceof Error
						? err.message
						: t("notifications.account.creationFailed");
				toast.error(errorMessage);
				console.error("Sign up failed:", err);
			} finally {
				setIsLoading(false);
			}
		},
	});

	const handleSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault();
			e.stopPropagation();
			form.handleSubmit();
		},
		[form],
	);

	return (
		<form.AppForm>
			<form onSubmit={handleSubmit} className="space-y-4">
				<form.AppField name="name">
					{(field) => (
						<field.FormItem>
							<field.FormLabel>{t("form.fullName.label")}</field.FormLabel>
							<field.FormControl>
								<Input
									placeholder={t("form.fullName.placeholder")}
									autoComplete="name"
									disabled={isLoading}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
								/>
							</field.FormControl>
							<field.FormMessage />
						</field.FormItem>
					)}
				</form.AppField>

				<form.AppField name="email">
					{(field) => (
						<field.FormItem>
							<field.FormLabel>{t("form.email.label")}</field.FormLabel>
							<field.FormControl>
								<Input
									placeholder={t("form.email.placeholder")}
									type="email"
									autoCapitalize="none"
									autoComplete="email"
									autoCorrect="off"
									disabled={isLoading}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
								/>
							</field.FormControl>
							<field.FormMessage />
						</field.FormItem>
					)}
				</form.AppField>

				<form.AppField name="password">
					{(field) => {
						const value = field.state.value || "";
						return (
							<field.FormItem>
								<field.FormLabel>{t("form.password.label")}</field.FormLabel>
								<field.FormControl>
									<Input
										type="password"
										autoComplete="new-password"
										disabled={isLoading}
										value={value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
									/>
								</field.FormControl>
								<field.FormMessage />
								<p className="text-sm font-medium text-destructive">
									{t("form.password.mustContain")}
								</p>
								<ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
									<li>{t("form.password.requirements.length")}</li>
									<li>{t("form.password.requirements.uppercase")}</li>
									<li>{t("form.password.requirements.lowercase")}</li>
									<li>{t("form.password.requirements.number")}</li>
									<li>{t("form.password.requirements.special")}</li>
								</ul>
							</field.FormItem>
						);
					}}
				</form.AppField>

				<form.AppField name="confirmPassword">
					{(field) => (
						<field.FormItem>
							<field.FormLabel>{t("form.confirmPassword.label")}</field.FormLabel>
							<field.FormControl>
								<Input
									type="password"
									autoComplete="new-password"
									disabled={isLoading}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
								/>
							</field.FormControl>
							<field.FormMessage />
						</field.FormItem>
					)}
				</form.AppField>

				<Button type="submit" className="w-full" disabled={isLoading}>
					{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
					{t("form.createAccountButton")}
				</Button>
			</form>
		</form.AppForm>
	);
}
