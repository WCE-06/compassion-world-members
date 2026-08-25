import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  memberCode: text("member_code").notNull(),
  displayName: text("display_name").notNull(),
  displayNameKana: text("display_name_kana"),
  lineDisplayName: text("line_display_name"),
  phone: text("phone"),
  email: text("email"),
  birthDate: text("birth_date"),
  gender: text("gender"),
  postalCode: text("postal_code"),
  prefecture: text("prefecture"),
  address: text("address"),
  pointsBalance: integer("points_balance").notNull().default(0),
  memberRank: text("member_rank", { enum: ["STANDARD", "BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND", "RESIDENT"] }),
  residentStatus: text("resident_status", { enum: ["UNKNOWN", "ACTIVE", "INACTIVE"] }).notNull().default("UNKNOWN"),
  residentCheckedAt: integer("resident_checked_at", { mode: "timestamp_ms" }),
  status: text("status", { enum: ["ACTIVE", "INACTIVE"] }).notNull().default("ACTIVE"),
  sourceSystem: text("source_system").notNull().default("LEGACY"),
  sourceCustomerId: text("source_customer_id"),
  acquisitionSource: text("acquisition_source"),
  legacyTags: text("legacy_tags"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("members_member_code_unique").on(table.memberCode)]);

export const adminAccounts = sqliteTable("admin_accounts", {
  email: text("email").primaryKey(),
  passwordScheme: text("password_scheme").notNull(),
  passwordSalt: text("password_salt").notNull(),
  passwordHash: text("password_hash").notNull(),
  passwordChangedAt: integer("password_changed_at", { mode: "timestamp_ms" }).notNull(),
  updatedBy: text("updated_by").notNull(),
});

export const memberSpendSnapshots = sqliteTable("member_spend_snapshots", {
  memberId: text("member_id").primaryKey().references(() => members.id),
  source: text("source", { enum: ["SMAREGI"] }).notNull().default("SMAREGI"),
  qualifyingSpendExcludingTax: integer("qualifying_spend_excluding_tax").notNull(),
  periodStart: integer("period_start", { mode: "timestamp_ms" }).notNull(),
  periodEnd: integer("period_end", { mode: "timestamp_ms" }).notNull(),
  sourceRevision: text("source_revision"),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("member_spend_snapshots_synced_idx").on(table.syncedAt)]);

export const memberRankStates = sqliteTable("member_rank_states", {
  memberId: text("member_id").primaryKey().references(() => members.id),
  currentRank: text("current_rank", { enum: ["STANDARD", "BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"] }).notNull(),
  currentRatePercent: integer("current_rate_percent").notNull(),
  rankPeriodStartedAt: integer("rank_period_started_at", { mode: "timestamp_ms" }).notNull(),
  rankPeriodEndsAt: integer("rank_period_ends_at", { mode: "timestamp_ms" }).notNull(),
  qualifyingSpendExcludingTax: integer("qualifying_spend_excluding_tax").notNull().default(0),
  rankUpdatedAt: integer("rank_updated_at", { mode: "timestamp_ms" }).notNull(),
  nextReviewAt: integer("next_review_at", { mode: "timestamp_ms" }).notNull(),
  membershipType: text("membership_type", { enum: ["GENERAL", "RESIDENT"] }).notNull().default("GENERAL"),
  residentPlanActive: integer("resident_plan_active", { mode: "boolean" }).notNull().default(false),
  spendSource: text("spend_source", { enum: ["SMAREGI", "NOT_SYNCED"] }).notNull().default("NOT_SYNCED"),
  spendSourceRevision: text("spend_source_revision"),
  spendSyncedAt: integer("spend_synced_at", { mode: "timestamp_ms" }),
}, (table) => [index("member_rank_states_review_idx").on(table.nextReviewAt)]);

export const memberRankEvents = sqliteTable("member_rank_events", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull().references(() => members.id),
  eventType: text("event_type", { enum: ["INITIALIZED", "PROMOTED", "ANNUAL_REVIEW", "SYNCED", "FORCED"] }).notNull(),
  previousRank: text("previous_rank"),
  nextRank: text("next_rank").notNull(),
  qualifyingSpendExcludingTax: integer("qualifying_spend_excluding_tax").notNull(),
  source: text("source").notNull(),
  sourceRevision: text("source_revision"),
  detailsJson: text("details_json").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("member_rank_events_member_idx").on(table.memberId, table.createdAt)]);

