import {
  IconCalendar,
  IconDevices,
  IconMail,
  IconTrash,
  IconUser,
  IconUserCog,
} from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { AdminUser } from "@/lib/admin-types";
import {
  formatDate,
  formatRelativeTime,
  getUserRoles,
  getUserStatus,
} from "@/lib/admin-utils";
import { authClient } from "@/lib/auth-client";

// Constants
const SESSION_ID_PREVIEW_LENGTH = 8;

type UserDetailsProps = {
  user: AdminUser;
  onEdit: () => void;
};

export function UserDetails({ user, onEdit }: UserDetailsProps) {
  const status = getUserStatus(user);
  const roles = getUserRoles(user);

  // Fetch user sessions
  const { data: sessions, refetch: refetchSessions } = useQuery({
    queryKey: ["admin", "user", user.id, "sessions"],
    queryFn: async () => {
      const response = await authClient.admin.listUserSessions({
        userId: user.id,
      });
      if (!response.data) {
        throw new Error("Failed to fetch sessions");
      }
      return response.data;
    },
  });

  // Revoke session mutation
  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await authClient.admin.revokeUserSession({
        sessionToken: sessionId,
      });
      if (!response.data) {
        throw new Error("Failed to revoke session");
      }
      return response.data;
    },
    onSuccess: () => {
      toast.success("Session revoked successfully");
      refetchSessions();
    },
    onError: (error) => {
      toast.error(`Failed to revoke session: ${error.message}`);
    },
  });

  // Revoke all sessions mutation
  const revokeAllSessionsMutation = useMutation({
    mutationFn: async () => {
      const response = await authClient.admin.revokeUserSessions({
        userId: user.id,
      });
      if (!response.data) {
        throw new Error("Failed to revoke all sessions");
      }
      return response.data;
    },
    onSuccess: () => {
      toast.success("All sessions revoked successfully");
      refetchSessions();
    },
    onError: (error) => {
      toast.error(`Failed to revoke all sessions: ${error.message}`);
    },
  });

  return (
    <div className="space-y-6">
      {/* User Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <IconUser className="h-5 w-5" />
                User Information
              </CardTitle>
              <CardDescription>
                Basic user account details and status
              </CardDescription>
            </div>
            <Button onClick={onEdit} variant="outline">
              <IconUserCog className="mr-2 h-4 w-4" />
              Edit User
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="font-medium text-muted-foreground text-sm">
                Email
              </div>
              <div className="flex items-center gap-2">
                <IconMail className="h-4 w-4" />
                {user.email}
              </div>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-muted-foreground text-sm">
                Name
              </div>
              <div>{user.name || "Not provided"}</div>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-muted-foreground text-sm">
                Status
              </div>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-muted-foreground text-sm">
                Roles
              </div>
              <div className="flex gap-1">
                {roles.map((role) => (
                  <Badge key={role} variant="outline">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-muted-foreground text-sm">
                Email Verified
              </div>
              <Badge variant={user.emailVerified ? "default" : "secondary"}>
                {user.emailVerified ? "Verified" : "Not Verified"}
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-muted-foreground text-sm">
                Account Created
              </div>
              <div className="flex items-center gap-2">
                <IconCalendar className="h-4 w-4" />
                <div>
                  <div>{formatDate(user.createdAt)}</div>
                  <div className="text-muted-foreground text-xs">
                    {formatRelativeTime(user.createdAt)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {user.banned && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="font-medium text-muted-foreground text-sm">
                  Ban Information
                </div>
                <div className="space-y-1">
                  {user.banReason && (
                    <div className="text-sm">
                      <span className="font-medium">Reason:</span>{" "}
                      {user.banReason}
                    </div>
                  )}
                  {user.banExpires && (
                    <div className="text-sm">
                      <span className="font-medium">Expires:</span>{" "}
                      {formatDate(user.banExpires)}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <IconDevices className="h-5 w-5" />
                Active Sessions
              </CardTitle>
              <CardDescription>
                Manage user sessions and device access
              </CardDescription>
            </div>
            <Button
              disabled={
                !sessions?.sessions?.length ||
                revokeAllSessionsMutation.isPending
              }
              onClick={() => revokeAllSessionsMutation.mutate()}
              size="sm"
              variant="destructive"
            >
              Revoke All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sessions?.sessions?.length ? (
            <div className="space-y-3">
              {sessions.sessions.map((session) => (
                <div
                  className="flex items-center justify-between rounded-lg border p-3"
                  key={session.id}
                >
                  <div className="space-y-1">
                    <div className="font-medium text-sm">
                      Session {session.id.slice(0, SESSION_ID_PREVIEW_LENGTH)}
                      ...
                    </div>
                    <div className="space-y-1 text-muted-foreground text-xs">
                      <div>Created: {formatDate(session.createdAt)}</div>
                      <div>Expires: {formatDate(session.expiresAt)}</div>
                      {session.ipAddress && <div>IP: {session.ipAddress}</div>}
                      {session.userAgent && (
                        <div>User Agent: {session.userAgent}</div>
                      )}
                      {session.impersonatedBy && (
                        <div className="text-orange-600">
                          Impersonated by: {session.impersonatedBy}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    disabled={revokeSessionMutation.isPending}
                    onClick={() => revokeSessionMutation.mutate(session.id)}
                    size="sm"
                    variant="destructive"
                  >
                    <IconTrash className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-muted-foreground">
              No active sessions found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
