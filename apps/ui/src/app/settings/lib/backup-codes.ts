import { toast } from "sonner";

export function copyBackupCodesToClipboard(codes: string[]): void {
  const codesText = codes.join("\n");
  navigator.clipboard
    .writeText(codesText)
    .then(() => {
      toast.success("Backup codes copied to clipboard!");
    })
    .catch(() => {
      toast.error("Failed to copy backup codes.");
    });
}

export function downloadBackupCodes(codes: string[]): void {
  const codesText = [
    "Two-Factor Authentication Backup Codes",
    "==========================================",
    "",
    "Save these backup codes in a secure location. Each code can only be used once.",
    "",
    ...codes,
    "",
    `Generated on: ${new Date().toLocaleString()}`,
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

  toast.success("Backup codes downloaded!");
}
