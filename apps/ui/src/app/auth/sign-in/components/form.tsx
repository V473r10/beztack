import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppForm } from "@/components/ui/tanstack-form";
import { focusFirstInvalidField } from "@/lib/form-errors";
import { AuthFormError } from "../../auth-form-error";
import { submitSignIn } from "../../auth-submissions";

const MIN_PASSWORD_LENGTH = 8;

const getFormSchema = (t: (key: string) => string) =>
  z.object({
    email: z.string().email({ message: t("validation.email.invalid") }),
    password: z.string().min(MIN_PASSWORD_LENGTH, { message: t("validation.password.length") }),
  });

export function SignInForm() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  const formRef = useRef<HTMLFormElement>(null);
  const FormSchema = getFormSchema(t);

  const form = useAppForm({
    validators: { onChange: FormSchema },
    onSubmitInvalid: () => {
      // The errors render on the next frame; then move focus to the first one.
      requestAnimationFrame(() => focusFirstInvalidField(formRef.current));
    },
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      setIsLoading(true);
      setFormError(null);
      const error = await submitSignIn(value, location.search, { t, navigate, queryClient });
      setFormError(error);
      setIsLoading(false);
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
      <form className="space-y-4" noValidate onSubmit={handleSubmit} ref={formRef}>
        <form.AppField name="email">
          {(field) => (
            <field.FormItem deferErrors>
              <field.FormLabel>{t("auth.signIn.form.email")}</field.FormLabel>
              <field.FormControl>
                <Input
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect="off"
                  disabled={isLoading}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t("form.email.placeholder")}
                  type="email"
                  value={field.state.value}
                />
              </field.FormControl>
              <field.FormMessage />
            </field.FormItem>
          )}
        </form.AppField>

        <form.AppField name="password">
          {(field) => (
            <field.FormItem deferErrors>
              <div className="flex items-center justify-between">
                <field.FormLabel>{t("auth.signIn.form.password")}</field.FormLabel>
                <Button
                  asChild
                  className="h-auto p-0 text-muted-foreground text-xs"
                  tabIndex={-1}
                  variant="link"
                >
                  <Link className="hover:underline" to="/auth/reset-password">
                    {t("auth.signIn.form.forgotPassword")}
                  </Link>
                </Button>
              </div>
              <div className="relative">
                <field.FormControl>
                  <Input
                    autoComplete="current-password"
                    className="pr-10"
                    disabled={isLoading}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    type={showPassword ? "text" : "password"}
                    value={field.state.value}
                  />
                </field.FormControl>
                <button
                  aria-label={showPassword ? t("form.password.hide") : t("form.password.show")}
                  className="-translate-y-1/2 absolute top-1/2 right-3 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  type="button"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <field.FormMessage />
            </field.FormItem>
          )}
        </form.AppField>

        <AuthFormError message={formError} />

        <Button className="w-full" disabled={isLoading} type="submit">
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("auth.signIn.form.button")}
        </Button>
      </form>
    </form.AppForm>
  );
}
