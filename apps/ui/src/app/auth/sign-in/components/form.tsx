import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppForm } from "@/components/ui/tanstack-form";
import { authClient } from "@/lib/auth-client";

// Constants
const MIN_PASSWORD_LENGTH = 8;

const FormSchema = z.object({
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  password: z.string().min(MIN_PASSWORD_LENGTH, {
    message: "Password must be at least 8 characters.",
  }),
});

export function SignInForm() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const form = useAppForm({
    validators: { onChange: FormSchema },
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      setIsLoading(true);

      await authClient.signIn.email(
        {
          email: value.email,
          password: value.password,
        },
        {
          onSuccess(context) {
            if (context.data.twoFactorRedirect) {
              toast.success("Two-factor authentication required!");
              navigate("/auth/sign-in/two-factor");
            } else {
              toast.success("Signed in successfully!");
              navigate("/");
            }
          },
          onError(error) {
            toast.error(error.error.message);
          },
          onResponse() {
            setIsLoading(false);
          },
        }
      );
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
        <form.AppField name="email">
          {(field) => (
            <field.FormItem>
              <field.FormLabel>{t("auth.signIn.form.email")}</field.FormLabel>
              <field.FormControl>
                <Input
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect="off"
                  disabled={isLoading}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="name@example.com"
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
            <field.FormItem>
              <div className="flex items-center justify-between">
                <field.FormLabel>
                  {t("auth.signIn.form.password")}
                </field.FormLabel>
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
              <field.FormControl>
                <div className="relative">
                  <Input
                    autoComplete="current-password"
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
          {t("auth.signIn.form.button")}
        </Button>
      </form>
    </form.AppForm>
  );
}
