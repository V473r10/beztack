import { AlertTriangle, Loader2, LogOut, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
// import { Separator } from "@/components/ui/separator";
import { useAppForm } from "@/components/ui/tanstack-form";
import {
  useDeleteOrganization,
  useLeaveOrganization,
  useUpdateOrganization,
} from "@/hooks/use-organizations";
import {
  type Organization,
  type UpdateOrganizationData,
  updateOrganizationSchema,
} from "@/lib/organization-types";

type OrganizationSettingsProps = {
  organization: Organization;
  userRole?: string;
  canEdit?: boolean;
  canDelete?: boolean;
};

export function OrganizationSettings({
  organization,
  userRole = "member",
  canEdit = false,
  canDelete = false,
}: OrganizationSettingsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();

  const updateOrganization = useUpdateOrganization();
  const deleteOrganization = useDeleteOrganization();
  const leaveOrganization = useLeaveOrganization();

  const form = useAppForm({
    validators: { onChange: updateOrganizationSchema },
    defaultValues: {
      name: organization.name,
      logo: organization.logo || "",
    } as UpdateOrganizationData,
    onSubmit: async ({ value }) => {
      try {
        await updateOrganization.mutateAsync({
          organizationId: organization.id,
          data: value,
        });
        setIsEditing(false);
      } catch (_error) {
        // Error handling is done in the mutation
      }
    },
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      e.stopPropagation();
      form.handleSubmit();
    },
    [form]
  );

  const handleCancel = () => {
    form.reset();
    setIsEditing(false);
  };

  const handleDeleteOrganization = async () => {
    try {
      await deleteOrganization.mutateAsync(organization.id);
      navigate("/");
    } catch (_error) {
      // Error handling is done in the mutation
    }
  };

  const handleLeaveOrganization = async () => {
    try {
      await leaveOrganization.mutateAsync(organization.id);
      navigate("/");
    } catch (_error) {
      // Error handling is done in the mutation
    }
  };

  const isOwner = userRole === "owner";
  // const isAdmin = userRole === "admin" || isOwner;

  return (
    <div className="space-y-6">
      {/* Organization Details */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Organization Details</CardTitle>
            <CardDescription>
              Update your organization's basic information.
            </CardDescription>
          </div>
          <Badge variant={isOwner ? "default" : "secondary"}>{userRole}</Badge>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <form.AppForm>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <form.AppField name="name">
                  {(field) => (
                    <field.FormItem>
                      <field.FormLabel>Organization Name</field.FormLabel>
                      <field.FormControl>
                        <Input
                          disabled={updateOrganization.isPending}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          value={field.state.value}
                        />
                      </field.FormControl>
                      <field.FormMessage />
                    </field.FormItem>
                  )}
                </form.AppField>

                <form.AppField name="logo">
                  {(field) => (
                    <field.FormItem>
                      <field.FormLabel>Logo URL</field.FormLabel>
                      <field.FormControl>
                        <Input
                          disabled={updateOrganization.isPending}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="https://example.com/logo.png"
                          type="url"
                          value={field.state.value}
                        />
                      </field.FormControl>
                      <field.FormMessage />
                    </field.FormItem>
                  )}
                </form.AppField>

                <div className="flex justify-end space-x-2">
                  <Button
                    disabled={updateOrganization.isPending}
                    onClick={handleCancel}
                    type="button"
                    variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button disabled={updateOrganization.isPending} type="submit">
                    {updateOrganization.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </form>
            </form.AppForm>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="font-medium text-sm">Name</div>
                  <p className="text-muted-foreground text-sm">
                    {organization.name}
                  </p>
                </div>
                <div>
                  <div className="font-medium text-sm">Slug</div>
                  <p className="text-muted-foreground text-sm">
                    @{organization.slug}
                  </p>
                </div>
              </div>

              {organization.logo && (
                <div>
                  <div className="font-medium text-sm">Logo</div>
                  <div className="mt-2">
                    <img
                      alt={organization.name}
                      className="h-16 w-16 rounded-lg object-cover"
                      height={64}
                      src={organization.logo}
                      width={64}
                    />
                  </div>
                </div>
              )}

              {canEdit && (
                <div className="flex justify-end">
                  <Button onClick={() => setIsEditing(true)}>
                    Edit Organization
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible and destructive actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Leave Organization */}
          {!isOwner && (
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <h4 className="font-medium text-sm">Leave Organization</h4>
                <p className="text-muted-foreground text-sm">
                  You will lose access to all organization resources.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <LogOut className="mr-2 h-4 w-4" />
                    Leave
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center space-x-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      <span>Leave Organization</span>
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to leave "{organization.name}"? You
                      will lose access to all organization resources and will
                      need to be invited again to rejoin.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={leaveOrganization.isPending}
                      onClick={handleLeaveOrganization}
                    >
                      {leaveOrganization.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Leave Organization
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {/* Delete Organization */}
          {canDelete && isOwner && (
            <div className="flex items-center justify-between rounded-lg border border-destructive bg-destructive/5 p-4">
              <div className="space-y-1">
                <h4 className="font-medium text-destructive text-sm">
                  Delete Organization
                </h4>
                <p className="text-muted-foreground text-sm">
                  Permanently delete this organization and all its data. This
                  action cannot be undone.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center space-x-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      <span>Delete Organization</span>
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      the "{organization.name}" organization and remove all of
                      its members, teams, and data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={deleteOrganization.isPending}
                      onClick={handleDeleteOrganization}
                    >
                      {deleteOrganization.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Delete Organization
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