export const memberPolicyConsents = sqliteTable("member_policy_consents", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull().references(() => members.id),
  termsVersion: text("terms_version").notNull(),
  consentType: text("consent_type", { enum: ["MEMBERSHIP_AND_POINTS"] }).notNull(),
  source: text("source", { enum: ["MEMBER_CARD"] }).notNull().default("MEMBER_CARD"),
  agreedAt: integer("agreed_at", { mode: "timestamp_ms" }).notNull(),
  userAgent: text("user_agent"),
}, (table) => [
  uniqueIndex("member_policy_consents_member_version_unique").on(table.memberId, table.termsVersion, table.consentType),
  index("member_policy_consents_member_idx").on(table.memberId, table.agreedAt),
]);

export const legacyMemberImports = sqliteTable("legacy_member_imports", {
  id: text("id").primaryKey(),
  lineUserId: text("line_user_id"),
  displayName: text("display_name"),
  displayNameKana: text("display_name_kana"),
  lineDisplayName: text("line_display_name"),
  phone: text("phone"),
  email: text("email"),
  birthDate: text("birth_date"),
  gender: text("gender"),
  postalCode: text("postal_code"),
  prefecture: text("prefecture"),
  address: text("address"),
  sourceRegisteredAt: text("source_registered_at"),
  acquisitionSource: text("acquisition_source"),
  legacyTags: text("legacy_tags"),
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

export const memberRegistrationSyncs = sqliteTable("member_registration_syncs", {
  memberId: text("member_id").primaryKey().references(() => members.id),
  status: text("status", { enum: ["PENDING", "SYNCING", "SYNCED", "FAILED"] }).notNull().default("PENDING"),
  attempts: integer("attempts").notNull().default(0),
  sourceCustomerId: text("source_customer_id"),
  lastError: text("last_error"),
  lastRequestId: text("last_request_id"),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("member_registration_sync_status_idx").on(table.status, table.updatedAt)]);

export const memberTermsAcceptances = sqliteTable("member_terms_acceptances", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull().references(() => members.id),
  termsVersion: text("terms_version").notNull(),
  privacyVersion: text("privacy_version").notNull(),
  acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }).notNull(),
  userAgent: text("user_agent"),
}, (table) => [index("member_terms_member_idx").on(table.memberId, table.acceptedAt)]);

export const memberRegistrationEvents = sqliteTable("member_registration_events", {
  id: text("id").primaryKey(),
  memberId: text("member_id").references(() => members.id),
  eventType: text("event_type").notNull(),
  actor: text("actor").notNull(),
  detailsJson: text("details_json").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("member_registration_events_member_idx").on(table.memberId, table.createdAt)]);

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
  paymentMethod: text("payment_method", { enum: ["STORE", "STRIPE"] }),
  pointEligible: integer("point_eligible", { mode: "boolean" }).notNull().default(true),
  pointStatus: text("point_status", { enum: ["PENDING", "POSTING", "AWARDED", "REVERSED", "NOT_ELIGIBLE", "FAILED"] }).notNull().default("PENDING"),
  pointsEarned: integer("points_earned").notNull().default(0),
  smaregiTransactionId: text("smaregi_transaction_id"),
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
  status: text("status", { enum: ["PENDING_PAYMENT", "WAITING_STORE_PAYMENT", "PAYMENT_PROCESSING", "PAID", "ACCEPTED", "COOKING", "READY", "PICKED_UP", "PAYMENT_FAILED", "EXPIRED", "CANCELLED", "REFUNDED"] }).notNull(),
  paymentMethod: text("payment_method", { enum: ["STORE", "STRIPE"] }).notNull(),
  totalIncludingTax: integer("total_including_tax").notNull(),
  pointEligible: integer("point_eligible", { mode: "boolean" }).notNull().default(true),
  pointStatus: text("point_status", { enum: ["PENDING", "POSTING", "AWARDED", "REVERSED", "FAILED"] }).notNull().default("PENDING"),
  pointsEarned: integer("points_earned").notNull().default(0),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  smaregiTransactionId: text("smaregi_transaction_id"),
  pickupAt: integer("pickup_at", { mode: "timestamp_ms" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("orders_order_number_unique").on(table.orderNumber),
  uniqueIndex("orders_stripe_payment_intent_unique").on(table.stripePaymentIntentId),
  uniqueIndex("orders_stripe_checkout_session_unique").on(table.stripeCheckoutSessionId),
  uniqueIndex("orders_smaregi_transaction_unique").on(table.smaregiTransactionId),
  index("orders_member_created_idx").on(table.memberId, table.createdAt),
]);

