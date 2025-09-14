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
import { SignUpForm } from "./components/form";

export default function SignUp() {
  const { t } = useTranslation();
  return (
    <>
      <div className="space-y-1 text-center">
        <h1 className="font-semibold text-2xl tracking-tight">
          {t("auth.signUp.title")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t("auth.signUp.description")}
        </p>
      </div>

      <Card className="w-full">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">{t("auth.signUp.button")}</CardTitle>
          <CardDescription>{t("auth.signUp.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <SignUpForm />
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-center gap-2">
          <div className="text-muted-foreground text-sm">
            <span className="mr-1">{t("auth.signUp.hasAccount")}</span>
            <Button
              aria-label="Sign in"
              asChild
              className="h-auto p-0 text-primary"
              variant="link"
            >
              <Link to="/auth/sign-in">{t("auth.signUp.signIn")}</Link>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </>
  );
}
