import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  OrganizationList,
  OrganizationSettings,
  MemberList,
  PendingInvitations,
  CreateOrganizationDialog,
  InviteMemberDialog,
  UserInvitations
} from "@/components/organizations";
import { 
  useActiveOrganization, 
  useOrganizations,
  useOrganizationMembers,
} from "@/hooks/use-organizations";
import { authClient } from "@/lib/auth-client";
import { Building2, Users, Plus } from "lucide-react";
import { useState } from "react";

export default function OrganizationsPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const { data: session } = authClient.useSession();
  const { data: organizations = [] } = useOrganizations();
  const { data: activeOrganization } = useActiveOrganization();
  const { data: members = [] } = useOrganizationMembers(activeOrganization?.id);

  // Get current user's role in the active organization
  const currentUserMember = members.find(member => member.userId === session?.user?.id);
  const currentUserRole = currentUserMember?.role || "member";

  const canManageMembers = currentUserRole === "owner" || currentUserRole === "admin";
  const canEditOrganization = currentUserRole === "owner" || currentUserRole === "admin";
  const canDeleteOrganization = currentUserRole === "owner";

  const handleCreateOrganization = () => {
    setShowCreateDialog(true);
  };

  const handleInviteMembers = () => {
    setShowInviteDialog(true);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Organizations</h1>
          <p className="text-muted-foreground">
            Manage your organizations and team members.
          </p>
        </div>
        <Button onClick={handleCreateOrganization}>
          <Plus className="mr-2 h-4 w-4" />
          Create Organization
        </Button>
      </div>

      {/* User Invitations */}
      <UserInvitations />

      {activeOrganization ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList className="grid w-full max-w-md grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="invitations">Invitations</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-6">
            {/* Active Organization Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Building2 className="h-5 w-5" />
                  <span>Active Organization</span>
                </CardTitle>
                <CardDescription>
                  Currently working in "{activeOrganization.name}"
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-start space-x-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
                    {activeOrganization.logo ? (
                      <img
                        src={activeOrganization.logo}
                        alt={activeOrganization.name}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                    ) : (
                      <Building2 className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold">{activeOrganization.name}</h3>
                    <p className="text-muted-foreground">@{activeOrganization.slug}</p>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Users className="h-4 w-4" />
                        <span>{members.length} member{members.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span>Your role: <strong>{currentUserRole}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* All Organizations */}
            <Card>
              <CardHeader>
                <CardTitle>All Organizations</CardTitle>
                <CardDescription>
                  Switch between organizations or manage their settings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <OrganizationList
                  onManageOrganization={() => setActiveTab("settings")}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="members" className="space-y-6">
            <MemberList
              organizationId={activeOrganization.id}
              currentUserRole={currentUserRole}
              currentUserId={session?.user?.id}
              onInviteMembers={canManageMembers ? handleInviteMembers : undefined}
            />
          </TabsContent>

          <TabsContent value="invitations" className="space-y-6">
            <PendingInvitations
              organizationId={activeOrganization.id}
              canCancelInvitations={canManageMembers}
            />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <OrganizationSettings
              organization={activeOrganization}
              userRole={currentUserRole}
              canEdit={canEditOrganization}
              canDelete={canDeleteOrganization}
            />
          </TabsContent>
        </Tabs>
      ) : organizations.length > 0 ? (
        /* No active organization but has organizations */
        <Card>
          <CardHeader>
            <CardTitle>Select an Organization</CardTitle>
            <CardDescription>
              Choose an organization to view its details and manage members.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OrganizationList />
          </CardContent>
        </Card>
      ) : (
        /* No organizations */
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
            <CardTitle className="text-xl mb-2">Get Started with Organizations</CardTitle>
            <CardDescription className="text-center mb-6 max-w-md">
              Organizations help you collaborate with your team. Create your first organization 
              or wait to be invited to join an existing one.
            </CardDescription>
            <Button onClick={handleCreateOrganization}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Organization
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <CreateOrganizationDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog}
      />
      
      {activeOrganization && (
        <InviteMemberDialog
          open={showInviteDialog}
          onOpenChange={setShowInviteDialog}
          organizationId={activeOrganization.id}
        />
      )}
    </div>
  );
}