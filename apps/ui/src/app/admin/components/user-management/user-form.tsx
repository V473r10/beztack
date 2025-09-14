import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { AdminUser, CreateUserData } from "@/lib/admin-types";
import { authClient } from "@/lib/auth-client";

const userFormSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  name: z.string().min(1, "Name is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .optional(),
  role: z.string(),
  emailVerified: z.boolean(),
});

type UserFormData = z.infer<typeof userFormSchema>;

interface UserFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: AdminUser | null;
  onSuccess: () => void;
}

export function UserForm({
  open,
  onOpenChange,
  user,
  onSuccess,
}: UserFormProps) {
  const isEditing = !!user;

  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: user?.email || "",
      name: user?.name || user?.email?.split("@")[0] || "",
      password: "",
      role: user?.role || "user",
      emailVerified: user?.emailVerified,
    },
  });

  // Reset form when user changes
  React.useEffect(() => {
    if (user) {
      form.reset({
        email: user.email,
        name: user.name || "",
        password: "",
        role: user.role || "user",
        emailVerified: user.emailVerified,
      });
    } else {
      form.reset({
        email: "",
        name: "",
        password: "",
        role: "user",
        emailVerified: false,
      });
    }
  }, [user, form]);

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserData) => {
      const response = await authClient.admin.createUser(data);
      if (!response.data) {
        throw new Error("Failed to create user");
      }
      return response.data;
    },
    onSuccess: () => {
      toast.success("User created successfully");
      onSuccess();
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      toast.error("Failed to create user: " + error.message);
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (data: Partial<AdminUser>) => {
      if (!user) throw new Error("No user to update");

      const response = await authClient.admin.updateUser({
        userId: user.id,
        data,
      });
      if (!response.data) {
        throw new Error("Failed to update user");
      }
      return response.data;
    },
    onSuccess: () => {
      toast.success("User updated successfully");
      onSuccess();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to update user: " + error.message);
    },
  });

  const onSubmit = (data: UserFormData) => {
    if (isEditing) {
      // For editing, only send changed fields
      const updates: Partial<AdminUser> = {};
      if (data.email !== user.email) updates.email = data.email;
      if (data.name !== user.name) updates.name = data.name;
      if (data.role !== user.role) updates.role = data.role;
      if (data.emailVerified !== user.emailVerified)
        updates.emailVerified = data.emailVerified;

      updateUserMutation.mutate(updates);
    } else {
      // For creating, send all required fields
      const createData = {
        email: data.email,
        password: data.password!,
        name: data.name || data.email.split("@")[0],
        role: data.role as "user" | "admin",
      };

      createUserMutation.mutate(createData);
    }
  };

  const isLoading =
    createUserMutation.isPending || updateUserMutation.isPending;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit User" : "Create New User"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update user information and settings."
              : "Add a new user to the system."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="user@example.com"
                      {...field}
                      disabled={isEditing} // Don't allow email changes when editing
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Full name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isEditing && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Minimum 8 characters"
                        type="password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select
                    defaultValue={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="emailVerified"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Email Verified</FormLabel>
                    <FormDescription>
                      Mark the user's email as verified
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                disabled={isLoading}
                onClick={() => onOpenChange(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={isLoading} type="submit">
                {isLoading
                  ? isEditing
                    ? "Updating..."
                    : "Creating..."
                  : isEditing
                    ? "Update User"
                    : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
