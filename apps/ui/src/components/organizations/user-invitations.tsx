// import { Badge } from "@/components/ui/badge";

import {
  Building2,
  Check,
  Clock,
  Crown,
  Mail,
  Shield,
  User,
  X,
} from "lucide-react";
import { useState } from "react";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAcceptInvitation,
  useRejectInvitation,
  useUserInvitations,
} from "@/hooks/use-organizations";
import {
  type OrganizationInvitation,
  type OrganizationRole,
  ROLE_LABELS,
} from "@/lib/organization-types";

// Time calculation constants
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const MILLISECONDS_PER_HOUR =
  MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE * MINUTES_PER_HOUR;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;

type UserInvitationsProps = {
  className?: string;
};

// Simple date formatting utility
const formatDate = (date: Date | string) => {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatRelativeTime = (date: Date | string) => {
  const now = new Date();
  const targetDate = new Date(date);
  const diffInHours = Math.floor(
    (targetDate.getTime() - now.getTime()) / MILLISECONDS_PER_HOUR
  );

  if (diffInHours < 1) {
    return "Expires soon";
  }
  if (diffInHours < HOURS_PER_DAY) {
    return `Expires in ${diffInHours} hour${diffInHours === 1 ? "" : "s"}`;
  }

  const diffInDays = Math.floor(diffInHours / HOURS_PER_DAY);
  if (diffInDays < DAYS_PER_WEEK) {
    return `Expires in ${diffInDays} day${diffInDays === 1 ? "" : "s"}`;
  }

  return `Expires ${formatDate(date)}`;
};

export function UserInvitations({ className }: UserInvitationsProps) {
  const [invitationToAccept, setInvitationToAccept] =
    useState<OrganizationInvitation | null>(null);
  const [invitationToReject, setInvitationToReject] =
    useState<OrganizationInvitation | null>(null);

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
    } catch (_error) {
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
    } catch (_error) {
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
            {Array.from({ length: 2 }).map((_, _i) => (
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
          <CardTitle className="mb-2 text-lg">No Pending Invitations</CardTitle>
          <CardDescription className="text-center">
            You don't have any pending organization invitations at the moment.
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
            <span>Organization Invitations ({pendingInvitations.length})</span>
          </CardTitle>
          <CardDescription>
            You have been invited to join these organizations.
          </CardDescription>
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
                        alt={invitation.organization.name || "Organization"}
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
                        {invitation.organization?.name || "Organization"}
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        You've been invited to join as{" "}
                        <span className="inline-flex items-center space-x-1">
                          {getRoleIcon(invitation.role)}
                          <span className="font-medium">
                            {ROLE_LABELS[invitation.role as OrganizationRole] ||
                              invitation.role}
                          </span>
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 text-muted-foreground text-sm">
                      <Clock className="h-4 w-4" />
                      <span>{formatRelativeTime(invitation.expiresAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    disabled={
                      acceptInvitation.isPending || rejectInvitation.isPending
                    }
                    onClick={() => handleRejectInvitation(invitation)}
                    variant="outline"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Decline
                  </Button>
                  <Button
                    disabled={
                      acceptInvitation.isPending || rejectInvitation.isPending
                    }
                    onClick={() => handleAcceptInvitation(invitation)}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Accept
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
            <AlertDialogTitle>Accept Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to join "
              {invitationToAccept?.organization?.name}" as{" "}
              {ROLE_LABELS[invitationToAccept?.role as OrganizationRole]}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={acceptInvitation.isPending}
              onClick={confirmAcceptInvitation}
            >
              Accept Invitation
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
            <AlertDialogTitle>Decline Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to decline the invitation to join "
              {invitationToReject?.organization?.name}"? You can ask to be
              invited again later if you change your mind.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep invitation</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={rejectInvitation.isPending}
              onClick={confirmRejectInvitation}
            >
              Decline Invitation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
