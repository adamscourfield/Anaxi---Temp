import { type User, type InsertUser, type Teacher, type InsertTeacher, type TeachingGroup, type InsertTeachingGroup, type Conversation, type InsertConversation } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  
  getTeachersBySchool(schoolId: string): Promise<Teacher[]>;
  getTeacher(id: string): Promise<Teacher | undefined>;
  getTeacherByUserId(userId: string): Promise<Teacher | undefined>;
  createTeacher(teacher: InsertTeacher): Promise<Teacher>;
  updateTeacher(id: string, updates: Partial<Teacher>): Promise<Teacher | undefined>;
  deleteTeacher(id: string): Promise<boolean>;
  
  getTeachingGroupsBySchool(schoolId: string): Promise<TeachingGroup[]>;
  getTeachingGroup(id: string): Promise<TeachingGroup | undefined>;
  createTeachingGroup(group: InsertTeachingGroup): Promise<TeachingGroup>;
  updateTeachingGroup(id: string, updates: Partial<TeachingGroup>): Promise<TeachingGroup | undefined>;
  deleteTeachingGroup(id: string): Promise<boolean>;
  
  getConversationsBySchool(schoolId: string): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private teachers: Map<string, Teacher>;
  private teachingGroups: Map<string, TeachingGroup>;
  private conversations: Map<string, Conversation>;

  constructor() {
    this.users = new Map();
    this.teachers = new Map();
    this.teachingGroups = new Map();
    this.conversations = new Map();
    
    this.seedData();
  }

  private seedData() {
    const schoolId = "default-school";
    
    const englishGroup: TeachingGroup = {
      id: "group-1",
      schoolId,
      name: "English Department",
      groupLeadId: "teacher-1",
    };
    const mathGroup: TeachingGroup = {
      id: "group-2",
      schoolId,
      name: "Mathematics",
      groupLeadId: "teacher-2",
    };
    const scienceGroup: TeachingGroup = {
      id: "group-3",
      schoolId,
      name: "Science Team",
      groupLeadId: "teacher-3",
    };
    
    this.teachingGroups.set(englishGroup.id, englishGroup);
    this.teachingGroups.set(mathGroup.id, mathGroup);
    this.teachingGroups.set(scienceGroup.id, scienceGroup);
    
    const teachers: Teacher[] = [
      {
        id: "teacher-1",
        userId: null,
        schoolId,
        name: "Sarah Mitchell",
        email: "s.mitchell@school.edu",
        role: "Teacher",
        profilePicture: null,
        groupId: "group-1",
      },
      {
        id: "teacher-2",
        userId: null,
        schoolId,
        name: "James Chen",
        email: "j.chen@school.edu",
        role: "Leader",
        profilePicture: null,
        groupId: "group-2",
      },
      {
        id: "teacher-3",
        userId: null,
        schoolId,
        name: "Emily Rodriguez",
        email: "e.rodriguez@school.edu",
        role: "Admin",
        profilePicture: null,
        groupId: "group-3",
      },
      {
        id: "teacher-4",
        userId: null,
        schoolId,
        name: "Michael Thompson",
        email: "m.thompson@school.edu",
        role: "Teacher",
        profilePicture: null,
        groupId: "group-1",
      },
      {
        id: "teacher-5",
        userId: null,
        schoolId,
        name: "Lisa Anderson",
        email: "l.anderson@school.edu",
        role: "Teacher",
        profilePicture: null,
        groupId: null,
      },
    ];
    
    teachers.forEach(teacher => {
      this.teachers.set(teacher.id, teacher);
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(userData: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      id,
      email: userData.email,
      password_hash: userData.password_hash,
      first_name: userData.first_name || null,
      last_name: userData.last_name || null,
      profile_image_url: userData.profile_image_url || null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updated = { ...user, ...updates, updated_at: new Date() };
    this.users.set(id, updated);
    return updated;
  }

  async getTeachersBySchool(schoolId: string): Promise<Teacher[]> {
    return Array.from(this.teachers.values()).filter(
      (teacher) => teacher.schoolId === schoolId,
    );
  }

  async getTeacher(id: string): Promise<Teacher | undefined> {
    return this.teachers.get(id);
  }

  async getTeacherByUserId(userId: string): Promise<Teacher | undefined> {
    return Array.from(this.teachers.values()).find(teacher => teacher.userId === userId);
  }

  async createTeacher(insertTeacher: InsertTeacher): Promise<Teacher> {
    const id = randomUUID();
    const teacher: Teacher = { 
      ...insertTeacher, 
      id,
      userId: insertTeacher.userId ?? null,
      email: insertTeacher.email ?? null,
      role: insertTeacher.role ?? "Teacher",
      profilePicture: insertTeacher.profilePicture ?? null,
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

  async getConversationsBySchool(schoolId: string): Promise<Conversation[]> {
    return Array.from(this.conversations.values())
      .filter((conversation) => conversation.schoolId === schoolId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const id = randomUUID();
    const conversation: Conversation = {
      ...insertConversation,
      id,
      createdAt: new Date(),
    };
    this.conversations.set(id, conversation);
    return conversation;
  }
}

import { DbStorage } from "./db-storage";

export const storage = new DbStorage();
