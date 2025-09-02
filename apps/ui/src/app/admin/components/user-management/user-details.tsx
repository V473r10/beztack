import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";
import { formatDate, formatRelativeTime, getUserRoles, getUserStatus } from "@/lib/admin-utils";
import type { AdminUser, AdminSession } from "@/lib/admin-types";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
	IconUser, 
	IconMail, 
	IconCalendar, 
	IconDevices,
	IconTrash,
	IconUserCog
} from "@tabler/icons-react";
import { toast } from "sonner";

interface UserDetailsProps {
	user: AdminUser;
	onEdit: () => void;
}

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
			const response = await authClient.admin.revokeSession({
				sessionId,
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
			toast.error("Failed to revoke session: " + error.message);
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
			toast.error("Failed to revoke all sessions: " + error.message);
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
							<div className="text-sm font-medium text-muted-foreground">Email</div>
							<div className="flex items-center gap-2">
								<IconMail className="h-4 w-4" />
								{user.email}
							</div>
						</div>
						<div className="space-y-2">
							<div className="text-sm font-medium text-muted-foreground">Name</div>
							<div>{user.name || "Not provided"}</div>
						</div>
						<div className="space-y-2">
							<div className="text-sm font-medium text-muted-foreground">Status</div>
							<Badge variant={status.variant}>{status.label}</Badge>
						</div>
						<div className="space-y-2">
							<div className="text-sm font-medium text-muted-foreground">Roles</div>
							<div className="flex gap-1">
								{roles.map((role) => (
									<Badge key={role} variant="outline">
										{role}
									</Badge>
								))}
							</div>
						</div>
						<div className="space-y-2">
							<div className="text-sm font-medium text-muted-foreground">Email Verified</div>
							<Badge variant={user.emailVerified ? "default" : "secondary"}>
								{user.emailVerified ? "Verified" : "Not Verified"}
							</Badge>
						</div>
						<div className="space-y-2">
							<div className="text-sm font-medium text-muted-foreground">Account Created</div>
							<div className="flex items-center gap-2">
								<IconCalendar className="h-4 w-4" />
								<div>
									<div>{formatDate(user.createdAt)}</div>
									<div className="text-xs text-muted-foreground">
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
								<div className="text-sm font-medium text-muted-foreground">Ban Information</div>
								<div className="space-y-1">
									{user.banReason && (
										<div className="text-sm">
											<span className="font-medium">Reason:</span> {user.banReason}
										</div>
									)}
									{user.banExpires && (
										<div className="text-sm">
											<span className="font-medium">Expires:</span> {formatDate(user.banExpires)}
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
							onClick={() => revokeAllSessionsMutation.mutate()}
							variant="destructive"
							size="sm"
							disabled={!sessions?.length || revokeAllSessionsMutation.isPending}
						>
							Revoke All
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{sessions?.length ? (
						<div className="space-y-3">
							{sessions.map((session: AdminSession) => (
								<div 
									key={session.id} 
									className="flex items-center justify-between p-3 border rounded-lg"
								>
									<div className="space-y-1">
										<div className="text-sm font-medium">
											Session {session.id.slice(0, 8)}...
										</div>
										<div className="text-xs text-muted-foreground space-y-1">
											<div>Created: {formatDate(session.createdAt)}</div>
											<div>Expires: {formatDate(session.expiresAt)}</div>
											{session.ipAddress && (
												<div>IP: {session.ipAddress}</div>
											)}
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
										onClick={() => revokeSessionMutation.mutate(session.id)}
										variant="destructive"
										size="sm"
										disabled={revokeSessionMutation.isPending}
									>
										<IconTrash className="h-4 w-4" />
									</Button>
								</div>
							))}
						</div>
					) : (
						<div className="text-center py-6 text-muted-foreground">
							No active sessions found
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}