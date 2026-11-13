import { useTranslation } from "react-i18next";
import { env } from "@/env";

/**
 * The live demo's payment sandbox validates the email's domain, so addresses
 * like `you@test.test` cannot buy. Shown only in demo mode (docs/demo.md).
 */
export function DemoEmailHint() {
  const { t } = useTranslation();

  if (!env.VITE_DEMO_MODE) {
    return null;
  }

  return (
    <p className="text-center text-muted-foreground text-xs" role="note">
      {t("auth.signUp.demoEmailHint")}
    </p>
  );
}
