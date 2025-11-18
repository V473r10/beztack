import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { TOTP_CODE_LENGTH } from "../lib/constants";

type PasswordConfirmDialogProps = {
  open: boolean;
  action: "enable" | "disable" | null;
  password: string;
  totpCode?: string;
  isSubmitting: boolean;
  onPasswordChange: (value: string) => void;
  onTotpCodeChange?: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function PasswordConfirmDialog({
  open,
  action,
  password,
  totpCode = "",
  isSubmitting,
  onPasswordChange,
  onTotpCodeChange,
  onConfirm,
  onCancel,
}: PasswordConfirmDialogProps) {
  const { t } = useTranslation();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onConfirm();
    }
  };

  return (
    <Dialog
      onOpenChange={(isOpen) => {
        if (isSubmitting) {
          return;
        }
        if (!isOpen) {
          onCancel();
        }
      }}
      open={open}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {t("account.settings.twoFactor.passwordDialog.title")}
          </DialogTitle>
          <DialogDescription>
            {t("account.settings.twoFactor.passwordDialog.description", {
              action,
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right" htmlFor="password-confirm">
              {t("account.settings.twoFactor.passwordDialog.password")}
            </Label>
            <Input
              className="col-span-3"
              disabled={isSubmitting}
              id="password-confirm"
              onChange={(e) => onPasswordChange(e.target.value)}
              onKeyDown={handleKeyDown}
              type="password"
              value={password}
            />
          </div>
          {action === "disable" && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right" htmlFor="totp-code-confirm">
                {t("account.settings.twoFactor.passwordDialog.totpCode")}
              </Label>
              <InputOTP
                containerClassName="col-span-3"
                disabled={isSubmitting}
                id="totp-code-confirm"
                maxLength={TOTP_CODE_LENGTH}
                onChange={(value) => onTotpCodeChange?.(value)}
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
            </div>
          )}
        </div>
        <DialogFooter>
          <Button disabled={isSubmitting} onClick={onCancel} variant="outline">
            {t("account.settings.twoFactor.passwordDialog.cancel")}
          </Button>
          <Button
            disabled={
              isSubmitting ||
              !password ||
              (action === "disable" && totpCode.length !== TOTP_CODE_LENGTH)
            }
            onClick={onConfirm}
            type="submit"
          >
            {isSubmitting
              ? t("account.settings.twoFactor.passwordDialog.confirming")
              : t("account.settings.twoFactor.passwordDialog.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
