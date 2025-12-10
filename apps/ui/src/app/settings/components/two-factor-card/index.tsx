import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
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
import { RegeneratedCodesDialog } from "./regenerated-codes-dialog";
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
  showRegeneratedCodes: boolean;
  regeneratedCodes: string[] | null;
  onToggle: (enabled: boolean) => void;
  onCopyBackupCodes: () => void;
  onDownloadBackupCodes: () => void;
  onConfirmBackupCodes: (confirmed: boolean) => void;
  onTotpCodeChange: (value: string) => void;
  onVerifyTotp: () => void;
  onRegenerateBackupCodes: () => void;
  onCopyRegeneratedCodes: () => void;
  onDownloadRegeneratedCodes: () => void;
  onCloseRegeneratedCodes: () => void;
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
  showRegeneratedCodes,
  regeneratedCodes,
  onToggle,
  onCopyBackupCodes,
  onDownloadBackupCodes,
  onConfirmBackupCodes,
  onTotpCodeChange,
  onVerifyTotp,
  onRegenerateBackupCodes,
  onCopyRegeneratedCodes,
  onDownloadRegeneratedCodes,
  onCloseRegeneratedCodes,
}: TwoFactorCardProps) {
  const { t } = useTranslation();

  return (
    <>
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

            {isEnabled && !showSetup && (
              <div className="space-y-4">
                <EnabledBadge />
                <div className="rounded-md border bg-muted/50 p-4">
                  <h4 className="mb-2 font-medium text-sm">
                    {t("account.settings.twoFactor.regenerate.title")}
                  </h4>
                  <p className="mb-3 text-muted-foreground text-sm">
                    {t("account.settings.twoFactor.regenerate.description")}
                  </p>
                  <Button
                    disabled={isSubmitting}
                    onClick={onRegenerateBackupCodes}
                    size="sm"
                    variant="outline"
                  >
                    🔄 {t("account.settings.twoFactor.regenerate.button")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {showRegeneratedCodes && regeneratedCodes && (
        <RegeneratedCodesDialog
          codes={regeneratedCodes}
          hasConfirmed={hasConfirmedBackupCodes}
          onClose={onCloseRegeneratedCodes}
          onConfirm={onConfirmBackupCodes}
          onCopy={onCopyRegeneratedCodes}
          onDownload={onDownloadRegeneratedCodes}
          open={showRegeneratedCodes}
        />
      )}
    </>
  );
}
