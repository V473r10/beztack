import { z } from "zod";

// Organization types based on Better Auth organization plugin
export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  email: string;
  role: string;
  createdAt: Date;
  invitedBy: string;
  user?: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
}

export interface OrganizationInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  expiresAt: Date;
  invitedBy: string;
  createdAt: Date;
  organization?: Organization;
}

export interface Team {
  id: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  createdAt: Date;
  user?: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
}

// Validation schemas
export const createOrganizationSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters"),
  slug: z.string()
    .min(2, "Slug must be at least 2 characters")
    .max(50, "Slug must be less than 50 characters")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  logo: z.string().url().optional().or(z.literal("")),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters").optional(),
  logo: z.string().url().optional().or(z.literal("")),
});

export const inviteMemberSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: z.string().min(1, "Please select a role"),
  teamId: z.string().optional(),
});

export const updateMemberRoleSchema = z.object({
  role: z.string().min(1, "Please select a role"),
});

export const createTeamSchema = z.object({
  name: z.string().min(2, "Team name must be at least 2 characters"),
});

// Form types
export type CreateOrganizationData = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationData = z.infer<typeof updateOrganizationSchema>;
export type InviteMemberData = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleData = z.infer<typeof updateMemberRoleSchema>;
export type CreateTeamData = z.infer<typeof createTeamSchema>;

// Organization role types
export const ORGANIZATION_ROLES = {
  owner: "owner",
  admin: "admin",
  member: "member",
} as const;

export type OrganizationRole = keyof typeof ORGANIZATION_ROLES;

export const ROLE_LABELS: Record<OrganizationRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export const ROLE_DESCRIPTIONS: Record<OrganizationRole, string> = {
  owner: "Full access to organization settings and members",
  admin: "Can manage members and organization settings",
  member: "Basic access to organization resources",
};