import { Crown, Loader2, Mail, Shield, User } from "lucide-react";
import { useCallback, useEffect } from "react";
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
// import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppForm } from "@/components/ui/tanstack-form";
import { useInviteMember, useTeams } from "@/hooks/use-organizations";
import {
  type InviteMemberData,
  inviteMemberSchema,
  ORGANIZATION_ROLES,
  type OrganizationRole,
  roleDescription,
  roleLabel,
} from "@/lib/organization-types";

type InviteMemberDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
};

export function InviteMemberDialog({
  open,
  onOpenChange,
  organizationId,
}: InviteMemberDialogProps) {
  const { t } = useTranslation();
  const inviteMember = useInviteMember();
  const { data: teams = [] } = useTeams(organizationId);

  const form = useAppForm({
    validators: { onChange: inviteMemberSchema(t) },
    defaultValues: {
      email: "",
      role: "member",
      teamId: "",
    } as InviteMemberData,
    onSubmit: async ({ value }) => {
      try {
        await inviteMember.mutateAsync({
          organizationId,
          data: {
            ...value,
            teamId: value.teamId || undefined,
          },
        });
        onOpenChange(false);
        form.reset();
      } catch {
        // Error handling is done in the mutation
      }
    },
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      e.stopPropagation();
      form.handleSubmit();
    },
    [form],
  );

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case "admin":
        return <Shield className="h-4 w-4 text-blue-500" />;
      default:
        return <User className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Mail className="h-5 w-5" />
            <span>{t("organizations.invite.title")}</span>
          </DialogTitle>
          <DialogDescription>{t("organizations.invite.description")}</DialogDescription>
        </DialogHeader>
        <form.AppForm>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <form.AppField name="email">
              {(field) => (
                <field.FormItem>
                  <field.FormLabel>{t("organizations.invite.email")}</field.FormLabel>
                  <field.FormControl>
                    <Input
                      disabled={inviteMember.isPending}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="colleague@company.com"
                      type="email"
                      value={field.state.value}
                    />
                  </field.FormControl>
                  <field.FormDescription>
                    {t("organizations.invite.emailHelp")}
                  </field.FormDescription>
                  <field.FormMessage />
                </field.FormItem>
              )}
            </form.AppField>

            <form.AppField name="role">
              {(field) => (
                <field.FormItem>
                  <field.FormLabel>{t("organizations.invite.role")}</field.FormLabel>
                  <field.FormControl>
                    <Select
                      disabled={inviteMember.isPending}
                      onValueChange={(value) =>
                        field.handleChange(value as "admin" | "member" | "owner")
                      }
                      value={field.state.value}
                    >
                      <SelectTrigger className="!h-auto !min-h-[3.5rem] w-full py-3">
                        <SelectValue placeholder={t("organizations.invite.rolePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ORGANIZATION_ROLES) as OrganizationRole[]).map((role) => (
                          <SelectItem className="py-3" key={role} value={role}>
                            <div className="flex items-start gap-3 text-left">
                              <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-muted">
                                {getRoleIcon(role)}
                              </div>
                              <div>
                                <p className="font-medium leading-tight">{roleLabel(t, role)}</p>
                                <p className="text-muted-foreground text-sm leading-snug">
                                  {roleDescription(t, role)}
                                </p>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </field.FormControl>
                  <field.FormMessage />
                </field.FormItem>
              )}
            </form.AppField>

            {teams.length > 0 && (
              <form.AppField name="teamId">
                {(field) => (
                  <field.FormItem>
                    <field.FormLabel>{t("organizations.invite.team")}</field.FormLabel>
                    <field.FormControl>
                      <Select
                        disabled={inviteMember.isPending}
                        onValueChange={field.handleChange}
                        value={field.state.value}
                      >
                        <SelectTrigger className="!h-auto w-full py-3">
                          <SelectValue placeholder={t("organizations.invite.teamPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {teams.map((team) => (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </field.FormControl>
                    <field.FormDescription>
                      {t("organizations.invite.teamHelp")}
                    </field.FormDescription>
                    <field.FormMessage />
                  </field.FormItem>
                )}
              </form.AppField>
            )}

            <DialogFooter>
              <Button
                disabled={inviteMember.isPending}
                onClick={() => onOpenChange(false)}
                type="button"
                variant="outline"
              >
                {t("common.cancel")}
              </Button>
              <Button disabled={inviteMember.isPending} type="submit">
                {inviteMember.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("organizations.invite.send")}
              </Button>
            </DialogFooter>
          </form>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  );
}
