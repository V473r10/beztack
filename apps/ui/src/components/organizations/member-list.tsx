import { Crown, Edit, MoreHorizontal, Plus, Shield, User, UserMinus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useOrganizationMembers,
  useRemoveMember,
  useUpdateMemberRole,
} from "@/hooks/use-organizations";
import { type OrganizationMember, roleLabel } from "@/lib/organization-types";
import { formatDate as formatProjectDate } from "@/lib/format";

// Simple date formatting utility
const formatDate = (date: Date | string) => {
  return formatProjectDate(date, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

type MemberListProps = {
  organizationId: string;
  currentUserRole?: string;
  currentUserId?: string;
  onInviteMembers?: () => void;
  onEditMember?: (member: OrganizationMember) => void;
};

export function MemberList({
  organizationId,
  currentUserRole = "member",
  currentUserId,
  onInviteMembers,
  onEditMember,
}: MemberListProps) {
  const { t } = useTranslation();
  const [memberToRemove, setMemberToRemove] = useState<OrganizationMember | null>(null);
  const [memberToUpdate, setMemberToUpdate] = useState<{
    member: OrganizationMember;
    newRole: string;
  } | null>(null);

  const { data: members = [], isLoading } = useOrganizationMembers(organizationId);
  const removeMember = useRemoveMember();
  const updateMemberRole = useUpdateMemberRole();

  const canManageMembers = currentUserRole === "owner" || currentUserRole === "admin";
  const isOwner = currentUserRole === "owner";

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

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner":
        return "default" as const;
      case "admin":
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  };

  const canEditMember = (member: OrganizationMember) => {
    if (member.userId === currentUserId) {
      return false; // Can't edit self
    }
    if (member.role === "owner") {
      return isOwner; // Only owner can edit owner
    }
    return canManageMembers;
  };

  const canRemoveMember = (member: OrganizationMember) => {
    if (member.userId === currentUserId) {
      return false; // Can't remove self
    }
    if (member.role === "owner") {
      return false; // Can't remove owner
    }
    return canManageMembers;
  };

  const handleUpdateRole = (member: OrganizationMember, newRole: string) => {
    if (newRole === member.role) {
      return;
    }

    setMemberToUpdate({ member, newRole });
  };

  const confirmUpdateRole = async () => {
    if (!memberToUpdate) {
      return;
    }

    try {
      await updateMemberRole.mutateAsync({
        organizationId,
        userId: memberToUpdate.member.userId,
        data: { role: memberToUpdate.newRole as "admin" | "member" | "owner" },
      });
      setMemberToUpdate(null);
    } catch {
      // Error handling is done in the mutation
    }
  };

  const handleRemoveMember = (member: OrganizationMember) => {
    setMemberToRemove(member);
  };

  const confirmRemoveMember = async () => {
    if (!memberToRemove) {
      return;
    }

    try {
      await removeMember.mutateAsync({
        organizationId,
        userId: memberToRemove.userId,
      });
      setMemberToRemove(null);
    } catch {
      // Error handling is done in the mutation
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="mb-2 h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-9 w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map(() => (
              <div
                className="flex items-center space-x-4"
                key={`member-skeleton-${crypto.randomUUID()}`}
              >
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-8 w-8" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("organizations.members.title", { count: members.length })}</CardTitle>
              <CardDescription>{t("organizations.members.description")}</CardDescription>
            </div>
            {canManageMembers && onInviteMembers && (
              <Button onClick={onInviteMembers}>
                <Plus className="mr-2 h-4 w-4" />
                {t("organizations.members.invite")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("organizations.members.columns.member")}</TableHead>
                  <TableHead>{t("organizations.members.columns.role")}</TableHead>
                  <TableHead>{t("organizations.members.columns.joined")}</TableHead>
                  <TableHead className="w-[100px]">
                    {t("organizations.members.columns.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.user?.image} />
                          <AvatarFallback>
                            {member.user?.name?.charAt(0) || member.email.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {member.user?.name || t("organizations.members.invitedUser")}
                          </div>
                          <div className="text-muted-foreground text-sm">{member.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className="flex w-fit items-center space-x-1"
                        variant={getRoleBadgeVariant(member.role)}
                      >
                        {getRoleIcon(member.role)}
                        <span>{roleLabel(t, member.role)}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(member.createdAt)}
                    </TableCell>
                    <TableCell>
                      {canEditMember(member) || canRemoveMember(member) ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button className="h-8 w-8 p-0" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>
                              {t("organizations.members.columns.actions")}
                            </DropdownMenuLabel>
                            {canEditMember(member) && (
                              <>
                                <DropdownMenuItem onClick={() => onEditMember?.(member)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  {t("organizations.members.editRole")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {(["member", "admin", "owner"] as const).map(
                                  (role) =>
                                    role !== member.role && (
                                      <DropdownMenuItem
                                        key={role}
                                        onClick={() => handleUpdateRole(member, role)}
                                      >
                                        {getRoleIcon(role)}
                                        <span className="ml-2">
                                          {t("organizations.members.makeRole", {
                                            role: roleLabel(t, role),
                                          })}
                                        </span>
                                      </DropdownMenuItem>
                                    ),
                                )}
                              </>
                            )}
                            {canRemoveMember(member) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleRemoveMember(member)}
                                >
                                  <UserMinus className="mr-2 h-4 w-4" />
                                  {t("organizations.members.remove")}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <div className="w-8" /> // Empty space to maintain alignment
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Remove Member Confirmation Dialog */}
      <AlertDialog
        onOpenChange={(open) => !open && setMemberToRemove(null)}
        open={!!memberToRemove}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("organizations.members.remove")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("organizations.members.removeConfirm", {
                member: memberToRemove?.user?.name || memberToRemove?.email,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removeMember.isPending}
              onClick={confirmRemoveMember}
            >
              {t("organizations.members.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Update Role Confirmation Dialog */}
      <AlertDialog
        onOpenChange={(open) => !open && setMemberToUpdate(null)}
        open={!!memberToUpdate}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("organizations.members.updateRoleTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("organizations.members.updateRoleConfirm", {
                member: memberToUpdate?.member.user?.name || memberToUpdate?.member.email,
                from: roleLabel(t, memberToUpdate?.member.role ?? ""),
                to: roleLabel(t, memberToUpdate?.newRole ?? ""),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={updateMemberRole.isPending} onClick={confirmUpdateRole}>
              {t("organizations.members.updateRole")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
