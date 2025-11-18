import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import type {
  CreateOrganizationData,
  CreateTeamData,
  InviteMemberData,
  Organization,
  OrganizationInvitation,
  OrganizationMember,
  Team,
  TeamMember,
  UpdateMemberRoleData,
  UpdateOrganizationData,
} from "@/lib/organization-types";

// Organization queries
export function useOrganizations() {
  return useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const response = await authClient.organization.list();
      if (!response.data) {
        throw new Error("Failed to fetch organizations");
      }
      return response.data as Organization[];
    },
  });
}

export function useActiveOrganization() {
  return useQuery({
    queryKey: ["activeOrganization"],
    queryFn: async () => {
      const response = await authClient.organization.getFullOrganization();
      return response.data as Organization | null;
    },
  });
}

export function useOrganizationMembers(organizationId?: string) {
  return useQuery({
    queryKey: ["organizationMembers", organizationId],
    queryFn: async () => {
      if (!organizationId) {
        return [];
      }
      const response = await authClient.organization.listMembers({
        query: {
          organizationId,
        },
      });
      if (!response.data) {
        throw new Error("Failed to fetch organization members");
      }
      // Handle the actual API response structure
      const apiData = response.data as Record<string, unknown>;
      return (
        (apiData.members as OrganizationMember[]) ||
        (apiData as unknown as OrganizationMember[])
      );
    },
    enabled: !!organizationId,
  });
}

export function useOrganizationInvitations(organizationId?: string) {
  return useQuery({
    queryKey: ["organizationInvitations", organizationId],
    queryFn: async () => {
      if (!organizationId) {
        return [];
      }
      const response = await authClient.organization.listInvitations({
        query: {
          organizationId,
        },
      });
      if (!response.data) {
        throw new Error("Failed to fetch organization invitations");
      }
      // Map API response to our interface
      const apiData = response.data as Record<string, unknown>[];
      return apiData.map((inv) => ({
        ...inv,
        invitedBy: (inv.inviterId as string) || "",
        createdAt: (inv.createdAt as Date) || new Date(),
      })) as OrganizationInvitation[];
    },
    enabled: !!organizationId,
  });
}

export function useUserInvitations() {
  return useQuery({
    queryKey: ["userInvitations"],
    queryFn: async () => {
      // Use custom endpoint to get invitations for the current user
      const baseURL = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const response = await fetch(`${baseURL}/api/invitations/me`, {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch user invitations");
      }

      const data = await response.json();
      return data as OrganizationInvitation[];
    },
  });
}

export function useTeams(organizationId?: string) {
  return useQuery({
    queryKey: ["teams", organizationId],
    queryFn: async () => {
      if (!organizationId) {
        return [];
      }
      const response = await authClient.organization.listTeams({
        query: {
          organizationId,
        },
      });
      if (!response.data) {
        throw new Error("Failed to fetch teams");
      }
      return response.data as Team[];
    },
    enabled: !!organizationId,
  });
}

export function useTeamMembers(teamId?: string) {
  return useQuery({
    queryKey: ["teamMembers", teamId],
    queryFn: async () => {
      if (!teamId) {
        return [];
      }
      const response = await authClient.organization.listTeamMembers({
        query: {
          teamId,
        },
      });
      if (!response.data) {
        throw new Error("Failed to fetch team members");
      }
      return response.data as TeamMember[];
    },
    enabled: !!teamId,
  });
}

// Organization mutations
export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateOrganizationData) => {
      const response = await authClient.organization.create({
        name: data.name,
        slug: data.slug,
        logo: data.logo,
      });
      if (!response.data) {
        throw new Error("Failed to create organization");
      }
      const orgData = response.data as Record<string, unknown>;
      return {
        ...orgData,
        updatedAt: (orgData.updatedAt as Date) || (orgData.createdAt as Date),
      } as Organization;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast.success(`Organization "${data.name}" created successfully`);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to create organization"
      );
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      data,
    }: {
      organizationId: string;
      data: UpdateOrganizationData;
    }) => {
      const response = await authClient.organization.update({
        data,
        organizationId,
      });
      if (!response.data) {
        throw new Error("Failed to update organization");
      }
      const orgData = response.data as Record<string, unknown>;
      return {
        ...orgData,
        updatedAt: (orgData.updatedAt as Date) || (orgData.createdAt as Date),
      } as Organization;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["activeOrganization"] });
      toast.success("Organization updated successfully");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to update organization"
      );
    },
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (organizationId: string) => {
      const response = await authClient.organization.delete({
        organizationId,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["activeOrganization"] });
      toast.success("Organization deleted successfully");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete organization"
      );
    },
  });
}

