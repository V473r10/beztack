import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type BackupCodesDisplayProps = {
  codes: string[];
  hasConfirmed: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onConfirm: (confirmed: boolean) => void;
};

export function BackupCodesDisplay({
  codes,
  hasConfirmed,
  onCopy,
  onDownload,
  onConfirm,
}: BackupCodesDisplayProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-md border bg-amber-50 p-4 dark:bg-amber-900/30">
      <h3 className="mb-2 font-semibold text-amber-700 dark:text-amber-400">
        ⚠️ {t("account.settings.twoFactor.backupCodes")}
      </h3>
      <p className="mb-3 font-medium text-amber-600 text-sm dark:text-amber-500">
        {t("account.settings.twoFactor.backupCodesWarning", {
          defaultValue:
            "Save these backup codes now! You won't be able to see them again. Each code can only be used once.",
        })}
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
          📋 Copy All Codes
        </Button>
        <Button onClick={onDownload} size="sm" variant="outline">
          💾 Download as File
        </Button>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          checked={hasConfirmed}
          id="backup-codes-saved"
          onCheckedChange={(checked) => onConfirm(checked === true)}
        />
        <Label className="font-medium text-sm" htmlFor="backup-codes-saved">
          {t("account.settings.twoFactor.confirmSavedCodes", {
            defaultValue: "I have safely saved these backup codes",
          })}
        </Label>
      </div>
    </div>
  );
}
