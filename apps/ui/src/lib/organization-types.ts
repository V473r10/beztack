import type { TFunction } from "i18next";
import { z } from "zod";

// Constants for validation
const MIN_LENGTH = 2;
const MAX_SLUG_LENGTH = 50;

// Organization types based on Better Auth organization plugin
export type Organization = {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type OrganizationMember = {
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
};

export type OrganizationInvitation = {
  id: string;
  organizationId: string;
  email: string;
  role: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  expiresAt: Date;
  invitedBy: string;
  createdAt: Date;
  organization?: Organization;
};

export type Team = {
  id: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TeamMember = {
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
};

// Validation schemas. Messages are written in the language the user chose, so each schema is
// built where it is used, with that component's `t`.
export const createOrganizationSchema = (t: TFunction) =>
  z.object({
    name: z.string().min(MIN_LENGTH, t("organizations.validation.nameLength")),
    slug: z
      .string()
      .min(MIN_LENGTH, t("organizations.validation.slugMin"))
      .max(MAX_SLUG_LENGTH, t("organizations.validation.slugMax"))
      .regex(/^[a-z0-9-]+$/, t("organizations.validation.slugFormat")),
    logo: z.string().url().optional().or(z.literal("")),
  });

export const updateOrganizationSchema = (t: TFunction) =>
  z.object({
    name: z.string().min(MIN_LENGTH, t("organizations.validation.nameLength")).optional(),
    logo: z.string().url().optional().or(z.literal("")),
  });

export const inviteMemberSchema = (t: TFunction) =>
  z.object({
    email: z.string().email(t("organizations.validation.email")),
    role: z.enum(["admin", "member", "owner"], {
      message: t("organizations.validation.role"),
    }),
    teamId: z.string().optional(),
  });

export const updateMemberRoleSchema = (t: TFunction) =>
  z.object({
    role: z.enum(["admin", "member", "owner"], {
      message: t("organizations.validation.role"),
    }),
  });

export const createTeamSchema = (t: TFunction) =>
  z.object({
    name: z.string().min(MIN_LENGTH, t("organizations.validation.teamNameLength")),
  });

// Form types
export type CreateOrganizationData = z.infer<ReturnType<typeof createOrganizationSchema>>;
export type UpdateOrganizationData = z.infer<ReturnType<typeof updateOrganizationSchema>>;
export type InviteMemberData = z.infer<ReturnType<typeof inviteMemberSchema>>;
export type UpdateMemberRoleData = z.infer<ReturnType<typeof updateMemberRoleSchema>>;
export type CreateTeamData = z.infer<ReturnType<typeof createTeamSchema>>;

// Organization role types
export const ORGANIZATION_ROLES = {
  owner: "owner",
  admin: "admin",
  member: "member",
} as const;

export type OrganizationRole = keyof typeof ORGANIZATION_ROLES;

/** The role's name in the language the user chose; an unknown role is shown as it came. */
export function roleLabel(t: TFunction, role: string): string {
  return t(`organizations.roles.${role}`, { defaultValue: role });
}

/** What the role can do, in the language the user chose. */
export function roleDescription(t: TFunction, role: OrganizationRole): string {
  return t(`organizations.roleDescriptions.${role}`);
}
