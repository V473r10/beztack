import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProfileCardProps = {
  username: string;
  email: string;
  isPending: boolean;
  onUsernameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onSave: () => void;
};

export function ProfileCard({
  username,
  email,
  isPending,
  onUsernameChange,
  onEmailChange,
  onSave,
}: ProfileCardProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("account.settings.profile.title")}</CardTitle>
        <CardDescription>
          {t("account.settings.profile.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">
            {t("account.settings.profile.username")}
          </Label>
          <Input
            id="username"
            onChange={(e) => onUsernameChange(e.target.value)}
            value={username}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{t("account.settings.profile.email")}</Label>
          <Input
            id="email"
            onChange={(e) => onEmailChange(e.target.value)}
            type="email"
            value={email}
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button disabled={isPending} onClick={onSave}>
          {isPending
            ? t("account.settings.profile.saving")
            : t("account.settings.profile.save")}
        </Button>
      </CardFooter>
    </Card>
  );
}
