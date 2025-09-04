import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
					id: text('id').primaryKey(),
					name: text('name').notNull(),
 email: text('email').notNull().unique(),
 emailVerified: boolean('email_verified').$defaultFn(() => !1).notNull(),
 image: text('image'),
 createdAt: timestamp('created_at').$defaultFn(() => new Date).notNull(),
 updatedAt: timestamp('updated_at').$defaultFn(() => new Date).notNull(),
 twoFactorEnabled: boolean('two_factor_enabled'),
 // Admin plugin fields
 role: text('role').$defaultFn(() => 'user'),
 banned: boolean('banned').$defaultFn(() => false),
 banReason: text('ban_reason'),
 banExpires: timestamp('ban_expires'),
 // Polar subscription fields for individual users
 subscriptionTier: text('subscription_tier').$defaultFn(() => 'free'),
 subscriptionStatus: text('subscription_status').$defaultFn(() => 'inactive'),
 subscriptionId: text('subscription_id'),
 polarCustomerId: text('polar_customer_id'),
 subscriptionValidUntil: timestamp('subscription_valid_until')
				});

export const session = pgTable("session", {
					id: text('id').primaryKey(),
					expiresAt: timestamp('expires_at').notNull(),
 token: text('token').notNull().unique(),
 createdAt: timestamp('created_at').notNull(),
 updatedAt: timestamp('updated_at').notNull(),
 ipAddress: text('ip_address'),
 userAgent: text('user_agent'),
 userId: text('user_id').notNull().references(()=> user.id, { onDelete: 'cascade' }),
 // Admin plugin field
 impersonatedBy: text('impersonated_by'),
 // Organization plugin fields
 activeOrganizationId: text('active_organization_id'),
 activeTeamId: text('active_team_id')
				});

export const account = pgTable("account", {
					id: text('id').primaryKey(),
					accountId: text('account_id').notNull(),
 providerId: text('provider_id').notNull(),
 userId: text('user_id').notNull().references(()=> user.id, { onDelete: 'cascade' }),
 accessToken: text('access_token'),
 refreshToken: text('refresh_token'),
 idToken: text('id_token'),
 accessTokenExpiresAt: timestamp('access_token_expires_at'),
 refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
 scope: text('scope'),
 password: text('password'),
 createdAt: timestamp('created_at').notNull(),
 updatedAt: timestamp('updated_at').notNull()
				});

export const verification = pgTable("verification", {
					id: text('id').primaryKey(),
					identifier: text('identifier').notNull(),
 value: text('value').notNull(),
 expiresAt: timestamp('expires_at').notNull(),
 createdAt: timestamp('created_at').$defaultFn(() => new Date),
 updatedAt: timestamp('updated_at').$defaultFn(() => new Date)
				});

export const twoFactor = pgTable("two_factor", {
					id: text('id').primaryKey(),
					secret: text('secret').notNull(),
 backupCodes: text('backup_codes').notNull(),
 userId: text('user_id').notNull().references(()=> user.id, { onDelete: 'cascade' })
				});

// Organization plugin tables
export const organization = pgTable("organization", {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo: text('logo'),
  metadata: text('metadata'),
  // Polar subscription fields
  subscriptionTier: text('subscription_tier').$defaultFn(() => 'free'),
  subscriptionStatus: text('subscription_status').$defaultFn(() => 'inactive'),
  subscriptionId: text('subscription_id'),
  polarCustomerId: text('polar_customer_id'),
  subscriptionValidUntil: timestamp('subscription_valid_until'),
  usageMetrics: text('usage_metrics'), // JSON field for usage tracking
  createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull()
});

export const member = pgTable("member", {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull()
});

export const invitation = pgTable("invitation", {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  inviterId: text('inviter_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  status: text('status').notNull().$defaultFn(() => 'pending'),
  expiresAt: timestamp('expires_at').notNull(),
  teamId: text('team_id').references(() => team.id, { onDelete: 'cascade' }), // Optional, for team invitations
  createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull()
});

export const team = pgTable("team", {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull()
});

export const teamMember = pgTable("team_member", {
  id: text('id').primaryKey(),
  teamId: text('team_id').notNull().references(() => team.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull()
});

export const schema = {
  user,
  session,
  account,
  verification,
  twoFactor,
  organization,
  member,
  invitation,
  team,
  teamMember
};
