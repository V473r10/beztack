import { QRCodeCanvas } from "qrcode.react";
import { useTranslation } from "react-i18next";

type QRCodeDisplayProps = {
  totpURI: string;
};

export function QRCodeDisplay({ totpURI }: QRCodeDisplayProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-md border bg-green-50 p-4 dark:bg-green-900/30">
      <h3 className="font-semibold text-green-700 dark:text-green-400">
        {t("account.settings.twoFactor.completeYour2FASetup")}
      </h3>
      <p className="mb-2 text-green-600 text-sm dark:text-green-500">
        {t("account.settings.twoFactor.scanQrCode")}
      </p>
      <div className="my-4 flex justify-center rounded border bg-white p-4 dark:bg-slate-800">
        <QRCodeCanvas
          bgColor="#ffffff"
          fgColor="#000000"
          level="M"
          marginSize={1}
          size={300}
          value={totpURI}
        />
      </div>
    </div>
  );
}
