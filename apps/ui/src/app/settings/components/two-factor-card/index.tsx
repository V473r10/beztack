import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TOUR_STEP_IDS } from "@/lib/tour-constants";
import { EnabledBadge } from "./enabled-badge";
import { SetupSection } from "./setup-section";

type TwoFactorCardProps = {
  isEnabled: boolean;
  isSubmitting: boolean;
  showSetup: boolean;
  totpURI: string | null;
  backupCodes: string[] | null;
  totpCode: string;
  isVerifying: boolean;
  hasConfirmedBackupCodes: boolean;
  onToggle: (enabled: boolean) => void;
  onCopyBackupCodes: () => void;
  onDownloadBackupCodes: () => void;
  onConfirmBackupCodes: (confirmed: boolean) => void;
  onTotpCodeChange: (value: string) => void;
  onVerifyTotp: () => void;
};

export function TwoFactorCard({
  isEnabled,
  isSubmitting,
  showSetup,
  totpURI,
  backupCodes,
  totpCode,
  isVerifying,
  hasConfirmedBackupCodes,
  onToggle,
  onCopyBackupCodes,
  onDownloadBackupCodes,
  onConfirmBackupCodes,
  onTotpCodeChange,
  onVerifyTotp,
}: TwoFactorCardProps) {
  const { t } = useTranslation();

  return (
    <Card id={TOUR_STEP_IDS.Settings.TwoFactor.CARD}>
      <CardHeader>
        <CardTitle>{t("account.settings.twoFactor.title")}</CardTitle>
        <CardDescription>
          {t("account.settings.twoFactor.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="flex items-center space-x-2"
          id={TOUR_STEP_IDS.Settings.TwoFactor.SWITCH}
        >
          <Label htmlFor="two-factor-switch">
            <span>{t("account.settings.twoFactor.enable")}</span>
          </Label>
          <Switch
            checked={isEnabled}
            disabled={isSubmitting}
            id="two-factor-switch"
            onCheckedChange={onToggle}
          />
        </div>
        <span className="font-normal text-muted-foreground leading-snug">
          {t("account.settings.twoFactor.willPrompt")}
        </span>

        <div className="space-y-4 border-t pt-4">
          {totpURI && backupCodes && showSetup && (
            <SetupSection
              backupCodes={backupCodes}
              hasConfirmedBackupCodes={hasConfirmedBackupCodes}
              isVerifying={isVerifying}
              onConfirmBackupCodes={onConfirmBackupCodes}
              onCopyBackupCodes={onCopyBackupCodes}
              onDownloadBackupCodes={onDownloadBackupCodes}
              onTotpCodeChange={onTotpCodeChange}
              onVerifyTotp={onVerifyTotp}
              totpCode={totpCode}
              totpURI={totpURI}
            />
          )}

          {isEnabled && !showSetup && <EnabledBadge />}
        </div>
      </CardContent>
    </Card>
  );
}
