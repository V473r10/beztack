import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Link } from "react-router"
import { SignUpForm } from "./components/form"

export default function SignUp() {
  const { t } = useTranslation();
  return (
    <>
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("auth.signUp.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("auth.signUp.description")}
        </p>
      </div>
      
      <Card className="w-full">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">{t("auth.signUp.button")}</CardTitle>
          <CardDescription>
            {t("auth.signUp.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignUpForm />
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-center gap-2">
          <div className="text-sm text-muted-foreground">
            <span className="mr-1">
              {t("auth.signUp.hasAccount")}
            </span>
            <Button
              aria-label="Sign in"
              variant="link"
              className="h-auto p-0 text-primary"
              asChild
            >
              <Link to="/auth/sign-in">
                {t("auth.signUp.signIn")}
              </Link>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </>
  )
}
