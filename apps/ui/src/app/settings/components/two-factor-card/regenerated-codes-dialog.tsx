import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type RegeneratedCodesDialogProps = {
  open: boolean;
  codes: string[];
  hasConfirmed: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onConfirm: (confirmed: boolean) => void;
  onClose: () => void;
};

export function RegeneratedCodesDialog({
  open,
  codes,
  hasConfirmed,
  onCopy,
  onDownload,
  onConfirm,
  onClose,
}: RegeneratedCodesDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      onOpenChange={(isOpen) => {
        if (!isOpen && hasConfirmed) {
          onClose();
        }
      }}
      open={open}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {t("account.settings.twoFactor.regeneratedCodes.title")}
          </DialogTitle>
          <DialogDescription>
            {t("account.settings.twoFactor.regeneratedCodes.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border bg-amber-50 p-4 dark:bg-amber-900/30">
          <h3 className="mb-2 font-semibold text-amber-700 dark:text-amber-400">
            ⚠️ {t("account.settings.twoFactor.backupCodes")}
          </h3>
          <p className="mb-3 font-medium text-amber-600 text-sm dark:text-amber-500">
            {t("account.settings.twoFactor.regeneratedCodes.warning")}
          </p>
          <div className="mb-3 space-y-1 rounded border bg-white p-3 dark:bg-slate-800">
            {codes.map((code) => (
              <pre
                className="rounded border bg-slate-50 p-2 font-mono text-sm dark:bg-slate-700"
                key={code}
              >
                {code}
              </pre>
            ))}
          </div>
          <div className="mb-4 flex gap-2">
            <Button onClick={onCopy} size="sm" variant="outline">
              📋 {t("account.settings.twoFactor.regeneratedCodes.copy")}
            </Button>
            <Button onClick={onDownload} size="sm" variant="outline">
              💾 {t("account.settings.twoFactor.regeneratedCodes.download")}
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={hasConfirmed}
              id="regenerated-codes-saved"
              onCheckedChange={(checked) => onConfirm(checked === true)}
            />
            <Label
              className="font-medium text-sm"
              htmlFor="regenerated-codes-saved"
            >
              {t("account.settings.twoFactor.confirmSavedCodes")}
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!hasConfirmed} onClick={onClose}>
            {t("account.settings.twoFactor.regeneratedCodes.done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