export const stripeCustomers = sqliteTable("stripe_customers", {
  memberId: text("member_id").primaryKey().references(() => members.id),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  defaultPaymentMethodId: text("default_payment_method_id"),
  cardBrand: text("card_brand"),
  cardLast4: text("card_last4"),
  cardExpMonth: integer("card_exp_month"),
  cardExpYear: integer("card_exp_year"),
  reusableConsentAt: integer("reusable_consent_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("stripe_customers_customer_unique").on(table.stripeCustomerId)]);

export const stripeWebhookEvents = sqliteTable("stripe_webhook_events", {
  eventId: text("event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  status: text("status", { enum: ["RECEIVED", "PROCESSED", "IGNORED", "FAILED"] }).notNull(),
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  processedAt: integer("processed_at", { mode: "timestamp_ms" }),
});

export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  productId: text("product_id").notNull(),
  productCode: text("product_code").notNull(),
  productName: text("product_name").notNull(),
  department: text("department", { enum: ["FOOD", "DRINK"] }).notNull().default("FOOD"),
  quantity: integer("quantity").notNull(),
  unitPriceExcludingTax: integer("unit_price_excluding_tax").notNull().default(0),
  unitPriceIncludingTax: integer("unit_price_including_tax").notNull(),
  taxRate: integer("tax_rate").notNull().default(10),
  taxDivision: text("tax_division").notNull().default("INCLUDED"),
  taxRounding: text("tax_rounding").notNull().default("FLOOR"),
  preparationMinutes: integer("preparation_minutes").notNull().default(0),
  selectedOptionsJson: text("selected_options_json").notNull().default("[]"),
  lineTotalIncludingTax: integer("line_total_including_tax").notNull(),
}, (table) => [index("order_items_order_idx").on(table.orderId)]);

export const orderPaymentLocks = sqliteTable("order_payment_locks", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  requestId: text("request_id").notNull(),
  deviceId: text("device_id").notNull(),
  status: text("status", { enum: ["ACTIVE", "RELEASED", "CONSUMED", "EXPIRED"] }).notNull(),
  lockedAt: integer("locked_at", { mode: "timestamp_ms" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  releasedAt: integer("released_at", { mode: "timestamp_ms" }),
  releaseReason: text("release_reason"),
}, (table) => [
  uniqueIndex("order_payment_locks_request_unique").on(table.requestId),
  index("order_payment_locks_order_status_idx").on(table.orderId, table.status, table.expiresAt),
]);

export const orderPaymentEvents = sqliteTable("order_payment_events", {
  id: text("id").primaryKey(),
  requestId: text("request_id").notNull(),
  orderId: text("order_id").notNull().references(() => orders.id),
  paymentId: text("payment_id").notNull(),
  lockId: text("lock_id"),
  deviceId: text("device_id"),
  paidAt: integer("paid_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("order_payment_events_request_unique").on(table.requestId),
  uniqueIndex("order_payment_events_payment_unique").on(table.paymentId),
  index("order_payment_events_order_idx").on(table.orderId),
]);

export const orderCallCounters = sqliteTable("order_call_counters", {
  callDate: text("call_date").notNull(),
  department: text("department", { enum: ["FOOD", "DRINK"] }).notNull(),
  lastNumber: integer("last_number").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("order_call_counters_date_department_unique").on(table.callDate, table.department),
]);

export const orderFulfillments = sqliteTable("order_fulfillments", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  department: text("department", { enum: ["FOOD", "DRINK"] }).notNull(),
  callDate: text("call_date").notNull(),
  callNumber: integer("call_number").notNull(),
  status: text("status", { enum: ["WAITING_PAYMENT", "ACCEPTED", "COOKING", "READY", "CALLED", "PICKED_UP", "CANCELLED"] }).notNull().default("ACCEPTED"),
  readyAt: integer("ready_at", { mode: "timestamp_ms" }),
  calledAt: integer("called_at", { mode: "timestamp_ms" }),
  pickedUpAt: integer("picked_up_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("order_fulfillments_order_department_unique").on(table.orderId, table.department),
  uniqueIndex("order_fulfillments_call_unique").on(table.callDate, table.department, table.callNumber),
  index("order_fulfillments_status_idx").on(table.department, table.status, table.updatedAt),
]);

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
  saleStartsAt: integer("sale_starts_at", { mode: "timestamp_ms" }),
  saleEndsAt: integer("sale_ends_at", { mode: "timestamp_ms" }),
  limitedPrice: integer("limited_price"),
  limitedPriceStartsAt: integer("limited_price_starts_at", { mode: "timestamp_ms" }),
  limitedPriceEndsAt: integer("limited_price_ends_at", { mode: "timestamp_ms" }),
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

export const paymentPointEvents = sqliteTable("payment_point_events", {
  id: text("id").primaryKey(),
  idempotencyKey: text("idempotency_key").notNull(),
  memberId: text("member_id").notNull().references(() => members.id),
  purpose: text("purpose", { enum: ["MOBILE_ORDER", "STUDIO_USAGE", "RESIDENT_SUBSCRIPTION"] }).notNull(),
  sourceId: text("source_id").notNull(),
  stripeEventId: text("stripe_event_id"),
  stripePaymentId: text("stripe_payment_id"),
  smaregiTransactionId: text("smaregi_transaction_id"),
  eligible: integer("eligible", { mode: "boolean" }).notNull(),
  status: text("status", { enum: ["RECEIVED", "POSTING", "AWARDED", "REVERSED", "NOT_ELIGIBLE", "FAILED"] }).notNull(),
  points: integer("points").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("payment_point_events_idempotency_unique").on(table.idempotencyKey),
  uniqueIndex("payment_point_events_stripe_event_unique").on(table.stripeEventId),
  index("payment_point_events_source_idx").on(table.purpose, table.sourceId),
]);

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

export const operationsTasks = sqliteTable("operations_tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  status: text("status", { enum: ["OPEN", "IN_PROGRESS", "WAITING", "DONE", "CANCELLED"] }).notNull().default("OPEN"),
  priority: text("priority", { enum: ["LOW", "NORMAL", "HIGH", "URGENT"] }).notNull().default("NORMAL"),
  category: text("category", { enum: ["GENERAL", "MEMBER", "STUDIO", "ORDER", "PAYMENT", "INVENTORY", "SNS", "SYSTEM"] }).notNull().default("GENERAL"),
  assignee: text("assignee"),
  dueAt: integer("due_at", { mode: "timestamp_ms" }),
  sourceType: text("source_type"),
  sourceId: text("source_id"),
  memberId: text("member_id").references(() => members.id),
  createdBy: text("created_by").notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("operations_tasks_status_due_idx").on(table.status, table.dueAt), index("operations_tasks_source_idx").on(table.sourceType, table.sourceId)]);

export const memberTags = sqliteTable("member_tags", {
  memberId: text("member_id").notNull().references(() => members.id),
  tag: text("tag").notNull(),
  source: text("source").notNull().default("STAFF"),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("member_tags_member_tag_unique").on(table.memberId, table.tag), index("member_tags_tag_idx").on(table.tag)]);

export const adminSavedFilters = sqliteTable("admin_saved_filters", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  name: text("name").notNull(),
  scope: text("scope").notNull().default("MEMBERS"),
  conditionsJson: text("conditions_json").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("admin_saved_filters_owner_name_unique").on(table.ownerEmail, table.scope, table.name)]);

export const coupons = sqliteTable("coupons", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: text("status", { enum: ["DRAFT", "ACTIVE", "PAUSED", "ENDED"] }).notNull().default("DRAFT"),
  benefitType: text("benefit_type", { enum: ["FIXED", "PERCENT", "POINTS", "MEMBER_PRICE"] }).notNull(),
  benefitValue: integer("benefit_value").notNull().default(0),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }),
  usageLimit: integer("usage_limit"),
  smaregiCouponId: text("smaregi_coupon_id"),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("coupons_status_period_idx").on(table.status, table.startsAt, table.endsAt)]);

