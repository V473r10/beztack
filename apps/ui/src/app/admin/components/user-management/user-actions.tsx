import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { authClient } from "@/lib/auth-client";
import type { AdminUser } from "@/lib/admin-types";
import { useMutation } from "@tanstack/react-query";
import { 
	IconDots, 
	IconEdit, 
	IconUserX, 
	IconUserCheck, 
	IconTrash,
	IconUserCog,
	IconKey
} from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

interface UserActionsProps {
	user: AdminUser;
	onEdit: () => void;
	onRefresh: () => void;
}

type ActionType = "ban" | "unban" | "delete" | null;

export function UserActions({ user, onEdit, onRefresh }: UserActionsProps) {
	const [pendingAction, setPendingAction] = useState<ActionType>(null);

	// Ban user mutation
	const banUserMutation = useMutation({
		mutationFn: async (banReason?: string) => {
			const response = await authClient.admin.banUser({
				userId: user.id,
				banReason,
			});
			if (!response.data) {
				throw new Error("Failed to ban user");
			}
			return response.data;
		},
		onSuccess: () => {
			toast.success("User has been banned successfully");
			onRefresh();
			setPendingAction(null);
		},
		onError: (error) => {
			toast.error("Failed to ban user: " + error.message);
			setPendingAction(null);
		},
	});

	// Unban user mutation
	const unbanUserMutation = useMutation({
		mutationFn: async () => {
			const response = await authClient.admin.unbanUser({
				userId: user.id,
			});
			if (!response.data) {
				throw new Error("Failed to unban user");
			}
			return response.data;
		},
		onSuccess: () => {
			toast.success("User has been unbanned successfully");
			onRefresh();
			setPendingAction(null);
		},
		onError: (error) => {
			toast.error("Failed to unban user: " + error.message);
			setPendingAction(null);
		},
	});

	// Delete user mutation
	const deleteUserMutation = useMutation({
		mutationFn: async () => {
			const response = await authClient.admin.removeUser({
				userId: user.id,
			});
			if (!response.data) {
				throw new Error("Failed to delete user");
			}
			return response.data;
		},
		onSuccess: () => {
			toast.success("User has been deleted successfully");
			onRefresh();
			setPendingAction(null);
		},
		onError: (error) => {
			toast.error("Failed to delete user: " + error.message);
			setPendingAction(null);
		},
	});

	const handleBanUser = () => {
		banUserMutation.mutate("Banned by administrator");
	};

	const handleUnbanUser = () => {
		unbanUserMutation.mutate();
	};

	const handleDeleteUser = () => {
		deleteUserMutation.mutate();
	};

	const isLoading = banUserMutation.isPending || unbanUserMutation.isPending || deleteUserMutation.isPending;

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" className="h-8 w-8 p-0" disabled={isLoading}>
						<span className="sr-only">Open menu</span>
						<IconDots className="h-4 w-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuLabel>Actions</DropdownMenuLabel>
					<DropdownMenuItem onClick={onEdit}>
						<IconEdit className="mr-2 h-4 w-4" />
						Edit User
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => {/* TODO: Implement role management */}}>
						<IconUserCog className="mr-2 h-4 w-4" />
						Manage Roles
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => {/* TODO: Implement password reset */}}>
						<IconKey className="mr-2 h-4 w-4" />
						Reset Password
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					{user.banned ? (
						<DropdownMenuItem 
							onClick={() => setPendingAction("unban")}
							className="text-green-600"
						>
							<IconUserCheck className="mr-2 h-4 w-4" />
							Unban User
						</DropdownMenuItem>
					) : (
						<DropdownMenuItem 
							onClick={() => setPendingAction("ban")}
							className="text-orange-600"
						>
							<IconUserX className="mr-2 h-4 w-4" />
							Ban User
						</DropdownMenuItem>
					)}
					<DropdownMenuSeparator />
					<DropdownMenuItem 
						onClick={() => setPendingAction("delete")}
						className="text-red-600"
					>
						<IconTrash className="mr-2 h-4 w-4" />
						Delete User
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Ban Confirmation Dialog */}
			<AlertDialog open={pendingAction === "ban"} onOpenChange={() => setPendingAction(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Ban User</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to ban {user.name || user.email}? This will prevent them from accessing the application.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction 
							onClick={handleBanUser}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Ban User
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Unban Confirmation Dialog */}
			<AlertDialog open={pendingAction === "unban"} onOpenChange={() => setPendingAction(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Unban User</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to unban {user.name || user.email}? This will restore their access to the application.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={handleUnbanUser}>
							Unban User
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={pendingAction === "delete"} onOpenChange={() => setPendingAction(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete User</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to permanently delete {user.name || user.email}? This action cannot be undone and will remove all user data.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction 
							onClick={handleDeleteUser}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Delete User
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}