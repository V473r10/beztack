import { Loader2 } from "lucide-react";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAppForm } from "@/components/ui/tanstack-form";
import { useCreateOrganization } from "@/hooks/use-organizations";
import {
  type CreateOrganizationData,
  createOrganizationSchema,
  type Organization,
} from "@/lib/organization-types";

type CreateOrganizationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new organization, before the dialog closes. */
  onCreated?: (organization: Organization) => void;
  /** Replaces the default description, e.g. to say why an organization is needed. */
  description?: string;
};

export function CreateOrganizationDialog({
  open,
  onOpenChange,
  onCreated,
  description,
}: CreateOrganizationDialogProps) {
  const { t } = useTranslation();
  const createOrganization = useCreateOrganization();

  const form = useAppForm({
    validators: { onChange: createOrganizationSchema },
    defaultValues: {
      name: "",
      slug: "",
      logo: "",
    } as CreateOrganizationData,
    onSubmit: async ({ value }) => {
      try {
        const organization = await createOrganization.mutateAsync(value);
        onCreated?.(organization);
        onOpenChange(false);
        form.reset();
      } catch {
        // Error handling is done in the mutation
      }
    },
  });

  // Transform text to kebab-case
  const toKebabCase = useCallback((text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }, []);

  // Auto-generate slug from name in real-time
  const handleNameChange = useCallback(
    (name: string) => {
      form.setFieldValue("name", name);
      const slug = toKebabCase(name);
      form.setFieldValue("slug", slug);
    },
    [form, toKebabCase],
  );

  // Transform slug input to kebab-case
  const handleSlugChange = useCallback(
    (slug: string) => {
      const kebabSlug = toKebabCase(slug);
      form.setFieldValue("slug", kebabSlug);
    },
    [form, toKebabCase],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      e.stopPropagation();
      form.handleSubmit();
    },
    [form],
  );

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("organizations.createDialog.title")}</DialogTitle>
          <DialogDescription>
            {description ?? t("organizations.createDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <form.AppForm>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <form.AppField name="name">
              {(field) => (
                <field.FormItem>
                  <field.FormLabel>{t("organizations.createDialog.name")}</field.FormLabel>
                  <field.FormControl>
                    <Input
                      disabled={createOrganization.isPending}
                      onBlur={field.handleBlur}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder={t("organizations.createDialog.namePlaceholder")}
                      value={field.state.value}
                    />
                  </field.FormControl>
                  <field.FormMessage />
                </field.FormItem>
              )}
            </form.AppField>

            <form.AppField name="slug">
              {(field) => (
                <field.FormItem>
                  <field.FormLabel>{t("organizations.createDialog.slug")}</field.FormLabel>
                  <field.FormControl>
                    <Input
                      disabled={createOrganization.isPending}
                      onBlur={field.handleBlur}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      placeholder="organization-slug"
                      value={field.state.value}
                    />
                  </field.FormControl>
                  <field.FormDescription>
                    {t("organizations.createDialog.slugHelp")}
                  </field.FormDescription>
                  <field.FormMessage />
                </field.FormItem>
              )}
            </form.AppField>

            <form.AppField name="logo">
              {(field) => (
                <field.FormItem>
                  <field.FormLabel>{t("organizations.createDialog.logo")}</field.FormLabel>
                  <field.FormControl>
                    <Input
                      disabled={createOrganization.isPending}
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

            <DialogFooter>
              <Button
                disabled={createOrganization.isPending}
                onClick={() => onOpenChange(false)}
                type="button"
                variant="outline"
              >
                {t("organizations.createDialog.cancel")}
              </Button>
              <Button disabled={createOrganization.isPending} type="submit">
                {createOrganization.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("organizations.createDialog.submit")}
              </Button>
            </DialogFooter>
          </form>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  );
}
