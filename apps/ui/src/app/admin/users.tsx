import { useState } from "react";
import { AdminHeader } from "./components/shared/admin-header";
import { UserList } from "./components/user-management/user-list";
import { UserForm } from "./components/user-management/user-form";
import { UserDetails } from "./components/user-management/user-details";
import { Button } from "@/components/ui/button";
import type { AdminUser } from "@/lib/admin-types";
import { IconPlus, IconArrowLeft } from "@tabler/icons-react";

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
						title="User Management"
						description="Manage user accounts, roles, and permissions"
						action={
							<Button onClick={handleCreateUser}>
								<IconPlus className="mr-2 h-4 w-4" />
								Add User
							</Button>
						}
					/>
					<UserList 
						onEditUser={handleEditUser}
						onCreateUser={handleCreateUser}
					/>
				</>
			) : (
				<>
					<AdminHeader
						title={selectedUser?.name || selectedUser?.email || "User Details"}
						description="View and manage user information"
						action={
							<Button onClick={handleBackToList} variant="outline">
								<IconArrowLeft className="mr-2 h-4 w-4" />
								Back to List
							</Button>
						}
					/>
					{selectedUser && (
						<UserDetails 
							user={selectedUser}
							onEdit={() => handleEditUser(selectedUser)}
						/>
					)}
				</>
			)}

			{/* Create User Modal */}
			<UserForm
				open={showCreateModal}
				onOpenChange={setShowCreateModal}
				user={null}
				onSuccess={handleRefresh}
			/>

			{/* Edit User Modal */}
			<UserForm
				open={showEditModal}
				onOpenChange={setShowEditModal}
				user={editingUser}
				onSuccess={handleRefresh}
			/>
		</div>
	);
}