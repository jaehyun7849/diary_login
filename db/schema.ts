// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  authVersion: integer("auth_version").notNull().default(1),
  created: text("created").notNull(),
});
export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  expires: text("expires").notNull(),
  created: text("created").notNull(),
});
export const attempts = sqliteTable("auth_attempts", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expires: text("expires").notNull(),
});
export const experiments = sqliteTable("experiments", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  metric: text("metric").notNull(),
  unit: text("unit").notNull(),
  rules: text("rules").notNull(),
  initialRule: text("initial_rule").notNull(),
  changedRule: text("changed_rule"),
  changedAt: text("changed_at"),
  reason: text("reason"),
  created: text("created").notNull(),
});
export const days = sqliteTable(
  "experiment_days",
  {
    id: text("id").primaryKey(),
    experimentId: text("experiment_id")
      .notNull()
      .references(() => experiments.id, { onDelete: "cascade" }),
    dayIndex: integer("day_index").notNull(),
    date: text("date").notNull(),
    minutes: integer("minutes").notNull(),
    note: text("note").notNull(),
    outlierConfirmed: integer("outlier_confirmed").notNull(),
    created: text("created").notNull(),
  },
  (t) => [
    uniqueIndex("day_date_unique").on(t.experimentId, t.date),
    uniqueIndex("day_index_unique").on(t.experimentId, t.dayIndex),
  ],
);
export const plans = sqliteTable("plans", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").references(() => users.id),
  title: text("title").notNull(),
  start: text("start").notNull(),
  end: text("end").notNull(),
  priority: text("priority").notNull(),
  success: text("success").notNull(),
  estimate: integer("estimate").notNull(),
  improvement: text("improvement").notNull().default(""),
  created: text("created").notNull(),
  version: integer("version").notNull().default(1),
});
export const revisions = sqliteTable("revisions", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id),
  snapshot: text("snapshot").notNull(),
  created: text("created").notNull(),
});
export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id),
  title: text("title").notNull(),
  due: text("due").notNull(),
  priority: text("priority").notNull(),
  tag: text("tag").notNull(),
  estimate: integer("estimate").notNull(),
  done: integer("done").notNull().default(0),
  deleted: integer("deleted").notNull().default(0),
  created: text("created").notNull(),
});
export const logs = sqliteTable("logs", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id),
  start: text("start").notNull(),
  end: text("end").notNull(),
  minutes: integer("minutes").notNull(),
  note: text("note").notNull(),
  blocker: text("blocker").notNull(),
  created: text("created").notNull(),
});
export const completions = sqliteTable("completions", {
  taskId: text("task_id")
    .primaryKey()
    .references(() => tasks.id),
  created: text("created").notNull(),
});
export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id),
  start: text("start").notNull(),
  end: text("end").notNull(),
  note: text("note").notNull(),
  improvement: text("improvement").notNull(),
  nextPlanId: text("next_plan_id").references(() => plans.id),
  created: text("created").notNull(),
});
