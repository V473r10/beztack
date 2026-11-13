import { toast } from "sonner";
import { translate } from "@/lib/i18n/translate";
import { formatDate } from "@/lib/format";

export function copyBackupCodesToClipboard(codes: string[]): void {
  const codesText = codes.join("\n");
  navigator.clipboard
    .writeText(codesText)
    .then(() => {
      toast.success(translate("account.settings.twoFactor.copyBackupCodesSuccess"));
    })
    .catch(() => {
      toast.error(translate("account.settings.twoFactor.copyBackupCodesError"));
    });
}

export function downloadBackupCodes(codes: string[]): void {
  const codesText = [
    translate("account.settings.twoFactor.backupFile.title"),
    "==========================================",
    "",
    translate("account.settings.twoFactor.backupFile.warning"),
    "",
    ...codes,
    "",
    translate("account.settings.twoFactor.backupFile.generatedOn", {
      date: formatDate(new Date(), { dateStyle: "medium", timeStyle: "short" }),
    }),
    ,
  ].join("\n");

  const blob = new Blob([codesText], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "2fa-backup-codes.txt";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  toast.success(translate("account.settings.twoFactor.backupFile.downloaded"));
}
