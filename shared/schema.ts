import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const schools = pgTable("schools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
});

export const insertSchoolSchema = createInsertSchema(schools).omit({ id: true });
export type InsertSchool = z.infer<typeof insertSchoolSchema>;
export type School = typeof schools.$inferSelect;

export const teachingGroups = pgTable("teaching_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  name: text("name").notNull(),
  groupLeadId: varchar("group_lead_id"), // Validated in application logic to avoid circular FK dependency
});

export const insertTeachingGroupSchema = createInsertSchema(teachingGroups).omit({ id: true });
export type InsertTeachingGroup = z.infer<typeof insertTeachingGroupSchema>;
export type TeachingGroup = typeof teachingGroups.$inferSelect;

export const teachers = pgTable("teachers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  name: text("name").notNull(),
  email: text("email"),
  groupId: varchar("group_id").references(() => teachingGroups.id),
});

export const insertTeacherSchema = createInsertSchema(teachers).omit({ id: true });
export type InsertTeacher = z.infer<typeof insertTeacherSchema>;
export type Teacher = typeof teachers.$inferSelect;

export const rubrics = pgTable("rubrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  name: text("name").notNull(),
});

export const insertRubricSchema = createInsertSchema(rubrics).omit({ id: true });
export type InsertRubric = z.infer<typeof insertRubricSchema>;
export type Rubric = typeof rubrics.$inferSelect;

export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rubricId: varchar("rubric_id").notNull().references(() => rubrics.id),
  name: text("name").notNull(),
  order: integer("order").notNull(),
});

export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

export const habits = pgTable("habits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").notNull().references(() => categories.id),
  text: text("text").notNull(),
  description: text("description").notNull(),
  order: integer("order").notNull(),
});

export const insertHabitSchema = createInsertSchema(habits).omit({ id: true });
export type InsertHabit = z.infer<typeof insertHabitSchema>;
export type Habit = typeof habits.$inferSelect;

export const observations = pgTable("observations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teacherId: varchar("teacher_id").notNull().references(() => teachers.id),
  observerId: varchar("observer_id").notNull().references(() => users.id),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  rubricId: varchar("rubric_id").notNull().references(() => rubrics.id),
  date: timestamp("date").notNull().defaultNow(),
  lessonTopic: text("lesson_topic"),
  classInfo: text("class_info"),
  qualitativeFeedback: text("qualitative_feedback"),
  totalScore: integer("total_score").notNull(),
  totalMaxScore: integer("total_max_score").notNull(),
});

export const insertObservationSchema = createInsertSchema(observations).omit({ id: true });
export type InsertObservation = z.infer<typeof insertObservationSchema>;
export type Observation = typeof observations.$inferSelect;

export const observationHabits = pgTable("observation_habits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  observationId: varchar("observation_id").notNull().references(() => observations.id),
  categoryId: varchar("category_id").notNull().references(() => categories.id),
  habitId: varchar("habit_id").notNull().references(() => habits.id),
  observed: boolean("observed").notNull(),
});

export const insertObservationHabitSchema = createInsertSchema(observationHabits).omit({ id: true });
export type InsertObservationHabit = z.infer<typeof insertObservationHabitSchema>;
export type ObservationHabit = typeof observationHabits.$inferSelect;
