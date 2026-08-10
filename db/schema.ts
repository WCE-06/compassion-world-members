import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  memberCode: text("member_code").notNull(),
  displayName: text("display_name").notNull(),
  memberRank: text("member_rank", { enum: ["STANDARD", "RESIDENT"] }),
  status: text("status", { enum: ["ACTIVE", "INACTIVE"] }).notNull().default("ACTIVE"),
  sourceSystem: text("source_system").notNull().default("LEGACY"),
  sourceCustomerId: text("source_customer_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("members_member_code_unique").on(table.memberCode)]);

export const identityLinks = sqliteTable("identity_links", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull().references(() => members.id),
  provider: text("provider", { enum: ["LINE"] }).notNull(),
  providerUserId: text("provider_user_id").notNull(),
  linkedAt: integer("linked_at", { mode: "timestamp_ms" }).notNull(),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
}, (table) => [
  uniqueIndex("identity_provider_user_unique").on(table.provider, table.providerUserId),
  index("identity_member_idx").on(table.memberId),
]);

export const reservations = sqliteTable("reservations", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull().references(() => members.id),
  studioId: text("studio_id").notNull(),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
  status: text("status", { enum: ["CONFIRMED", "CANCELLED", "COMPLETED"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("reservations_member_start_idx").on(table.memberId, table.startsAt)]);

export const studioSessions = sqliteTable("studio_sessions", {
  id: text("id").primaryKey(),
  reservationId: text("reservation_id").references(() => reservations.id),
  memberId: text("member_id").notNull().references(() => members.id),
  studioId: text("studio_id").notNull(),
  checkedInAt: integer("checked_in_at", { mode: "timestamp_ms" }),
  checkedOutAt: integer("checked_out_at", { mode: "timestamp_ms" }),
  scheduledEndsAt: integer("scheduled_ends_at", { mode: "timestamp_ms" }),
  planType: text("plan_type", { enum: ["STANDARD", "RESIDENT"] }),
  productCode: text("product_code"),
  unitPriceExcludingTax: integer("unit_price_excluding_tax"),
  taxRateBps: integer("tax_rate_bps"),
  totalExcludingTax: integer("total_excluding_tax"),
  taxAmount: integer("tax_amount"),
  totalIncludingTax: integer("total_including_tax"),
  status: text("status", { enum: ["RESERVED", "IN_USE", "COMPLETED", "CANCELLED"] }).notNull(),
  paymentStatus: text("payment_status", { enum: ["UNPAID", "PAID", "REFUNDED"] }).notNull().default("UNPAID"),
  paymentId: text("payment_id"),
  version: integer("version").notNull().default(1),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("sessions_member_status_idx").on(table.memberId, table.status)]);

export const posPaymentEvents = sqliteTable("pos_payment_events", {
  id: text("id").primaryKey(),
  idempotencyKey: text("idempotency_key").notNull(),
  sessionId: text("session_id").notNull().references(() => studioSessions.id),
  paymentId: text("payment_id").notNull(),
  source: text("source").notNull(),
  totalExcludingTax: integer("total_excluding_tax").notNull(),
  taxAmount: integer("tax_amount").notNull(),
  totalIncludingTax: integer("total_including_tax").notNull(),
  paidAt: integer("paid_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("pos_payment_events_idempotency_unique").on(table.idempotencyKey),
  uniqueIndex("pos_payment_events_payment_id_unique").on(table.paymentId),
  index("pos_payment_events_session_idx").on(table.sessionId),
]);
