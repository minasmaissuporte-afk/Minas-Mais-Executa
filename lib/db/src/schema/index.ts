import {
  boolean,
  integer,
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

export const activityTable = pgTable("activity", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  tone: text("tone").notNull(),
});

export type Store = typeof storesTable.$inferSelect;
export type TeamMember = typeof teamMembersTable.$inferSelect;
export type Task = typeof tasksTable.$inferSelect;
export type Evidence = typeof evidencesTable.$inferSelect;
export type Activity = typeof activityTable.$inferSelect;