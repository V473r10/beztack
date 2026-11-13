import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { env } from "@/env";
import { DemoEmailHint } from "./components/demo-email-hint";
import { SignUpForm } from "./components/form";

export default function SignUp() {
  const { t } = useTranslation();
  return (
    <>
      <title>{t("auth.signUp.pageTitle", { appName: env.VITE_APP_NAME })}</title>
      <div className="space-y-1 text-center">
        <h1 className="font-semibold text-2xl tracking-tight">{t("auth.signUp.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("auth.signUp.description")}</p>
      </div>

      <Card className="w-full">
        <CardContent>
          <SignUpForm />
          <div className="mt-4">
            <DemoEmailHint />
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-center gap-2">
          <div className="text-muted-foreground text-sm">
            <span className="mr-1">{t("auth.signUp.hasAccount")}</span>
            <Button asChild className="h-auto p-0 text-primary" variant="link">
              <Link to="/auth/sign-in">{t("auth.signUp.signIn")}</Link>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </>
  );
}