export const memberCoupons = sqliteTable("member_coupons", {
  id: text("id").primaryKey(),
  couponId: text("coupon_id").notNull().references(() => coupons.id),
  memberId: text("member_id").notNull().references(() => members.id),
  status: text("status", { enum: ["HELD", "USED", "EXPIRED", "REVOKED"] }).notNull().default("HELD"),
  issuedAt: integer("issued_at", { mode: "timestamp_ms" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp_ms" }),
  smaregiTransactionId: text("smaregi_transaction_id"),
}, (table) => [uniqueIndex("member_coupons_coupon_member_unique").on(table.couponId, table.memberId), index("member_coupons_member_status_idx").on(table.memberId, table.status)]);

export const surveys = sqliteTable("surveys", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  status: text("status", { enum: ["DRAFT", "ACTIVE", "CLOSED"] }).notNull().default("DRAFT"),
  questionsJson: text("questions_json").notNull().default("[]"),
  rewardPoints: integer("reward_points").notNull().default(0),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const surveyResponses = sqliteTable("survey_responses", {
  id: text("id").primaryKey(),
  surveyId: text("survey_id").notNull().references(() => surveys.id),
  memberId: text("member_id").references(() => members.id),
  answersJson: text("answers_json").notNull().default("{}"),
  rewardStatus: text("reward_status", { enum: ["NONE", "PENDING", "AWARDED", "FAILED"] }).notNull().default("NONE"),
  submittedAt: integer("submitted_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("survey_responses_survey_idx").on(table.surveyId, table.submittedAt)]);

export const messageCampaigns = sqliteTable("message_campaigns", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status", { enum: ["DRAFT", "SCHEDULED", "SENDING", "SENT", "FAILED", "CANCELLED"] }).notNull().default("DRAFT"),
  channel: text("channel", { enum: ["CARD", "LINE", "EMAIL", "MULTI"] }).notNull().default("CARD"),
  audienceJson: text("audience_json").notNull().default("{}"),
  contentJson: text("content_json").notNull().default("{}"),
  scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }),
  sentAt: integer("sent_at", { mode: "timestamp_ms" }),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("message_campaigns_status_schedule_idx").on(table.status, table.scheduledAt)]);

export const memberNotifications = sqliteTable("member_notifications", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull(),
  memberId: text("member_id").notNull().references(() => members.id),
  eventType: text("event_type").notNull(),
  category: text("category", { enum: ["PAYMENT", "POINT", "RESERVATION", "ORDER", "NEWS"] }).notNull().default("NEWS"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  sender: text("sender").notNull().default("COMPASSION WORLD"),
  channel: text("channel", { enum: ["CARD", "LINE", "EMAIL"] }).notNull().default("CARD"),
  deliveryStatus: text("delivery_status", { enum: ["SAVED", "SENT", "FAILED", "SKIPPED"] }).notNull().default("SAVED"),
  externalMessageId: text("external_message_id"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").notNull().default(0),
  metadataJson: text("metadata_json").notNull().default("{}"),
  readAt: integer("read_at", { mode: "timestamp_ms" }),
  occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("member_notifications_event_unique").on(table.eventId),
  index("member_notifications_member_created_idx").on(table.memberId, table.createdAt),
]);
export const automationRules = sqliteTable("automation_rules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  triggerType: text("trigger_type").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  conditionsJson: text("conditions_json").notNull().default("{}"),
  actionJson: text("action_json").notNull().default("{}"),
  lastRunAt: integer("last_run_at", { mode: "timestamp_ms" }),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
