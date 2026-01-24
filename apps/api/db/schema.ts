import {
  boolean,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
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

export const plan = pgTable("plan", {
  id: text("id").primaryKey(),
});

export const feature = pgTable("feature", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
});

export const permission = pgTable("permission", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
});

export const limit = pgTable("limit", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
});

export const planFeature = pgTable("plan_feature", {
  id: serial("id").primaryKey(),
  planId: uuid("plan_id").notNull(),
  featureId: integer("feature_id")
    .notNull()
    .references(() => feature.id, { onDelete: "cascade" }),
});

export const planPermission = pgTable("plan_permission", {
  id: serial("id").primaryKey(),
  planId: uuid("plan_id").notNull(),
  permissionId: integer("permission_id")
    .notNull()
    .references(() => permission.id, { onDelete: "cascade" }),
});

export const planLimit = pgTable("plan_limit", {
  id: serial("id").primaryKey(),
  planId: uuid("plan_id").notNull(),
  limitId: integer("limit_id")
    .notNull()
    .references(() => limit.id, { onDelete: "cascade" }),
  value: integer("value").notNull(),
});

// =============================================================================
// Mercado Pago Tables
// =============================================================================

export const mpOrder = pgTable("mp_order", {
  id: text("id").primaryKey(),
  preferenceId: text("preference_id"),
  applicationId: text("application_id"),
  externalReference: text("external_reference"),
  status: text("status").notNull(),
  orderStatus: text("order_status"),
  siteId: text("site_id"),
  payerId: text("payer_id"),
  collectorId: text("collector_id"),
  paidAmount: numeric("paid_amount"),
  refundedAmount: numeric("refunded_amount"),
  shippingCost: numeric("shipping_cost"),
  totalAmount: numeric("total_amount"),
  cancelled: boolean("cancelled").default(false),
  notificationUrl: text("notification_url"),
  additionalInfo: text("additional_info"),
  isTest: boolean("is_test").default(false),
  dateCreated: timestamp("date_created"),
  lastUpdated: timestamp("last_updated"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const mpPayment = pgTable("mp_payment", {
  id: text("id").primaryKey(),
  // Vinculacion con la app
  beztackUserId: text("beztack_user_id").references(() => user.id),
  // Relacion con MP (sin FK porque el order puede no existir en nuestra DB)
  orderId: text("order_id"),
  externalReference: text("external_reference"),
  // Estado
  status: text("status").notNull(),
  statusDetail: text("status_detail"),
  operationType: text("operation_type"),
  // Metodo de pago
  paymentMethodId: text("payment_method_id"),
  paymentTypeId: text("payment_type_id"),
  issuerId: text("issuer_id"),
  // Montos
  transactionAmount: numeric("transaction_amount"),
  transactionAmountRefunded: numeric("transaction_amount_refunded"),
  netReceivedAmount: numeric("net_received_amount"),
  currencyId: text("currency_id"),
  installments: integer("installments"),
  // Pagador
  payerId: text("payer_id"),
  payerEmail: text("payer_email"),
  // Receptor
  collectorId: text("collector_id"),
  // Info adicional
  description: text("description"),
  statementDescriptor: text("statement_descriptor"),
  cardFirstSixDigits: text("card_first_six_digits"),
  cardLastFourDigits: text("card_last_four_digits"),
  liveMode: boolean("live_mode"),
  // Fechas MP
  dateCreated: timestamp("date_created"),
  dateApproved: timestamp("date_approved"),
  dateLastUpdated: timestamp("date_last_updated"),
  moneyReleaseDate: timestamp("money_release_date"),
  // Auditoria local
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const mpSubscription = pgTable("mp_subscription", {
  id: text("id").primaryKey(),
  beztackUserId: text("beztack_user_id").references(() => user.id),
  preapprovalPlanId: text("preapproval_plan_id"),
  externalReference: text("external_reference"),
  payerId: text("payer_id"),
  payerEmail: text("payer_email"),
  collectorId: text("collector_id"),
  applicationId: text("application_id"),
  status: text("status").notNull(),
  reason: text("reason"),
  initPoint: text("init_point"),
  backUrl: text("back_url"),
  // Auto recurring
  frequency: integer("frequency"),
  frequencyType: text("frequency_type"),
  transactionAmount: numeric("transaction_amount"),
  currencyId: text("currency_id"),
  // Summarized info
  chargedQuantity: integer("charged_quantity"),
  chargedAmount: numeric("charged_amount"),
  pendingChargeAmount: numeric("pending_charge_amount"),
  // Proximo cobro
  nextPaymentDate: timestamp("next_payment_date"),
  paymentMethodId: text("payment_method_id"),
  // Fechas MP
  dateCreated: timestamp("date_created"),
  lastModified: timestamp("last_modified"),
  // Auditoria local
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const mpInvoice = pgTable("mp_invoice", {
  id: text("id").primaryKey(),
  subscriptionId: text("subscription_id").references(() => mpSubscription.id),
  paymentId: text("payment_id"),
  externalReference: text("external_reference"),
  status: text("status").notNull(),
  reason: text("reason"),
  transactionAmount: numeric("transaction_amount"),
  currencyId: text("currency_id"),
  payerId: text("payer_id"),
  type: text("type"),
  retryAttempt: integer("retry_attempt"),
  debitDate: timestamp("debit_date"),
  dateCreated: timestamp("date_created"),
  lastModified: timestamp("last_modified"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const mpRefund = pgTable("mp_refund", {
  id: text("id").primaryKey(),
  paymentId: text("payment_id")
    .notNull()
    .references(() => mpPayment.id),
  amount: numeric("amount"),
  amountRefundedToPayer: numeric("amount_refunded_to_payer"),
  adjustmentAmount: numeric("adjustment_amount"),
  status: text("status"),
  reason: text("reason"),
  refundMode: text("refund_mode"),
  sourceId: text("source_id"),
  sourceName: text("source_name"),
  sourceType: text("source_type"),
  uniqueSequenceNumber: text("unique_sequence_number"),
  dateCreated: timestamp("date_created"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mpChargeback = pgTable("mp_chargeback", {
  id: text("id").primaryKey(),
  paymentId: text("payment_id").references(() => mpPayment.id),
  // Montos
  amount: numeric("amount"),
  coverageApplied: boolean("coverage_applied"),
  coverageEligible: boolean("coverage_eligible"),
  // Estado del proceso
  status: text("status").notNull(),
  stage: text("stage"),
  // Razon
  reason: text("reason"),
  reasonDetail: text("reason_detail"),
  // Documentacion
  documentationRequired: boolean("documentation_required"),
  documentationStatus: text("documentation_status"),
  // Resolucion
  resolution: text("resolution"),
  // Fechas
  dateCreated: timestamp("date_created"),
  dateLastUpdated: timestamp("date_last_updated"),
  dateDocumentationDeadline: timestamp("date_documentation_deadline"),
  // Auditoria
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const mpWebhookLog = pgTable("mp_webhook_log", {
  id: serial("id").primaryKey(),
  webhookId: text("webhook_id"),
  type: text("type").notNull(),
  action: text("action"),
  resourceId: text("resource_id"),
  liveMode: boolean("live_mode"),
  mpUserId: text("mp_user_id"),
  apiVersion: text("api_version"),
  rawPayload: text("raw_payload"),
  status: text("status").default("received").notNull(),
  errorMessage: text("error_message"),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
});

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
  feature,
  permission,
  limit,
  planFeature,
  planPermission,
  planLimit,
  mpOrder,
  mpPayment,
  mpSubscription,
  mpInvoice,
  mpRefund,
  mpChargeback,
  mpWebhookLog,
};
