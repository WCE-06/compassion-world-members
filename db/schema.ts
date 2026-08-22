import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  memberCode: text("member_code").notNull(),
  displayName: text("display_name").notNull(),
  displayNameKana: text("display_name_kana"),
  phone: text("phone"),
  email: text("email"),
  birthDate: text("birth_date"),
  gender: text("gender"),
  postalCode: text("postal_code"),
  prefecture: text("prefecture"),
  address: text("address"),
  pointsBalance: integer("points_balance").notNull().default(0),
  memberRank: text("member_rank", { enum: ["STANDARD", "RESIDENT"] }),
  status: text("status", { enum: ["ACTIVE", "INACTIVE"] }).notNull().default("ACTIVE"),
  sourceSystem: text("source_system").notNull().default("LEGACY"),
  sourceCustomerId: text("source_customer_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("members_member_code_unique").on(table.memberCode)]);

export const legacyMemberImports = sqliteTable("legacy_member_imports", {
  id: text("id").primaryKey(),
  lineUserId: text("line_user_id"),
  displayName: text("display_name"),
  displayNameKana: text("display_name_kana"),
  phone: text("phone"),
  email: text("email"),
  birthDate: text("birth_date"),
  gender: text("gender"),
  postalCode: text("postal_code"),
  prefecture: text("prefecture"),
  address: text("address"),
  sourceRegisteredAt: text("source_registered_at"),
  status: text("status", { enum: ["UNREGISTERED", "MIGRATED", "SKIPPED"] }).notNull().default("UNREGISTERED"),
  importedAt: integer("imported_at", { mode: "timestamp_ms" }).notNull(),
  migratedMemberId: text("migrated_member_id").references(() => members.id),
}, (table) => [
  uniqueIndex("legacy_import_line_user_unique").on(table.lineUserId),
  index("legacy_import_status_idx").on(table.status),
]);

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

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  orderNumber: text("order_number").notNull(),
  memberId: text("member_id").notNull().references(() => members.id),
  status: text("status", { enum: ["WAITING_STORE_PAYMENT", "PAID", "ACCEPTED", "COOKING", "READY", "PICKED_UP", "EXPIRED", "CANCELLED"] }).notNull(),
  paymentMethod: text("payment_method", { enum: ["STORE", "STRIPE"] }).notNull(),
  totalIncludingTax: integer("total_including_tax").notNull(),
  pickupAt: integer("pickup_at", { mode: "timestamp_ms" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("orders_order_number_unique").on(table.orderNumber),
  index("orders_member_created_idx").on(table.memberId, table.createdAt),
]);

export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  productId: text("product_id").notNull(),
  productCode: text("product_code").notNull(),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPriceIncludingTax: integer("unit_price_including_tax").notNull(),
  lineTotalIncludingTax: integer("line_total_including_tax").notNull(),
}, (table) => [index("order_items_order_idx").on(table.orderId)]);

export const catalogOverrides = sqliteTable("catalog_overrides", {
  productCode: text("product_code").primaryKey(),
  description: text("description").notNull().default(""),
  imageUrl: text("image_url").notNull().default(""),
  menuCategory: text("menu_category").notNull(),
  displaySequence: integer("display_sequence").notNull().default(9999),
  showOnSelfRegister: integer("show_on_self_register", { mode: "boolean" }).notNull().default(true),
  showOnMobileOrder: integer("show_on_mobile_order", { mode: "boolean" }).notNull().default(true),
  soldOut: integer("sold_out", { mode: "boolean" }).notNull().default(false),
  scheduleEnabled: integer("schedule_enabled", { mode: "boolean" }).notNull().default(false),
  scheduleStart: text("schedule_start").notNull().default("11:00"),
  scheduleEnd: text("schedule_end").notNull().default("20:00"),
  scheduleDays: text("schedule_days").notNull().default("1,2,3,4,5,6,7"),
  updatedBy: text("updated_by").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("catalog_overrides_category_sequence_idx").on(table.menuCategory, table.displaySequence)]);

export const storeHours = sqliteTable("store_hours", {
  id: text("id").primaryKey().default("AOZORA_KITCHEN"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  timezone: text("timezone").notNull().default("Asia/Tokyo"),
  openTime: text("open_time").notNull().default("11:00"),
  closeTime: text("close_time").notNull().default("20:00"),
  orderStart: text("order_start").notNull().default("11:00"),
  lastOrder: text("last_order").notNull().default("19:30"),
  businessDays: text("business_days").notNull().default("1,2,3,4,5,6,7"),
  lunchEnabled: integer("lunch_enabled", { mode: "boolean" }).notNull().default(true),
  lunchStart: text("lunch_start").notNull().default("11:30"),
  lunchEnd: text("lunch_end").notNull().default("14:00"),
  lunchLastOrder: text("lunch_last_order").notNull().default("13:30"),
  lunchDays: text("lunch_days").notNull().default("2,3,4,5,6,7"),
  dinnerEnabled: integer("dinner_enabled", { mode: "boolean" }).notNull().default(true),
  dinnerStart: text("dinner_start").notNull().default("17:30"),
  dinnerEnd: text("dinner_end").notNull().default("22:00"),
  dinnerLastOrder: text("dinner_last_order").notNull().default("21:30"),
  dinnerDays: text("dinner_days").notNull().default("6"),
  eventDinnerEnabled: integer("event_dinner_enabled", { mode: "boolean" }).notNull().default(true),
  updatedBy: text("updated_by").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const businessCalendar = sqliteTable("business_calendar", {
  date: text("date").primaryKey(),
  status: text("status", { enum: ["DEFAULT", "CLOSED", "CUSTOM", "EVENT", "CONTINUOUS"] }).notNull().default("DEFAULT"),
  lunchEnabled: integer("lunch_enabled", { mode: "boolean" }).notNull().default(true),
  dinnerEnabled: integer("dinner_enabled", { mode: "boolean" }).notNull().default(false),
  lunchStart: text("lunch_start").notNull().default("11:30"),
  lunchEnd: text("lunch_end").notNull().default("14:00"),
  dinnerStart: text("dinner_start").notNull().default("17:30"),
  dinnerEnd: text("dinner_end").notNull().default("22:00"),
  continuousStart: text("continuous_start").notNull().default("11:30"),
  continuousEnd: text("continuous_end").notNull().default("22:00"),
  continuousLastOrder: text("continuous_last_order").notNull().default("21:30"),
  note: text("note").notNull().default(""),
  updatedBy: text("updated_by").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("business_calendar_status_idx").on(table.status)]);

export const categorySchedules = sqliteTable("category_schedules", {
  category: text("category").primaryKey(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  startTime: text("start_time").notNull().default("11:30"),
  endTime: text("end_time").notNull().default("14:00"),
  days: text("days").notNull().default("1,2,3,4,5,6,7"),
  note: text("note").notNull().default(""),
  updatedBy: text("updated_by").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
