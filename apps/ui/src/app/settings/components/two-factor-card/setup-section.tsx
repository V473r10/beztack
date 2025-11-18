import { BackupCodesDisplay } from "./backup-codes-display";
import { QRCodeDisplay } from "./qr-code-display";
import { TotpVerification } from "./totp-verification";

type SetupSectionProps = {
  totpURI: string;
  backupCodes: string[];
  totpCode: string;
  isVerifying: boolean;
  hasConfirmedBackupCodes: boolean;
  onCopyBackupCodes: () => void;
  onDownloadBackupCodes: () => void;
  onConfirmBackupCodes: (confirmed: boolean) => void;
  onTotpCodeChange: (value: string) => void;
  onVerifyTotp: () => void;
};

export function SetupSection({
  totpURI,
  backupCodes,
  totpCode,
  isVerifying,
  hasConfirmedBackupCodes,
  onCopyBackupCodes,
  onDownloadBackupCodes,
  onConfirmBackupCodes,
  onTotpCodeChange,
  onVerifyTotp,
}: SetupSectionProps) {
  return (
    <>
      <QRCodeDisplay totpURI={totpURI} />

      <BackupCodesDisplay
        codes={backupCodes}
        hasConfirmed={hasConfirmedBackupCodes}
        onConfirm={onConfirmBackupCodes}
        onCopy={onCopyBackupCodes}
        onDownload={onDownloadBackupCodes}
      />

      <TotpVerification
        hasConfirmedBackupCodes={hasConfirmedBackupCodes}
        isVerifying={isVerifying}
        onCodeChange={onTotpCodeChange}
        onVerify={onVerifyTotp}
        totpCode={totpCode}
      />
    </>
  );
}
