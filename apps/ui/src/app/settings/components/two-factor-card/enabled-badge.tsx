import { useTranslation } from "react-i18next";

export function EnabledBadge() {
  const { t } = useTranslation();

  return (
    <div className="rounded-md border bg-green-50 p-4 dark:bg-green-900/30">
      <h3 className="mb-2 font-semibold text-green-700 dark:text-green-400">
        ✅ Two-Factor Authentication Enabled
      </h3>
      <p className="text-green-600 text-sm dark:text-green-500">
        {t("account.settings.twoFactor.alreadyEnabled", {
          defaultValue:
            "Your account is protected with two-factor authentication. Your backup codes have been safely stored and encrypted.",
        })}
      </p>
    </div>
  );
}
