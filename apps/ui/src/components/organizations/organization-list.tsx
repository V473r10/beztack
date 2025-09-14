import { Building2, Crown, Settings, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  useActiveOrganization,
  useOrganizations,
  useSetActiveOrganization,
} from "@/hooks/use-organizations";
import type { Organization } from "@/lib/organization-types";

type OrganizationListProps = {
  onSelectOrganization?: (organization: Organization) => void;
  onManageOrganization?: (organization: Organization) => void;
  showActions?: boolean;
};

export function OrganizationList({
  onSelectOrganization,
  onManageOrganization,
  showActions = true,
}: OrganizationListProps) {
  const { data: organizations = [], isLoading } = useOrganizations();
  const { data: activeOrganization } = useActiveOrganization();
  const setActiveOrganization = useSetActiveOrganization();

  const handleSelectOrganization = (organization: Organization) => {
    if (onSelectOrganization) {
      onSelectOrganization(organization);
    } else {
      setActiveOrganization.mutate(organization.id);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, _i) => (
          <Card key={`skeleton-${crypto.randomUUID()}`}>
            <CardHeader>
              <div className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-16" />
                <div className="flex space-x-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!organizations.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Building2 className="mb-4 h-12 w-12 text-muted-foreground" />
          <CardTitle className="mb-2 text-lg">No Organizations Found</CardTitle>
          <CardDescription className="mb-4 text-center">
            You're not a member of any organizations yet. Create one or ask to
            be invited.
          </CardDescription>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {organizations.map((organization) => (
        <Card key={organization.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  {organization.logo ? (
                    <img
                      alt={organization.name}
                      className="h-12 w-12 rounded-lg object-cover"
                      height={48}
                      src={organization.logo}
                      width={48}
                    />
                  ) : (
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-lg">{organization.name}</CardTitle>
                  <CardDescription>@{organization.slug}</CardDescription>
                </div>
              </div>
              {activeOrganization?.id === organization.id && (
                <Badge
                  className="flex items-center space-x-1"
                  variant="secondary"
                >
                  <Crown className="h-3 w-3" />
                  <span>Active</span>
                </Badge>
              )}
            </div>
          </CardHeader>
          {showActions && (
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 text-muted-foreground text-sm">
                  <div className="flex items-center space-x-1">
                    <Users className="h-4 w-4" />
                    <span>Members</span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  {activeOrganization?.id !== organization.id && (
                    <Button
                      disabled={setActiveOrganization.isPending}
                      onClick={() => handleSelectOrganization(organization)}
                      size="sm"
                      variant="outline"
                    >
                      {setActiveOrganization.isPending
                        ? "Switching..."
                        : "Switch To"}
                    </Button>
                  )}
                  {onManageOrganization && (
                    <Button
                      onClick={() => onManageOrganization(organization)}
                      size="sm"
                      variant="ghost"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
