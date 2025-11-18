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
import { Label } from "@/components/ui/label";

type PasswordConfirmDialogProps = {
  open: boolean;
  action: "enable" | "disable" | null;
  password: string;
  isSubmitting: boolean;
  onPasswordChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function PasswordConfirmDialog({
  open,
  action,
  password,
  isSubmitting,
  onPasswordChange,
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
        </div>
        <DialogFooter>
          <Button
            disabled={isSubmitting}
            onClick={onCancel}
            variant="outline"
          >
            {t("account.settings.twoFactor.passwordDialog.cancel")}
          </Button>
          <Button
            disabled={isSubmitting || !password}
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
