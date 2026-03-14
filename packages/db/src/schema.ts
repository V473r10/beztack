import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  // Subscription cache (denormalized, updated by webhooks)
  subscriptionTier: text("subscription_tier"),
  subscriptionStatus: text("subscription_status"),
  subscriptionId: text("subscription_id"),
  subscriptionValidUntil: timestamp("subscription_valid_until"),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  impersonatedBy: text("impersonated_by"),
  activeOrganizationId: text("active_organization_id"),
  activeTeamId: text("active_team_id"),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const twoFactor = pgTable("two_factor", {
  id: text("id").primaryKey(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const team = pgTable("team", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const teamMember = pgTable("team_member", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => team.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at"),
});

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  logo: text("logo"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  metadata: text("metadata"),
  // Subscription cache (denormalized, updated by webhooks)
  subscriptionTier: text("subscription_tier"),
  subscriptionStatus: text("subscription_status"),
  subscriptionId: text("subscription_id"),
  subscriptionValidUntil: timestamp("subscription_valid_until"),
  paymentCustomerId: text("payment_customer_id"),
  usageMetrics: text("usage_metrics"),
  // Role required to manage billing (default: "owner")
  billingManagedByRole: text("billing_managed_by_role").default("owner"),
});

export const member = pgTable("member", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text("role").default("member").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role"),
  teamId: text("team_id"),
  status: text("status").default("pending").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// =============================================================================
// Payment Tables (provider-agnostic)
// =============================================================================

export const plan = pgTable(
  "plan",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    providerPlanId: text("provider_plan_id"),
    canonicalTierId: text("canonical_tier_id").notNull(),
    displayName: text("display_name").notNull(),
    description: text("description"),
    features: jsonb("features").$type<string[]>(),
    limits: jsonb("limits").$type<Record<string, number>>(),
    permissions: jsonb("permissions").$type<string[]>(),
    price: numeric("price").notNull(),
    currency: text("currency").notNull(),
    interval: text("interval"),
    intervalCount: integer("interval_count").default(1),
    displayOrder: integer("display_order"),
    highlighted: boolean("highlighted").default(false),
    visible: boolean("visible").default(true),
    status: text("status").default("active"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("plan_provider_idx").on(table.provider),
    index("plan_tier_idx").on(table.canonicalTierId),
    index("plan_status_idx").on(table.status),
  ]
);

export const subscription = pgTable(
  "subscription",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    providerSubscriptionId: text("provider_subscription_id"),
    userId: text("user_id").references(() => user.id),
    organizationId: text("organization_id").references(() => organization.id),
    planId: text("plan_id").references(() => plan.id),
    status: text("status").notNull(),
    externalReference: text("external_reference"),
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("subscription_provider_idx").on(table.provider),
    index("subscription_user_idx").on(table.userId),
    index("subscription_org_idx").on(table.organizationId),
    index("subscription_plan_idx").on(table.planId),
    index("subscription_status_idx").on(table.status),
  ]
);

export const payment = pgTable(
  "payment",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    providerPaymentId: text("provider_payment_id"),
    userId: text("user_id").references(() => user.id),
    subscriptionId: text("subscription_id").references(() => subscription.id),
    status: text("status").notNull(),
    amount: numeric("amount").notNull(),
    currency: text("currency").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("payment_provider_idx").on(table.provider),
    index("payment_user_idx").on(table.userId),
    index("payment_subscription_idx").on(table.subscriptionId),
    index("payment_status_idx").on(table.status),
  ]
);

export const webhookLog = pgTable(
  "webhook_log",
  {
    id: serial("id").primaryKey(),
    provider: text("provider").notNull(),
    eventType: text("event_type"),
    resourceId: text("resource_id"),
    rawPayload: jsonb("raw_payload"),
    status: text("status"),
    errorMessage: text("error_message"),
    processedAt: timestamp("processed_at").defaultNow(),
  },
  (table) => [
    index("webhook_log_provider_idx").on(table.provider),
    index("webhook_log_event_type_idx").on(table.eventType),
    index("webhook_log_status_idx").on(table.status),
  ]
);

// Export schema object for Better Auth drizzle adapter
export const schema = {
  user,
  session,
  account,
  verification,
  twoFactor,
  team,
  teamMember,
  organization,
  member,
  invitation,
  plan,
  subscription,
  payment,
  webhookLog,
};
