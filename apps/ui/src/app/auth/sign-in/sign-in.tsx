import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignInForm } from "./components/form";

export default function SignIn() {
  const { t } = useTranslation();
  return (
    <>
      <div className="space-y-1 text-center">
        <h1 className="font-semibold text-2xl tracking-tight">
          {t("auth.signIn.title")}
        </h1>
        <p className="text-muted-foreground text-sm">
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
          <div className="text-muted-foreground text-sm">
            <span className="mr-1 hidden sm:inline-block">
              {t("auth.signIn.noAccount")}
            </span>
            <Button
              aria-label="Sign up"
              asChild
              className="h-auto p-0 text-primary"
              variant="link"
            >
              <Link to="/auth/sign-up">{t("auth.signIn.signUp")}</Link>
            </Button>
          </div>
          <Button
            aria-label="Reset password"
            asChild
            className="h-auto p-0 text-primary"
            variant="link"
          >
            <Link to="/auth/reset-password">
              {t("auth.signIn.forgotPassword")}
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}
