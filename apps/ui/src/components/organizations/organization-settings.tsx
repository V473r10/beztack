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
import {
  useUpdateOrganization,
  useDeleteOrganization,
  useLeaveOrganization,
} from "@/hooks/use-organizations";
import { updateOrganizationSchema, type UpdateOrganizationData, type Organization } from "@/lib/organization-types";
import { Loader2, Trash2, LogOut, AlertTriangle } from "lucide-react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { Badge } from "@/components/ui/badge";

interface OrganizationSettingsProps {
  organization: Organization;
  userRole?: string;
  canEdit?: boolean;
  canDelete?: boolean;
}

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
      } catch (error) {
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
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  const handleLeaveOrganization = async () => {
    try {
      await leaveOrganization.mutateAsync(organization.id);
      navigate("/");
    } catch (error) {
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
          <Badge variant={isOwner ? "default" : "secondary"}>
            {userRole}
          </Badge>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <form.AppForm>
              <form onSubmit={handleSubmit} className="space-y-4">
                <form.AppField name="name">
                  {(field) => (
                    <field.FormItem>
                      <field.FormLabel>Organization Name</field.FormLabel>
                      <field.FormControl>
                        <Input
                          disabled={updateOrganization.isPending}
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
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
                          type="url"
                          placeholder="https://example.com/logo.png"
                          disabled={updateOrganization.isPending}
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                        />
                      </field.FormControl>
                      <field.FormMessage />
                    </field.FormItem>
                  )}
                </form.AppField>

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={updateOrganization.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateOrganization.isPending}
                  >
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
                  <label className="text-sm font-medium">Name</label>
                  <p className="text-sm text-muted-foreground">{organization.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Slug</label>
                  <p className="text-sm text-muted-foreground">@{organization.slug}</p>
                </div>
              </div>
              
              {organization.logo && (
                <div>
                  <label className="text-sm font-medium">Logo</label>
                  <div className="mt-2">
                    <img
                      src={organization.logo}
                      alt={organization.name}
                      className="h-16 w-16 rounded-lg object-cover"
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
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <h4 className="text-sm font-medium">Leave Organization</h4>
                <p className="text-sm text-muted-foreground">
                  You will lose access to all organization resources.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
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
                      Are you sure you want to leave "{organization.name}"? You will lose access to all
                      organization resources and will need to be invited again to rejoin.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleLeaveOrganization}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={leaveOrganization.isPending}
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
            <div className="flex items-center justify-between p-4 border border-destructive rounded-lg bg-destructive/5">
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-destructive">Delete Organization</h4>
                <p className="text-sm text-muted-foreground">
                  Permanently delete this organization and all its data. This action cannot be undone.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
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
                      This action cannot be undone. This will permanently delete the "{organization.name}"
                      organization and remove all of its members, teams, and data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteOrganization}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={deleteOrganization.isPending}
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