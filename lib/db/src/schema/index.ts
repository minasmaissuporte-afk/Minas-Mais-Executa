import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const storesTable = pgTable("stores", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  region: text("region").notNull(),
  manager: text("manager").notNull(),
  managerMemberId: text("manager_member_id"),
  supervisor: text("supervisor").notNull().default(""),
  supervisorMemberId: text("supervisor_member_id"),
  execution: integer("execution").notNull().default(0),
});

export const teamMembersTable = pgTable("team_members", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  clerkUserId: text("clerk_user_id").unique(),
  phone: text("phone").notNull().default(""),
  role: text("role").notNull(),
  storeId: text("store_id"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tasksTable = pgTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  storeId: text("store_id").notNull(),
  storeName: text("store_name").notNull(),
  assignee: text("assignee").notNull(),
  assigneeMemberId: text("assignee_member_id"),
  assigneeMemberIds: text("assignee_member_ids").array().notNull().default([]),
  assigneeRole: text("assignee_role").notNull().default("manager"),
  batchGroupId: text("batch_group_id"),
  category: text("category").notNull(),
  priority: text("priority").notNull(),
  dueDate: text("due_date").notNull(),
  dueTime: text("due_time").notNull(),
  status: text("status").notNull().default("pending"),
  evidenceRequired: boolean("evidence_required").notNull().default(false),
  evidenceTypes: text("evidence_types").array().notNull().default([]),
  instructions: text("instructions").notNull().default(""),
  modelObjectPath: text("model_object_path"),
  modelAttachments: jsonb("model_attachments").$type<Array<{ objectPath: string; fileName: string; type: "photo" | "video" }>>().notNull().default([]),
  managerNotificationSentAt: timestamp("manager_notification_sent_at", { withTimezone: true }),
  managerNotificationReadAt: timestamp("manager_notification_read_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completedBy: text("completed_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const evidencesTable = pgTable("evidences", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  type: text("type").notNull(),
  fileName: text("file_name").notNull(),
  objectPath: text("object_path"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  userName: text("user_name").notNull(),
  location: text("location"),
});

export const taskOriginsTable = pgTable("task_origins", {
  taskId: text("task_id").primaryKey(),
  createdByMemberId: text("created_by_member_id").notNull(),
  createdByRole: text("created_by_role").notNull(),
});

export const taskCommentsTable = pgTable("task_comments", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  userId: text("user_id").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const activityTable = pgTable("activity", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  tone: text("tone").notNull(),
});

export const pushSubscriptionsTable = pgTable("push_subscriptions", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Store = typeof storesTable.$inferSelect;
export type TeamMember = typeof teamMembersTable.$inferSelect;
export type Task = typeof tasksTable.$inferSelect;
export type Evidence = typeof evidencesTable.$inferSelect;
export type TaskOrigin = typeof taskOriginsTable.$inferSelect;
export type TaskComment = typeof taskCommentsTable.$inferSelect;
export type Activity = typeof activityTable.$inferSelect;
export type PushSubscription = typeof pushSubscriptionsTable.$inferSelect;