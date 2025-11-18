import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

type ProfileData = {
  username: string;
  email: string;
};

type ProfileUpdateResult = {
  nameUpdated: boolean;
  emailChangeRequested: boolean;
};

export function useProfileMutation(currentEmail?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profileData: ProfileData): Promise<ProfileUpdateResult> => {
      // Handle name update
      const nameUpdateResult = await authClient.updateUser({
        name: profileData.username,
      });

      if (nameUpdateResult.error) {
        throw new Error(nameUpdateResult.error.message || "Failed to update profile");
      }

      // Handle email change separately if email has changed
      if (currentEmail !== profileData.email) {
        const emailChangeResult = await authClient.changeEmail({
          newEmail: profileData.email,
          callbackURL: "/settings",
        });

        if (emailChangeResult.error) {
          throw new Error(emailChangeResult.error.message || "Failed to change email");
        }

        toast.success("Profile updated! Please check your email to verify the new address.");
        return { nameUpdated: true, emailChangeRequested: true };
      }

      return { nameUpdated: true, emailChangeRequested: false };
    },
    onSuccess: (data) => {
      if (!data.emailChangeRequested) {
        toast.success("Profile settings saved!");
      }
      queryClient.invalidateQueries({ queryKey: ["user-session"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to save profile: ${error.message}`);
    },
  });
}
