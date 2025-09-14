import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppForm } from "@/components/ui/tanstack-form";
import { authClient } from "@/lib/auth-client";

const FormSchema = z.object({
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  password: z.string().min(8, {
    message: "Password must be at least 8 characters.",
  }),
});

export function SignInForm() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const form = useAppForm({
    validators: { onChange: FormSchema },
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      setIsLoading(true);
      try {
        await authClient.signIn.email(
          {
            email: value.email,
            password: value.password,
          },
          {
            async onSuccess(context) {
              if (context.data.twoFactorRedirect) {
                toast.success("Two-factor authentication required!");
                navigate("/auth/sign-in/two-factor");
              } else {
                toast.success("Signed in successfully!");
                navigate("/");
              }
            },
          }
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Invalid email or password. Please try again.";
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
                  variant="link"
                >
                  <Link className="hover:underline" to="/auth/reset-password">
                    {t("auth.signIn.form.forgotPassword")}
                  </Link>
                </Button>
              </div>
              <field.FormControl>
                <Input
                  autoComplete="current-password"
                  disabled={isLoading}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  type="password"
                  value={field.state.value}
                />
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
