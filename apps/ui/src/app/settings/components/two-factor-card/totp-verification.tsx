import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { TOTP_CODE_LENGTH } from "../../lib/constants";

type TotpVerificationProps = {
  totpCode: string;
  isVerifying: boolean;
  hasConfirmedBackupCodes: boolean;
  onCodeChange: (value: string) => void;
  onVerify: () => void;
};

export function TotpVerification({
  totpCode,
  isVerifying,
  hasConfirmedBackupCodes,
  onCodeChange,
  onVerify,
}: TotpVerificationProps) {
  const { t } = useTranslation();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onVerify();
    }
  };

  return (
    <div className="mt-4 rounded-md border bg-sky-50 p-4 dark:bg-sky-900/30">
      <h3 className="font-semibold text-sky-700 dark:text-sky-400">
        {t("account.settings.twoFactor.verifyAuthenticatorApp")}
      </h3>
      <p className="mb-3 text-sky-600 text-sm dark:text-sky-500">
        {t("account.settings.twoFactor.enter6DigitCode")}
      </p>
      <div className="flex items-center space-x-2">
        <InputOTP
          maxLength={6}
          onChange={onCodeChange}
          onKeyDown={handleKeyDown}
          value={totpCode}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
          </InputOTPGroup>
          <InputOTPGroup>
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
        <Button
          disabled={
            isVerifying ||
            totpCode.length !== TOTP_CODE_LENGTH ||
            !hasConfirmedBackupCodes
          }
          onClick={onVerify}
        >
          {isVerifying
            ? t("account.settings.twoFactor.verifying")
            : t("account.settings.twoFactor.verifyAndComplete")}
        </Button>
      </div>
      {!hasConfirmedBackupCodes && (
        <p className="mt-2 text-red-600 text-xs dark:text-red-400">
          ⚠️ Please save your backup codes before completing setup
        </p>
      )}
    </div>
  );
}
