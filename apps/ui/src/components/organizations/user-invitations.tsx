// import { Badge } from "@/components/ui/badge";

import type { TFunction } from "i18next";
import { Building2, Check, Clock, Crown, Mail, Shield, User, X } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAcceptInvitation,
  useRejectInvitation,
  useUserInvitations,
} from "@/hooks/use-organizations";
import { type OrganizationInvitation, roleLabel } from "@/lib/organization-types";
import { formatDate as formatProjectDate, formatRelativeFromNow } from "@/lib/format";

// Time calculation constants
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const MILLISECONDS_PER_HOUR = MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE * MINUTES_PER_HOUR;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;

type UserInvitationsProps = {
  className?: string;
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
  const diffInHours = Math.floor((targetDate.getTime() - now.getTime()) / MILLISECONDS_PER_HOUR);

  if (diffInHours < 1) {
    return t("organizations.invitations.expiresSoon");
  }

  const diffInDays = Math.floor(diffInHours / HOURS_PER_DAY);
  if (diffInDays < DAYS_PER_WEEK) {
    return t("organizations.invitations.expiresIn", { when: formatRelativeFromNow(date) });
  }

  return t("organizations.invitations.expiresOn", { date: formatDate(date) });
};

export function UserInvitations({ className }: UserInvitationsProps) {
  const { t } = useTranslation();
  const [invitationToAccept, setInvitationToAccept] = useState<OrganizationInvitation | null>(null);
  const [invitationToReject, setInvitationToReject] = useState<OrganizationInvitation | null>(null);

  const { data: invitations = [], isLoading } = useUserInvitations();
  const acceptInvitation = useAcceptInvitation();
  const rejectInvitation = useRejectInvitation();

  const pendingInvitations = invitations.filter((inv) => {
    const isExpired = new Date(inv.expiresAt) < new Date();
    return inv.status === "pending" && !isExpired;
  });

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

  const handleAcceptInvitation = (invitation: OrganizationInvitation) => {
    setInvitationToAccept(invitation);
  };

  const handleRejectInvitation = (invitation: OrganizationInvitation) => {
    setInvitationToReject(invitation);
  };

  const confirmAcceptInvitation = async () => {
    if (!invitationToAccept) {
      return;
    }

    try {
      await acceptInvitation.mutateAsync(invitationToAccept.id);
      setInvitationToAccept(null);
    } catch {
      // Error handling is done in the mutation
    }
  };

  const confirmRejectInvitation = async () => {
    if (!invitationToReject) {
      return;
    }

    try {
      await rejectInvitation.mutateAsync(invitationToReject.id);
      setInvitationToReject(null);
    } catch {
      // Error handling is done in the mutation
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-48" />
          </div>
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 2 }).map(() => (
              <div
                className="flex items-center justify-between rounded border p-4"
                key={`invitation-skeleton-${crypto.randomUUID()}`}
              >
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="flex space-x-2">
                  <Skeleton className="h-9 w-20" />
                  <Skeleton className="h-9 w-20" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pendingInvitations.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Mail className="mb-4 h-12 w-12 text-muted-foreground" />
          <CardTitle className="mb-2 text-lg">
            {t("organizations.invitations.userEmptyTitle")}
          </CardTitle>
          <CardDescription className="text-center">
            {t("organizations.invitations.userEmptyDescription")}
          </CardDescription>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Mail className="h-5 w-5" />
            <span>
              {t("organizations.invitations.userTitle", { count: pendingInvitations.length })}
            </span>
          </CardTitle>
          <CardDescription>{t("organizations.invitations.userDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pendingInvitations.map((invitation) => (
              <div
                className="flex items-center justify-between rounded-lg border p-6"
                key={invitation.id}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                    {invitation.organization?.logo ? (
                      <img
                        alt={
                          invitation.organization.name ||
                          t("organizations.invitations.organization")
                        }
                        className="h-12 w-12 rounded-lg object-cover"
                        height={48}
                        src={invitation.organization.logo}
                        width={48}
                      />
                    ) : (
                      <Building2 className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {invitation.organization?.name ||
                          t("organizations.invitations.organization")}
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        {t("organizations.invitations.invitedAs")}{" "}
                        <span className="inline-flex items-center space-x-1">
                          {getRoleIcon(invitation.role)}
                          <span className="font-medium">{roleLabel(t, invitation.role)}</span>
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 text-muted-foreground text-sm">
                      <Clock className="h-4 w-4" />
                      <span>{formatRelativeTime(invitation.expiresAt, t)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    disabled={acceptInvitation.isPending || rejectInvitation.isPending}
                    onClick={() => handleRejectInvitation(invitation)}
                    variant="outline"
                  >
                    <X className="mr-2 h-4 w-4" />
                    {t("organizations.invitations.decline")}
                  </Button>
                  <Button
                    disabled={acceptInvitation.isPending || rejectInvitation.isPending}
                    onClick={() => handleAcceptInvitation(invitation)}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    {t("organizations.invitations.accept")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Accept Invitation Confirmation Dialog */}
      <AlertDialog
        onOpenChange={(open) => !open && setInvitationToAccept(null)}
        open={!!invitationToAccept}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("organizations.invitations.acceptTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("organizations.invitations.acceptConfirm", {
                organization: invitationToAccept?.organization?.name,
                role: roleLabel(t, invitationToAccept?.role ?? ""),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={acceptInvitation.isPending}
              onClick={confirmAcceptInvitation}
            >
              {t("organizations.invitations.acceptTitle")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Invitation Confirmation Dialog */}
      <AlertDialog
        onOpenChange={(open) => !open && setInvitationToReject(null)}
        open={!!invitationToReject}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("organizations.invitations.declineTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("organizations.invitations.declineConfirm", {
                organization: invitationToReject?.organization?.name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("organizations.invitations.keepInvitation")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={rejectInvitation.isPending}
              onClick={confirmRejectInvitation}
            >
              {t("organizations.invitations.declineTitle")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
