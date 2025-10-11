import { type User, type InsertUser, type Teacher, type InsertTeacher, type TeachingGroup, type InsertTeachingGroup } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getTeachersBySchool(schoolId: string): Promise<Teacher[]>;
  getTeacher(id: string): Promise<Teacher | undefined>;
  createTeacher(teacher: InsertTeacher): Promise<Teacher>;
  updateTeacher(id: string, updates: Partial<Teacher>): Promise<Teacher | undefined>;
  deleteTeacher(id: string): Promise<boolean>;
  
  getTeachingGroupsBySchool(schoolId: string): Promise<TeachingGroup[]>;
  getTeachingGroup(id: string): Promise<TeachingGroup | undefined>;
  createTeachingGroup(group: InsertTeachingGroup): Promise<TeachingGroup>;
  updateTeachingGroup(id: string, updates: Partial<TeachingGroup>): Promise<TeachingGroup | undefined>;
  deleteTeachingGroup(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private teachers: Map<string, Teacher>;
  private teachingGroups: Map<string, TeachingGroup>;

  constructor() {
    this.users = new Map();
    this.teachers = new Map();
    this.teachingGroups = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getTeachersBySchool(schoolId: string): Promise<Teacher[]> {
    return Array.from(this.teachers.values()).filter(
      (teacher) => teacher.schoolId === schoolId,
    );
  }

  async getTeacher(id: string): Promise<Teacher | undefined> {
    return this.teachers.get(id);
  }

  async createTeacher(insertTeacher: InsertTeacher): Promise<Teacher> {
    const id = randomUUID();
    const teacher: Teacher = { 
      ...insertTeacher, 
      id,
      email: insertTeacher.email ?? null,
      groupId: insertTeacher.groupId ?? null
    };
    this.teachers.set(id, teacher);
    return teacher;
  }

  async updateTeacher(id: string, updates: Partial<Teacher>): Promise<Teacher | undefined> {
    const teacher = this.teachers.get(id);
    if (!teacher) return undefined;
    
    const updated = { ...teacher, ...updates };
    this.teachers.set(id, updated);
    return updated;
  }

  async deleteTeacher(id: string): Promise<boolean> {
    return this.teachers.delete(id);
  }

  async getTeachingGroupsBySchool(schoolId: string): Promise<TeachingGroup[]> {
    return Array.from(this.teachingGroups.values()).filter(
      (group) => group.schoolId === schoolId,
    );
  }

  async getTeachingGroup(id: string): Promise<TeachingGroup | undefined> {
    return this.teachingGroups.get(id);
  }

  async createTeachingGroup(insertGroup: InsertTeachingGroup): Promise<TeachingGroup> {
    const id = randomUUID();
    const group: TeachingGroup = { 
      ...insertGroup, 
      id,
      groupLeadId: insertGroup.groupLeadId ?? null
    };
    this.teachingGroups.set(id, group);
    return group;
  }

  async updateTeachingGroup(id: string, updates: Partial<TeachingGroup>): Promise<TeachingGroup | undefined> {
    const group = this.teachingGroups.get(id);
    if (!group) return undefined;
    
    const updated = { ...group, ...updates };
    this.teachingGroups.set(id, updated);
    return updated;
  }

  async deleteTeachingGroup(id: string): Promise<boolean> {
    return this.teachingGroups.delete(id);
  }
}

export const storage = new MemStorage();
