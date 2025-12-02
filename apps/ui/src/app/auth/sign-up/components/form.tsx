import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppForm } from "@/components/ui/tanstack-form";
import { authClient } from "@/lib/auth-client";

const MIN_PASSWORD_LENGTH = 8;
const UPPERCASE_REGEX = /[A-Z]/;
const LOWERCASE_REGEX = /[a-z]/;
const NUMBER_REGEX = /[0-9]/;
const SPECIAL_CHAR_REGEX = /[^A-Za-z0-9]/;

const passwordSchema = (t: (key: string) => string) =>
  z
    .string()
    .min(MIN_PASSWORD_LENGTH, { message: t("validation.password.length") })
    .regex(UPPERCASE_REGEX, { message: t("validation.password.uppercase") })
    .regex(LOWERCASE_REGEX, { message: t("validation.password.lowercase") })
    .regex(NUMBER_REGEX, { message: t("validation.password.number") })
    .regex(SPECIAL_CHAR_REGEX, {
      message: t("validation.password.special"),
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

export function SignUpForm() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
    [form]
  );

  return (
    <form.AppForm>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <form.AppField name="name">
          {(field) => (
            <field.FormItem>
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
            <field.FormItem>
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
              <field.FormItem>
                <field.FormLabel>{t("form.password.label")}</field.FormLabel>
                <field.FormControl>
                  <div className="relative">
                    <Input
                      autoComplete="new-password"
                      className="pr-10"
                      disabled={isLoading}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      type={showPassword ? "text" : "password"}
                      value={value}
                    />
                    <button
                      aria-label={
                        showPassword
                          ? t("form.password.hide")
                          : t("form.password.show")
                      }
                      className="-translate-y-1/2 absolute top-1/2 right-3 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      type="button"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </field.FormControl>
                <field.FormMessage />
                <p className="font-medium text-destructive text-sm">
                  {t("form.password.mustContain")}
                </p>
                <ul className="list-disc space-y-1 pl-4 text-muted-foreground text-sm">
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
              <field.FormLabel>
                {t("form.confirmPassword.label")}
              </field.FormLabel>
              <field.FormControl>
                <div className="relative">
                  <Input
                    autoComplete="new-password"
                    className="pr-10"
                    disabled={isLoading}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    type={showPassword ? "text" : "password"}
                    value={field.state.value}
                  />
                  <button
                    aria-label={
                      showPassword
                        ? t("form.password.hide")
                        : t("form.password.show")
                    }
                    className="-translate-y-1/2 absolute top-1/2 right-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    type="button"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </field.FormControl>
              <field.FormMessage />
            </field.FormItem>
          )}
        </form.AppField>

        <Button className="w-full" disabled={isLoading} type="submit">
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("form.createAccountButton")}
        </Button>
      </form>
    </form.AppForm>
  );
}
