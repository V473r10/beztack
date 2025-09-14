import { IconArrowLeft, IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { AdminUser } from "@/lib/admin-types";
import { AdminHeader } from "./components/shared/admin-header";
import { UserDetails } from "./components/user-management/user-details";
import { UserForm } from "./components/user-management/user-form";
import { UserList } from "./components/user-management/user-list";

type ViewMode = "list" | "details";

export default function UsersPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  const handleCreateUser = () => {
    setEditingUser(null);
    setShowCreateModal(true);
  };

  const handleEditUser = (user: AdminUser) => {
    setEditingUser(user);
    setShowEditModal(true);
  };

  const handleBackToList = () => {
    setViewMode("list");
    setSelectedUser(null);
  };

  const handleRefresh = () => {
    // This will trigger a refetch in the UserList component
    window.location.reload();
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {viewMode === "list" ? (
        <>
          <AdminHeader
            action={
              <Button onClick={handleCreateUser}>
                <IconPlus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            }
            description="Manage user accounts, roles, and permissions"
            title="User Management"
          />
          <UserList
            onCreateUser={handleCreateUser}
            onEditUser={handleEditUser}
          />
        </>
      ) : (
        <>
          <AdminHeader
            action={
              <Button onClick={handleBackToList} variant="outline">
                <IconArrowLeft className="mr-2 h-4 w-4" />
                Back to List
              </Button>
            }
            description="View and manage user information"
            title={selectedUser?.name || selectedUser?.email || "User Details"}
          />
          {selectedUser && (
            <UserDetails
              onEdit={() => handleEditUser(selectedUser)}
              user={selectedUser}
            />
          )}
        </>
      )}

      {/* Create User Modal */}
      <UserForm
        onOpenChange={setShowCreateModal}
        onSuccess={handleRefresh}
        open={showCreateModal}
        user={null}
      />

      {/* Edit User Modal */}
      <UserForm
        onOpenChange={setShowEditModal}
        onSuccess={handleRefresh}
        open={showEditModal}
        user={editingUser}
      />
    </div>
  );
}
