import { Key, Loader2, Shield } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";

const BACKUP_CODE_LENGTH = 11;
const PRIMARY_FORMAT = /^[A-Za-z0-9]{5}-[A-Za-z0-9]{5}$/;
const TOTP_CODE_LENGTH = 6;

interface AuthError {
  error: {
    message?: string;
  };
}

const extractAuthErrorMessage = (result: unknown): string => {
  if (typeof result === "object" && result !== null && "error" in result) {
    return (
      (result as AuthError).error.message ||
      "An unknown authentication error occurred."
    );
  }
  return "An unknown authentication error occurred.";
};

const TwoFactor = () => {
  const { t } = useTranslation();
  const [totpCode, setTotpCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<
    "totp" | "backup"
  >("totp");
  const navigate = useNavigate();

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsLoading(true);
    try {
      await authClient.twoFactor.verifyTotp(
        { code: totpCode },
        {
          onSuccess() {
            toast.success("Signed in successfully with 2FA!");
            navigate("/");
          },
          onError(res) {
            const errorDetail = extractAuthErrorMessage(res);
            toast.error(errorDetail);
          },
        }
      );
    } catch (err: unknown) {
      const errorDetail = extractAuthErrorMessage(err as object);
      toast.error(errorDetail);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackupCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (
      backupCode.length !== BACKUP_CODE_LENGTH ||
      !isValidBackupCode(backupCode)
    ) {
      toast.error("Please enter a valid backup code format (XXXXX-XXXXX)");
      return;
    }

    setIsLoading(true);

    try {
      // Try with dash format first (original format from API)
      await authClient.twoFactor.verifyBackupCode(
        { code: backupCode },
        {
          onSuccess() {
            toast.success("Signed in successfully with backup code!");
            navigate("/");
          },
          async onError() {
            // If dash format fails, try without dash
            const codeWithoutDash = backupCode.replace("-", "");
            try {
              await authClient.twoFactor.verifyBackupCode(
                { code: codeWithoutDash },
                {
                  onSuccess() {
                    toast.success("Signed in successfully with backup code!");
                    navigate("/");
                  },
                  onError(res) {
                    const errorDetail = extractAuthErrorMessage(res);
                    toast.error(`Verification failed: ${errorDetail}`);
                  },
                }
              );
            } catch (err: unknown) {
              const errorDetail = extractAuthErrorMessage(err as object);
              toast.error(`Verification failed: ${errorDetail}`);
            } finally {
              setIsLoading(false);
            }
          },
        }
      );
    } catch (err: unknown) {
      const errorDetail = extractAuthErrorMessage(err as object);
      toast.error(`Verification failed: ${errorDetail}`);
      setIsLoading(false);
    }
  };

  const isValidBackupCode = (value: string) => {
    // Primary format: 5 characters, dash, 5 characters (total 11)
    const primaryFormat = PRIMARY_FORMAT;
    return primaryFormat.test(value);
  };

  const handleBackupCodeChange = (value: string) => {
    // Allow alphanumeric and dash, max 11 characters (preserve original case)
    const formattedValue = value
      .replace(/[^A-Za-z0-9-]/g, "")
      .slice(0, BACKUP_CODE_LENGTH);
    setBackupCode(formattedValue);
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-6 pt-8">
      <div className="text-center">
        <h1 className="font-semibold text-2xl tracking-tight">
          {t("auth.signIn.twoFactor.title")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t("auth.signIn.twoFactor.description")}
        </p>
      </div>

      <Tabs
        className="w-full max-w-md"
        onValueChange={(value) =>
          setVerificationMethod(value as "totp" | "backup")
        }
        value={verificationMethod}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger className="flex items-center gap-2" value="totp">
            <Shield className="h-4 w-4" />
            {t("auth.signIn.twoFactor.authenticatorApp", {
              defaultValue: "Authenticator App",
            })}
          </TabsTrigger>
          <TabsTrigger className="flex items-center gap-2" value="backup">
            <Key className="h-4 w-4" />
            {t("auth.signIn.twoFactor.backupCode", {
              defaultValue: "Backup Code",
            })}
          </TabsTrigger>
        </TabsList>

        <TabsContent className="space-y-4" value="totp">
          <div className="space-y-2 text-center">
            <p className="text-muted-foreground text-sm">
              {t("auth.signIn.twoFactor.totpDescription", {
                defaultValue:
                  "Enter the 6-digit code from your authenticator app",
              })}
            </p>
          </div>
          <form className="space-y-4" onSubmit={handleTotpSubmit}>
            <InputOTP
              autoFocus
              disabled={isLoading}
              maxLength={6}
              onChange={(value) => setTotpCode(value)}
              pattern="[0-9]*"
              value={totpCode}
            >
              <InputOTPGroup className="flex w-full justify-center">
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup className="flex w-full justify-center">
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            <Button
              className="w-full"
              disabled={isLoading || totpCode.length !== TOTP_CODE_LENGTH}
              type="submit"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("auth.signIn.twoFactor.verifyCode", {
                defaultValue: "Verify Code",
              })}
            </Button>
          </form>
        </TabsContent>

        <TabsContent className="space-y-4" value="backup">
          <div className="space-y-2 text-center">
            <p className="text-muted-foreground text-sm">
              {t("auth.signIn.twoFactor.backupCodeDescription", {
                defaultValue: "Enter one of your backup codes",
              })}
            </p>
            <p className="text-amber-600 text-xs dark:text-amber-400">
              ⚠️{" "}
              {t("auth.signIn.twoFactor.backupCodeWarning", {
                defaultValue: "Each backup code can only be used once",
              })}
            </p>
          </div>
          <form className="space-y-4" onSubmit={handleBackupCodeSubmit}>
            <InputOTP
              autoFocus
              disabled={isLoading}
              maxLength={11}
              onChange={handleBackupCodeChange}
              value={backupCode}
            >
              <InputOTPGroup className="flex w-full justify-center">
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
              </InputOTPGroup>
              <InputOTPSeparator>
                <span className="text-muted-foreground">-</span>
              </InputOTPSeparator>
              <InputOTPGroup className="flex w-full justify-center">
                <InputOTPSlot index={6} />
                <InputOTPSlot index={7} />
                <InputOTPSlot index={8} />
                <InputOTPSlot index={9} />
                <InputOTPSlot index={10} />
              </InputOTPGroup>
            </InputOTP>
            <Button
              className="w-full"
              disabled={isLoading || !isValidBackupCode(backupCode)}
              type="submit"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("auth.signIn.twoFactor.verifyBackupCode", {
                defaultValue: "Verify Backup Code",
              })}
            </Button>
          </form>
        </TabsContent>
      </Tabs>

      <Button
        className="h-auto p-0 text-xs"
        disabled={isLoading}
        onClick={() => navigate("/auth/sign-in")}
        variant="link"
      >
        {t("auth.signIn.backToSignIn")}
      </Button>
    </div>
  );
};

export default TwoFactor;