export function useSetActiveOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (organizationId: string) => {
      const response = await authClient.organization.setActive({
        organizationId,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeOrganization"] });
      toast.success("Active organization changed");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to change active organization"
      );
    },
  });
}

// Member mutations
export function useInviteMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      data,
    }: {
      organizationId: string;
      data: InviteMemberData;
    }) => {
      const response = await authClient.organization.inviteMember({
        organizationId,
        email: data.email,
        role: data.role,
        teamId: data.teamId,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["organizationInvitations", variables.organizationId],
      });
      toast.success(`Invitation sent to ${variables.data.email}`);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to send invitation"
      );
    },
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      userId,
      data,
    }: {
      organizationId: string;
      userId: string;
      data: UpdateMemberRoleData;
    }) => {
      const response = await authClient.organization.updateMemberRole({
        organizationId,
        memberId: userId,
        role: data.role,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["organizationMembers", variables.organizationId],
      });
      toast.success("Member role updated successfully");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to update member role"
      );
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      userId,
    }: {
      organizationId: string;
      userId: string;
    }) => {
      const response = await authClient.organization.removeMember({
        memberIdOrEmail: userId,
        organizationId,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["organizationMembers", variables.organizationId],
      });
      toast.success("Member removed successfully");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove member"
      );
    },
  });
}

export function useLeaveOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (organizationId: string) => {
      const response = await authClient.organization.leave({
        organizationId,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["activeOrganization"] });
      toast.success("Left organization successfully");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to leave organization"
      );
    },
  });
}

// Invitation mutations
export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await authClient.organization.acceptInvitation({
        invitationId,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userInvitations"] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast.success("Invitation accepted successfully");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to accept invitation"
      );
    },
  });
}

export function useRejectInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await authClient.organization.rejectInvitation({
        invitationId,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userInvitations"] });
      toast.success("Invitation rejected");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to reject invitation"
      );
    },
  });
}

export function useCancelInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invitationId }: { invitationId: string }) => {
      const response = await authClient.organization.cancelInvitation({
        invitationId,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["organizationInvitations", variables.invitationId],
      });
      toast.success("Invitation cancelled");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel invitation"
      );
    },
  });
}

// Team mutations
export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ data }: { data: CreateTeamData }) => {
      const response = await authClient.organization.createTeam({
        name: data.name,
      });
      if (!response.data) {
        throw new Error("Failed to create team");
      }
      return response.data as Team;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["teams", data.id],
      });
      toast.success(`Team "${data.name}" created successfully`);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to create team"
      );
    },
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId }: { teamId: string }) => {
      const response = await authClient.organization.removeTeam({
        teamId,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["teams", variables.teamId],
      });
      queryClient.invalidateQueries({
        queryKey: ["teamMembers", variables.teamId],
      });
      toast.success("Team deleted successfully");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete team"
      );
    },
  });
}

export function useAddTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      userId,
    }: {
      teamId: string;
      userId: string;
    }) => {
      const response = await authClient.organization.addTeamMember({
        teamId,
        userId,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["teamMembers", variables.teamId],
      });
      toast.success("Member added to team successfully");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to add team member"
      );
    },
  });
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      userId,
    }: {
      teamId: string;
      userId: string;
    }) => {
      const response = await authClient.organization.removeTeamMember({
        teamId,
        userId,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["teamMembers", variables.teamId],
      });
      toast.success("Member removed from team successfully");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove team member"
      );
    },
  });
}
