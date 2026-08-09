import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  memberCode: text("member_code").notNull(),
  displayName: text("display_name").notNull(),
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
  status: text("status", { enum: ["RESERVED", "IN_USE", "COMPLETED", "CANCELLED"] }).notNull(),
  paymentStatus: text("payment_status", { enum: ["UNPAID", "PAID", "REFUNDED"] }).notNull().default("UNPAID"),
  paymentId: text("payment_id"),
  version: integer("version").notNull().default(1),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("sessions_member_status_idx").on(table.memberId, table.status)]);
