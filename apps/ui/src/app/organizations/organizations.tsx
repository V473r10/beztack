import { Building2, Plus, Users } from "lucide-react";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  CreateOrganizationDialog,
  InviteMemberDialog,
  MemberList,
  OrganizationList,
  OrganizationSettings,
  PendingInvitations,
} from "@/components/organizations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useActiveOrganization,
  useOrganizationMembers,
  useOrganizations,
} from "@/hooks/use-organizations";
import { authClient } from "@/lib/auth-client";
import { roleLabel } from "@/lib/organization-types";

export default function OrganizationsPage() {
  const { t } = useTranslation();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const { data: session } = authClient.useSession();
  const { data: organizations = [] } = useOrganizations();
  const { data: activeOrganization } = useActiveOrganization();
  const { data: members = [] } = useOrganizationMembers(activeOrganization?.id);

  // Get current user's role in the active organization
  const currentUserMember = members.find((member) => member.userId === session?.user?.id);
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
    <div className="space-y-6 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-bold text-3xl">{t("organizations.page.title")}</h1>
          <p className="text-muted-foreground">{t("organizations.page.description")}</p>
        </div>
        <Button onClick={handleCreateOrganization}>
          <Plus className="mr-2 h-4 w-4" />
          {t("organizations.createDialog.title")}
        </Button>
      </div>

      {(() => {
        if (activeOrganization) {
          return (
            <Tabs className="space-y-6" onValueChange={setActiveTab} value={activeTab}>
              <div className="flex items-center justify-between">
                <TabsList className="grid w-full max-w-md grid-cols-4">
                  <TabsTrigger value="overview">
                    {t("organizations.page.tabs.overview")}
                  </TabsTrigger>
                  <TabsTrigger value="members">{t("organizations.page.tabs.members")}</TabsTrigger>
                  <TabsTrigger value="invitations">
                    {t("organizations.page.tabs.invitations")}
                  </TabsTrigger>
                  <TabsTrigger value="settings">
                    {t("organizations.page.tabs.settings")}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent className="space-y-6" value="overview">
                {/* Active Organization Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Building2 className="h-5 w-5" />
                      <span>{t("organizations.page.activeTitle")}</span>
                    </CardTitle>
                    <CardDescription>
                      {t("organizations.page.activeDescription", { name: activeOrganization.name })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start space-x-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
                        {activeOrganization.logo ? (
                          <img
                            alt={activeOrganization.name}
                            className="h-16 w-16 rounded-lg object-cover"
                            height={64}
                            src={activeOrganization.logo}
                            width={64}
                          />
                        ) : (
                          <Building2 className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="space-y-2">
                        <h3 className="font-semibold text-xl">{activeOrganization.name}</h3>
                        <p className="text-muted-foreground">{`@${activeOrganization.slug}`}</p>
                        <div className="flex items-center space-x-4 text-muted-foreground text-sm">
                          <div className="flex items-center space-x-1">
                            <Users className="h-4 w-4" />
                            <span>
                              {t("organizations.page.memberCount", { count: members.length })}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span>
                              <Trans
                                components={{ strong: <strong /> }}
                                i18nKey="organizations.page.yourRole"
                                values={{ role: roleLabel(t, currentUserRole) }}
                              />
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* All Organizations */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t("organizations.page.allTitle")}</CardTitle>
                    <CardDescription>{t("organizations.page.allDescription")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <OrganizationList onManageOrganization={() => setActiveTab("settings")} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent className="space-y-6" value="members">
                <MemberList
                  currentUserId={session?.user?.id}
                  currentUserRole={currentUserRole}
                  onInviteMembers={canManageMembers ? handleInviteMembers : undefined}
                  organizationId={activeOrganization.id}
                />
              </TabsContent>

              <TabsContent className="space-y-6" value="invitations">
                <PendingInvitations
                  canCancelInvitations={canManageMembers}
                  organizationId={activeOrganization.id}
                />
              </TabsContent>

              <TabsContent className="space-y-6" value="settings">
                <OrganizationSettings
                  canDelete={canDeleteOrganization}
                  canEdit={canEditOrganization}
                  organization={activeOrganization}
                  userRole={currentUserRole}
                />
              </TabsContent>
            </Tabs>
          );
        }

        if (organizations.length > 0) {
          return (
            /* No active organization but has organizations */
            <Card>
              <CardHeader>
                <CardTitle>{t("organizations.page.selectTitle")}</CardTitle>
                <CardDescription>{t("organizations.page.selectDescription")}</CardDescription>
              </CardHeader>
              <CardContent>
                <OrganizationList />
              </CardContent>
            </Card>
          );
        }

        return (
          /* No organizations */
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="mb-4 h-16 w-16 text-muted-foreground" />
              <CardTitle className="mb-2 text-xl">{t("organizations.page.emptyTitle")}</CardTitle>
              <CardDescription className="mb-6 max-w-md text-center">
                {t("organizations.page.emptyDescription")}
              </CardDescription>
              <Button onClick={handleCreateOrganization}>
                <Plus className="mr-2 h-4 w-4" />
                {t("organizations.page.emptyCreate")}
              </Button>
            </CardContent>
          </Card>
        );
      })()}

      {/* Dialogs */}
      <CreateOrganizationDialog onOpenChange={setShowCreateDialog} open={showCreateDialog} />

      {activeOrganization && (
        <InviteMemberDialog
          onOpenChange={setShowInviteDialog}
          open={showInviteDialog}
          organizationId={activeOrganization.id}
        />
      )}
    </div>
  );
}
