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
import { createOrganizationSchema, type CreateOrganizationData } from "@/lib/organization-types";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect } from "react";

interface CreateOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateOrganizationDialog({ 
  open, 
  onOpenChange 
}: CreateOrganizationDialogProps) {
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
        await createOrganization.mutateAsync(value);
        onOpenChange(false);
        form.reset();
      } catch (error) {
        // Error handling is done in the mutation
      }
    },
  });

  // Auto-generate slug from name
  const handleNameChange = useCallback((name: string) => {
    form.setFieldValue("name", name);
    if (name && !form.getFieldValue("slug")) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim();
      form.setFieldValue("slug", slug);
    }
  }, [form]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      e.stopPropagation();
      form.handleSubmit();
    },
    [form]
  );

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Organization</DialogTitle>
          <DialogDescription>
            Create a new organization to collaborate with your team.
          </DialogDescription>
        </DialogHeader>
        <form.AppForm>
          <form onSubmit={handleSubmit} className="space-y-4">
            <form.AppField name="name">
              {(field) => (
                <field.FormItem>
                  <field.FormLabel>Organization Name</field.FormLabel>
                  <field.FormControl>
                    <Input
                      placeholder="Enter organization name"
                      disabled={createOrganization.isPending}
                      value={field.state.value}
                      onChange={(e) => handleNameChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                  </field.FormControl>
                  <field.FormMessage />
                </field.FormItem>
              )}
            </form.AppField>

            <form.AppField name="slug">
              {(field) => (
                <field.FormItem>
                  <field.FormLabel>Organization Slug</field.FormLabel>
                  <field.FormControl>
                    <Input
                      placeholder="organization-slug"
                      disabled={createOrganization.isPending}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                  </field.FormControl>
                  <field.FormDescription>
                    This will be used in URLs. Only lowercase letters, numbers, and hyphens allowed.
                  </field.FormDescription>
                  <field.FormMessage />
                </field.FormItem>
              )}
            </form.AppField>

            <form.AppField name="logo">
              {(field) => (
                <field.FormItem>
                  <field.FormLabel>Logo URL (Optional)</field.FormLabel>
                  <field.FormControl>
                    <Input
                      placeholder="https://example.com/logo.png"
                      type="url"
                      disabled={createOrganization.isPending}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                  </field.FormControl>
                  <field.FormMessage />
                </field.FormItem>
              )}
            </form.AppField>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createOrganization.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createOrganization.isPending}
              >
                {createOrganization.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Organization
              </Button>
            </DialogFooter>
          </form>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  );
}