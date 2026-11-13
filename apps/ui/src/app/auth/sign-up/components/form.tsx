import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppForm, useFieldContext } from "@/components/ui/tanstack-form";
import { focusFirstInvalidField } from "@/lib/form-errors";
import { AuthFormError } from "../../auth-form-error";
import { submitSignUp } from "../../auth-submissions";
import { PasswordChecklist } from "./password-checklist";
import { PASSWORD_RULES } from "./password-rules";

const passwordSchema = (t: (key: string) => string) =>
  z.string().superRefine((value, ctx) => {
    for (const rule of PASSWORD_RULES) {
      if (!rule.test(value)) {
        ctx.addIssue({ code: "custom", message: t(rule.errorKey) });
      }
    }
  });

const getFormSchema = (t: (key: string) => string) =>
  z
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
      message: t("validation.password.match"),
      path: ["confirmPassword"],
    });

/** Checklist wired as the description of the password input, so screen readers read the rules. */
function PasswordRules({ password }: { password: string }) {
  const { formDescriptionId, errors } = useFieldContext();
  return (
    <PasswordChecklist id={formDescriptionId} password={password} showUnmet={errors.length > 0} />
  );
}

export function SignUpForm() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const FormSchema = getFormSchema(t);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  const formRef = useRef<HTMLFormElement>(null);

  const form = useAppForm({
    validators: { onChange: FormSchema },
    onSubmitInvalid: () => {
      // The errors render on the next frame; then move focus to the first one.
      requestAnimationFrame(() => focusFirstInvalidField(formRef.current));
    },
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    onSubmit: async ({ value }) => {
      setIsLoading(true);
      setFormError(null);
      const error = await submitSignUp(value, location.search, { t, navigate, queryClient });
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
        <form.AppField name="name">
          {(field) => (
            <field.FormItem deferErrors>
              <field.FormLabel>{t("form.fullName.label")}</field.FormLabel>
              <field.FormControl>
                <Input
                  autoComplete="name"
                  disabled={isLoading}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t("form.fullName.placeholder")}
                  value={field.state.value}
                />
              </field.FormControl>
              <field.FormMessage />
            </field.FormItem>
          )}
        </form.AppField>

        <form.AppField name="email">
          {(field) => (
            <field.FormItem deferErrors>
              <field.FormLabel>{t("form.email.label")}</field.FormLabel>
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
          {(field) => {
            const value = field.state.value || "";
            return (
              <field.FormItem deferErrors>
                <field.FormLabel>{t("form.password.label")}</field.FormLabel>
                <div className="relative">
                  <field.FormControl>
                    <Input
                      autoComplete="new-password"
                      className="pr-10"
                      disabled={isLoading}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      type={showPassword ? "text" : "password"}
                      value={value}
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
                <PasswordRules password={value} />
              </field.FormItem>
            );
          }}
        </form.AppField>

        <form.AppField name="confirmPassword">
          {(field) => (
            <field.FormItem deferErrors>
              <field.FormLabel>{t("form.confirmPassword.label")}</field.FormLabel>
              <div className="relative">
                <field.FormControl>
                  <Input
                    autoComplete="new-password"
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
          {t("form.createAccountButton")}
        </Button>
      </form>
    </form.AppForm>
  );
}
