import {
  IconDots,
  IconEdit,
  IconKey,
  IconTrash,
  IconUserCheck,
  IconUserCog,
  IconUserX,
} from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AdminUser } from "@/lib/admin-types";
import { authClient } from "@/lib/auth-client";

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
      toast.error(`Failed to ban user: ${error.message}`);
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
      toast.error(`Failed to unban user: ${error.message}`);
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
      toast.error(`Failed to delete user: ${error.message}`);
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

  const isLoading =
    banUserMutation.isPending ||
    unbanUserMutation.isPending ||
    deleteUserMutation.isPending;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="h-8 w-8 p-0" disabled={isLoading} variant="ghost">
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
          <DropdownMenuItem
            onClick={() => {
              /* TODO: Implement role management */
            }}
          >
            <IconUserCog className="mr-2 h-4 w-4" />
            Manage Roles
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              /* TODO: Implement password reset */
            }}
          >
            <IconKey className="mr-2 h-4 w-4" />
            Reset Password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {user.banned ? (
            <DropdownMenuItem
              className="text-green-600"
              onClick={() => setPendingAction("unban")}
            >
              <IconUserCheck className="mr-2 h-4 w-4" />
              Unban User
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              className="text-orange-600"
              onClick={() => setPendingAction("ban")}
            >
              <IconUserX className="mr-2 h-4 w-4" />
              Ban User
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600"
            onClick={() => setPendingAction("delete")}
          >
            <IconTrash className="mr-2 h-4 w-4" />
            Delete User
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Ban Confirmation Dialog */}
      <AlertDialog
        onOpenChange={() => setPendingAction(null)}
        open={pendingAction === "ban"}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ban User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to ban {user.name || user.email}? This will
              prevent them from accessing the application.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBanUser}
            >
              Ban User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unban Confirmation Dialog */}
      <AlertDialog
        onOpenChange={() => setPendingAction(null)}
        open={pendingAction === "unban"}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unban User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unban {user.name || user.email}? This
              will restore their access to the application.
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
      <AlertDialog
        onOpenChange={() => setPendingAction(null)}
        open={pendingAction === "delete"}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete{" "}
              {user.name || user.email}? This action cannot be undone and will
              remove all user data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteUser}
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
