import type { TFunction } from "i18next";
import { AlertCircle, Clock, Crown, Mail, Shield, User, X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCancelInvitation, useOrganizationInvitations } from "@/hooks/use-organizations";
import { type OrganizationInvitation, roleLabel } from "@/lib/organization-types";
import { formatDate as formatProjectDate, formatRelativeFromNow } from "@/lib/format";

// Time calculation constants
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const MILLISECONDS_PER_HOUR = MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE * MINUTES_PER_HOUR;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;

type PendingInvitationsProps = {
  organizationId: string;
  canCancelInvitations?: boolean;
};

// Simple date formatting utility
const formatDate = (date: Date | string) => {
  return formatProjectDate(date, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatRelativeTime = (date: Date | string, t: TFunction) => {
  const now = new Date();
  const targetDate = new Date(date);
  const diffInHours = Math.floor((now.getTime() - targetDate.getTime()) / MILLISECONDS_PER_HOUR);

  if (diffInHours < 1) {
    return t("organizations.invitations.lessThanHour");
  }

  const diffInDays = Math.floor(diffInHours / HOURS_PER_DAY);
  if (diffInDays < DAYS_PER_WEEK) {
    return formatRelativeFromNow(date);
  }

  return formatDate(date);
};

export function PendingInvitations({
  organizationId,
  canCancelInvitations = false,
}: PendingInvitationsProps) {
  const { t } = useTranslation();
  const [invitationToCancel, setInvitationToCancel] = useState<OrganizationInvitation | null>(null);

  const { data: invitations = [], isLoading } = useOrganizationInvitations(organizationId);
  const cancelInvitation = useCancelInvitation();

  const pendingInvitations = invitations.filter((inv) => inv.status === "pending");

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

  const getStatusIcon = (status: string, expiresAt: Date | string) => {
    const isExpired = new Date(expiresAt) < new Date();

    if (isExpired) {
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    }

    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "accepted":
        return <Crown className="h-4 w-4 text-green-500" />;
      case "rejected":
        return <X className="h-4 w-4 text-red-500" />;
      case "cancelled":
        return <X className="h-4 w-4 text-gray-500" />;
      default:
        return <Mail className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string, expiresAt: Date | string) => {
    const isExpired = new Date(expiresAt) < new Date();

    if (isExpired) {
      return <Badge variant="destructive">{t("organizations.invitations.status.expired")}</Badge>;
    }

    switch (status) {
      case "pending":
        return <Badge variant="secondary">{t("organizations.invitations.status.pending")}</Badge>;
      case "accepted":
        return <Badge variant="default">{t("organizations.invitations.status.accepted")}</Badge>;
      case "rejected":
        return (
          <Badge variant="destructive">{t("organizations.invitations.status.rejected")}</Badge>
        );
      case "cancelled":
        return <Badge variant="outline">{t("organizations.invitations.status.cancelled")}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleCancelInvitation = (invitation: OrganizationInvitation) => {
    setInvitationToCancel(invitation);
  };

  const confirmCancelInvitation = async () => {
    if (!invitationToCancel) {
      return;
    }

    try {
      await cancelInvitation.mutateAsync({
        invitationId: invitationToCancel.id,
      });
      setInvitationToCancel(null);
    } catch {
      // Error handling is done in the mutation
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="mb-2 h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map(() => (
              <div
                className="flex items-center justify-between rounded border p-4"
                key={`invitation-skeleton-${crypto.randomUUID()}`}
              >
                <div className="flex items-center space-x-3">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-8 w-16" />
                </div>
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
          <CardTitle className="flex items-center space-x-2">
            <Mail className="h-5 w-5" />
            <span>
              {t("organizations.invitations.pendingTitle", { count: pendingInvitations.length })}
            </span>
          </CardTitle>
          <CardDescription>{t("organizations.invitations.pendingDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingInvitations.length === 0 ? (
            <div className="py-8 text-center">
              <Mail className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 font-semibold text-lg">
                {t("organizations.invitations.emptyTitle")}
              </h3>
              <p className="text-muted-foreground">
                {t("organizations.invitations.emptyDescription")}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("organizations.invitations.columns.email")}</TableHead>
                    <TableHead>{t("organizations.invitations.columns.role")}</TableHead>
                    <TableHead>{t("organizations.invitations.columns.status")}</TableHead>
                    <TableHead>{t("organizations.invitations.columns.sent")}</TableHead>
                    <TableHead>{t("organizations.invitations.columns.expires")}</TableHead>
                    {canCancelInvitations && (
                      <TableHead className="w-[100px]">
                        {t("organizations.invitations.columns.actions")}
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingInvitations.map((invitation) => {
                    const isExpired = new Date(invitation.expiresAt) < new Date();
                    return (
                      <TableRow key={invitation.id}>
                        <TableCell className="font-medium">{invitation.email}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getRoleIcon(invitation.role)}
                            <span>{roleLabel(t, invitation.role)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(invitation.status, invitation.expiresAt)}
                            {getStatusBadge(invitation.status, invitation.expiresAt)}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatRelativeTime(invitation.createdAt, t)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          <span className={isExpired ? "text-destructive" : ""}>
                            {formatDate(invitation.expiresAt)}
                          </span>
                        </TableCell>
                        {canCancelInvitations && (
                          <TableCell>
                            {!isExpired && invitation.status === "pending" && (
                              <Button
                                disabled={cancelInvitation.isPending}
                                onClick={() => handleCancelInvitation(invitation)}
                                size="sm"
                                variant="ghost"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Invitation Confirmation Dialog */}
      <AlertDialog
        onOpenChange={(open) => !open && setInvitationToCancel(null)}
        open={!!invitationToCancel}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("organizations.invitations.cancelTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("organizations.invitations.cancelConfirm", { email: invitationToCancel?.email })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("organizations.invitations.keep")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelInvitation.isPending}
              onClick={confirmCancelInvitation}
            >
              {t("organizations.invitations.cancelAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
