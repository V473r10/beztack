import { Crown, Loader2, Mail, Shield, User } from "lucide-react";
import { useCallback, useEffect } from "react";
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
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
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
  const inviteMember = useInviteMember();
  const { data: teams = [] } = useTeams(organizationId);

  const form = useAppForm({
    validators: { onChange: inviteMemberSchema },
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
    [form]
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
            <span>Invite Member</span>
          </DialogTitle>
          <DialogDescription>
            Send an invitation to join this organization. They will receive an
            email with instructions.
          </DialogDescription>
        </DialogHeader>
        <form.AppForm>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <form.AppField name="email">
              {(field) => (
                <field.FormItem>
                  <field.FormLabel>Email Address</field.FormLabel>
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
                    Enter the email address of the person you want to invite.
                  </field.FormDescription>
                  <field.FormMessage />
                </field.FormItem>
              )}
            </form.AppField>

            <form.AppField name="role">
              {(field) => (
                <field.FormItem>
                  <field.FormLabel>Role</field.FormLabel>
                  <field.FormControl>
                    <Select
                      disabled={inviteMember.isPending}
                      onValueChange={(value) =>
                        field.handleChange(
                          value as "admin" | "member" | "owner"
                        )
                      }
                      value={field.state.value}
                    >
                      <SelectTrigger className="!h-auto !min-h-[3.5rem] w-full py-3">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_LABELS).map(([role, label]) => (
                          <SelectItem className="py-3" key={role} value={role}>
                            <div className="flex items-start gap-3 text-left">
                              <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-muted">
                                {getRoleIcon(role)}
                              </div>
                              <div>
                                <p className="font-medium leading-tight">
                                  {label}
                                </p>
                                <p className="text-muted-foreground text-sm leading-snug">
                                  {
                                    ROLE_DESCRIPTIONS[
                                      role as keyof typeof ROLE_DESCRIPTIONS
                                    ]
                                  }
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
                    <field.FormLabel>Team (Optional)</field.FormLabel>
                    <field.FormControl>
                      <Select
                        disabled={inviteMember.isPending}
                        onValueChange={field.handleChange}
                        value={field.state.value}
                      >
                        <SelectTrigger className="!h-auto w-full py-3">
                          <SelectValue placeholder="Select a team (optional)" />
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
                      Optionally add the member to a specific team.
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
                Cancel
              </Button>
              <Button disabled={inviteMember.isPending} type="submit">
                {inviteMember.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Send Invitation
              </Button>
            </DialogFooter>
          </form>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  );
}
