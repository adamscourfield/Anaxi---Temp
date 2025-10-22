import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table with Stytch authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stytch_user_id: varchar("stytch_user_id").unique(), // Stytch user ID for magic link auth
  email: varchar("email").unique().notNull(),
  password_hash: varchar("password_hash"), // Optional: legacy password auth (can be removed later)
  first_name: varchar("first_name"),
  last_name: varchar("last_name"),
  profile_image_url: varchar("profile_image_url"),
  global_role: text("global_role"), // "Creator" for platform admins, null for regular users
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, created_at: true, updated_at: true });
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

// School memberships - links users to schools with roles
// Replaces the teachers table with a cleaner many-to-many relationship
export const schoolMemberships = pgTable("school_memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  role: text("role").notNull().default("Teacher"), // Teacher, Leader, Admin
  displayName: text("display_name"), // Optional: display name override for this school
  profilePicture: text("profile_picture"), // Optional: profile picture override for this school
  groupId: varchar("group_id").references(() => teachingGroups.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSchoolMembershipSchema = createInsertSchema(schoolMemberships).omit({ id: true, createdAt: true });
export type InsertSchoolMembership = z.infer<typeof insertSchoolMembershipSchema>;
export type SchoolMembership = typeof schoolMemberships.$inferSelect;

// DEPRECATED: Legacy teachers table - will be removed after migration to school_memberships
export const teachers = pgTable("teachers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  name: text("name").notNull(),
  email: text("email"),
  role: text("role").notNull().default("Teacher"),
  profilePicture: text("profile_picture"),
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

// DEPRECATED: Legacy conversations table - will be replaced by meetings
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  teacherId: varchar("teacher_id").notNull().references(() => teachers.id),
  subject: text("subject").notNull(),
  details: text("details").notNull(),
  rating: text("rating").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true });
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

// Meetings - replaces conversations with support for multi-person meetings
export const meetings = pgTable("meetings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: varchar("school_id").notNull().references(() => schools.id),
  organizerId: varchar("organizer_id").notNull().references(() => users.id),
  type: text("type").notNull(), // "Line Management", "Department", or "Leadership"
  subject: text("subject").notNull(),
  details: text("details"),
  scheduledAt: timestamp("scheduled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertMeetingSchema = createInsertSchema(meetings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type Meeting = typeof meetings.$inferSelect;

// Meeting attendees - links users to meetings
export const meetingAttendees = pgTable("meeting_attendees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  meetingId: varchar("meeting_id").notNull().references(() => meetings.id),
  membershipId: varchar("membership_id").notNull().references(() => schoolMemberships.id),
  attendeeRole: text("attendee_role"), // Optional: "Presenter", "Observer", "Participant"
  attendanceStatus: text("attendance_status").notNull().default("pending"), // "pending", "accepted", "declined", "attended"
  isRequired: boolean("is_required").notNull().default(true),
  joinedAt: timestamp("joined_at"),
});

export const insertMeetingAttendeeSchema = createInsertSchema(meetingAttendees).omit({ id: true });
export type InsertMeetingAttendee = z.infer<typeof insertMeetingAttendeeSchema>;
export type MeetingAttendee = typeof meetingAttendees.$inferSelect;

// Meeting actions - tasks assigned during meetings
export const meetingActions = pgTable("meeting_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  meetingId: varchar("meeting_id").notNull().references(() => meetings.id),
  assignedToMembershipId: varchar("assigned_to_membership_id").notNull().references(() => schoolMemberships.id),
  createdByMembershipId: varchar("created_by_membership_id").notNull().references(() => schoolMemberships.id),
  description: text("description").notNull(),
  status: text("status").notNull().default("open"), // "open", "in_progress", "done"
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertMeetingActionSchema = createInsertSchema(meetingActions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMeetingAction = z.infer<typeof insertMeetingActionSchema>;
export type MeetingAction = typeof meetingActions.$inferSelect;
