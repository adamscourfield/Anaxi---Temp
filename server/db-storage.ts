import { db } from "./db";
import { eq } from "drizzle-orm";
import { 
  type User, 
  type InsertUser, 
  type Teacher, 
  type InsertTeacher, 
  type TeachingGroup, 
  type InsertTeachingGroup, 
  type Conversation, 
  type InsertConversation,
  users,
  teachers,
  teachingGroups,
  conversations,
} from "@shared/schema";
import { type IStorage } from "./storage";

export class DbStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getTeachersBySchool(schoolId: string): Promise<Teacher[]> {
    return await db.select().from(teachers).where(eq(teachers.schoolId, schoolId));
  }

  async getTeacher(id: string): Promise<Teacher | undefined> {
    const [teacher] = await db.select().from(teachers).where(eq(teachers.id, id));
    return teacher;
  }

  async createTeacher(insertTeacher: InsertTeacher): Promise<Teacher> {
    const [teacher] = await db.insert(teachers).values(insertTeacher).returning();
    return teacher;
  }

  async updateTeacher(id: string, updates: Partial<Teacher>): Promise<Teacher | undefined> {
    const [teacher] = await db.update(teachers).set(updates).where(eq(teachers.id, id)).returning();
    return teacher;
  }

  async deleteTeacher(id: string): Promise<boolean> {
    const result = await db.delete(teachers).where(eq(teachers.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getTeachingGroupsBySchool(schoolId: string): Promise<TeachingGroup[]> {
    return await db.select().from(teachingGroups).where(eq(teachingGroups.schoolId, schoolId));
  }

  async getTeachingGroup(id: string): Promise<TeachingGroup | undefined> {
    const [group] = await db.select().from(teachingGroups).where(eq(teachingGroups.id, id));
    return group;
  }

  async createTeachingGroup(insertGroup: InsertTeachingGroup): Promise<TeachingGroup> {
    const [group] = await db.insert(teachingGroups).values(insertGroup).returning();
    return group;
  }

  async updateTeachingGroup(id: string, updates: Partial<TeachingGroup>): Promise<TeachingGroup | undefined> {
    const [group] = await db.update(teachingGroups).set(updates).where(eq(teachingGroups.id, id)).returning();
    return group;
  }

  async deleteTeachingGroup(id: string): Promise<boolean> {
    const result = await db.delete(teachingGroups).where(eq(teachingGroups.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getConversationsBySchool(schoolId: string): Promise<Conversation[]> {
    return await db.select().from(conversations).where(eq(conversations.schoolId, schoolId));
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const [conversation] = await db.insert(conversations).values(insertConversation).returning();
    return conversation;
  }
}
