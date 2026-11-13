import { AlertTriangle, Loader2, LogOut, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  roleLabel,
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
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();

  const updateOrganization = useUpdateOrganization();
  const deleteOrganization = useDeleteOrganization();
  const leaveOrganization = useLeaveOrganization();

  const form = useAppForm({
    validators: { onChange: updateOrganizationSchema(t) },
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
      } catch {
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
    [form],
  );

  const handleCancel = () => {
    form.reset();
    setIsEditing(false);
  };

  const handleDeleteOrganization = async () => {
    try {
      await deleteOrganization.mutateAsync(organization.id);
      navigate("/");
    } catch {
      // Error handling is done in the mutation
    }
  };

  const handleLeaveOrganization = async () => {
    try {
      await leaveOrganization.mutateAsync(organization.id);
      navigate("/");
    } catch {
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
            <CardTitle>{t("organizations.settings.detailsTitle")}</CardTitle>
            <CardDescription>{t("organizations.settings.detailsDescription")}</CardDescription>
          </div>
          <Badge variant={isOwner ? "default" : "secondary"}>{roleLabel(t, userRole)}</Badge>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <form.AppForm>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <form.AppField name="name">
                  {(field) => (
                    <field.FormItem>
                      <field.FormLabel>{t("organizations.createDialog.name")}</field.FormLabel>
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
                      <field.FormLabel>{t("organizations.settings.logoUrl")}</field.FormLabel>
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
                    {t("common.cancel")}
                  </Button>
                  <Button disabled={updateOrganization.isPending} type="submit">
                    {updateOrganization.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {t("organizations.settings.save")}
                  </Button>
                </div>
              </form>
            </form.AppForm>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="font-medium text-sm">{t("organizations.settings.name")}</div>
                  <p className="text-muted-foreground text-sm">{organization.name}</p>
                </div>
                <div>
                  <div className="font-medium text-sm">{t("organizations.settings.slug")}</div>
                  <p className="text-muted-foreground text-sm">@{organization.slug}</p>
                </div>
              </div>

              {organization.logo && (
                <div>
                  <div className="font-medium text-sm">{t("organizations.settings.logo")}</div>
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
                    {t("organizations.settings.edit")}
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
          <CardTitle className="text-destructive">
            {t("organizations.settings.dangerTitle")}
          </CardTitle>
          <CardDescription>{t("organizations.settings.dangerDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Leave Organization */}
          {!isOwner && (
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <h4 className="font-medium text-sm">{t("organizations.settings.leaveTitle")}</h4>
                <p className="text-muted-foreground text-sm">
                  {t("organizations.settings.leaveDescription")}
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <LogOut className="mr-2 h-4 w-4" />
                    {t("organizations.settings.leaveButton")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center space-x-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      <span>{t("organizations.settings.leaveTitle")}</span>
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("organizations.settings.leaveConfirm", { name: organization.name })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={leaveOrganization.isPending}
                      onClick={handleLeaveOrganization}
                    >
                      {leaveOrganization.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {t("organizations.settings.leaveTitle")}
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
                  {t("organizations.settings.deleteTitle")}
                </h4>
                <p className="text-muted-foreground text-sm">
                  {t("organizations.settings.deleteDescription")}
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("organizations.settings.deleteButton")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center space-x-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      <span>{t("organizations.settings.deleteTitle")}</span>
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("organizations.settings.deleteConfirm", { name: organization.name })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={deleteOrganization.isPending}
                      onClick={handleDeleteOrganization}
                    >
                      {deleteOrganization.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {t("organizations.settings.deleteTitle")}
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
