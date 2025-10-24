import { type User, type InsertUser, type SchoolMembership, type InsertSchoolMembership, type School, type InsertSchool, type TeachingGroup, type InsertTeachingGroup, type Conversation, type InsertConversation, type Observation, type InsertObservation, type Meeting, type InsertMeeting, type MeetingAttendee, type InsertMeetingAttendee, type MeetingAction, type InsertMeetingAction } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  
  // Schools
  getAllSchools(): Promise<School[]>;
  getSchool(id: string): Promise<School | undefined>;
  createSchool(school: InsertSchool): Promise<School>;
  updateSchool(id: string, updates: Partial<School>): Promise<School | undefined>;
  deleteSchool(id: string): Promise<boolean>;
  
  // School Memberships
  getMembershipsBySchool(schoolId: string): Promise<SchoolMembership[]>;
  getMembershipsByUser(userId: string): Promise<SchoolMembership[]>;
  getMembership(id: string): Promise<SchoolMembership | undefined>;
  getMembershipByUserAndSchool(userId: string, schoolId: string): Promise<SchoolMembership | undefined>;
  createMembership(membership: InsertSchoolMembership): Promise<SchoolMembership>;
  updateMembership(id: string, updates: Partial<SchoolMembership>): Promise<SchoolMembership | undefined>;
  deleteMembership(id: string): Promise<boolean>;
  
  // Teaching Groups
  getTeachingGroupsBySchool(schoolId: string): Promise<TeachingGroup[]>;
  getTeachingGroup(id: string): Promise<TeachingGroup | undefined>;
  createTeachingGroup(group: InsertTeachingGroup): Promise<TeachingGroup>;
  updateTeachingGroup(id: string, updates: Partial<TeachingGroup>): Promise<TeachingGroup | undefined>;
  deleteTeachingGroup(id: string): Promise<boolean>;
  
  // Conversations (DEPRECATED - use Meetings instead)
  getConversationsBySchool(schoolId: string): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  
  // Meetings
  getMeetingsBySchool(schoolId: string, membershipId?: string): Promise<Meeting[]>;
  getMeeting(id: string): Promise<Meeting | undefined>;
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  updateMeeting(id: string, updates: Partial<Meeting>): Promise<Meeting | undefined>;
  deleteMeeting(id: string): Promise<boolean>;
  
  // Meeting Attendees
  getAttendeesByMeeting(meetingId: string): Promise<MeetingAttendee[]>;
  createMeetingAttendee(attendee: InsertMeetingAttendee): Promise<MeetingAttendee>;
  deleteMeetingAttendee(id: string): Promise<boolean>;
  
  // Meeting Actions
  getActionsByMeeting(meetingId: string): Promise<MeetingAction[]>;
  getMeetingAction(id: string): Promise<MeetingAction | undefined>;
  createMeetingAction(action: InsertMeetingAction): Promise<MeetingAction>;
  updateMeetingAction(id: string, updates: Partial<MeetingAction>): Promise<MeetingAction | undefined>;
  deleteMeetingAction(id: string): Promise<boolean>;
  
  // Observations
  getObservationsBySchool(schoolId: string): Promise<Observation[]>;
  getObservationsByTeacher(teacherId: string): Promise<Observation[]>;
  getObservation(id: string): Promise<Observation | undefined>;
  createObservation(observation: InsertObservation): Promise<Observation>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private teachingGroups: Map<string, TeachingGroup>;
  private conversations: Map<string, Conversation>;

  constructor() {
    this.users = new Map();
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
      groupLeadId: null,
    };
    const mathGroup: TeachingGroup = {
      id: "group-2",
      schoolId,
      name: "Mathematics",
      groupLeadId: null,
    };
    const scienceGroup: TeachingGroup = {
      id: "group-3",
      schoolId,
      name: "Science Team",
      groupLeadId: null,
    };
    
    this.teachingGroups.set(englishGroup.id, englishGroup);
    this.teachingGroups.set(mathGroup.id, mathGroup);
    this.teachingGroups.set(scienceGroup.id, scienceGroup);
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
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
      global_role: userData.global_role || null,
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

  // Schools - Not implemented in MemStorage (use DbStorage)
  async getAllSchools(): Promise<School[]> {
    throw new Error("Schools not implemented in MemStorage");
  }

  async getSchool(id: string): Promise<School | undefined> {
    throw new Error("Schools not implemented in MemStorage");
  }

  async createSchool(school: InsertSchool): Promise<School> {
    throw new Error("Schools not implemented in MemStorage");
  }

  async updateSchool(id: string, updates: Partial<School>): Promise<School | undefined> {
    throw new Error("Schools not implemented in MemStorage");
  }

  async deleteSchool(id: string): Promise<boolean> {
    throw new Error("Schools not implemented in MemStorage");
  }

  // School Memberships - Not implemented in MemStorage (use DbStorage)
  async getMembershipsBySchool(schoolId: string): Promise<SchoolMembership[]> {
    throw new Error("School memberships not implemented in MemStorage");
  }

  async getMembershipsByUser(userId: string): Promise<SchoolMembership[]> {
    throw new Error("School memberships not implemented in MemStorage");
  }

  async getMembership(id: string): Promise<SchoolMembership | undefined> {
    throw new Error("School memberships not implemented in MemStorage");
  }

  async getMembershipByUserAndSchool(userId: string, schoolId: string): Promise<SchoolMembership | undefined> {
    throw new Error("School memberships not implemented in MemStorage");
  }

  async createMembership(membership: InsertSchoolMembership): Promise<SchoolMembership> {
    throw new Error("School memberships not implemented in MemStorage");
  }

  async updateMembership(id: string, updates: Partial<SchoolMembership>): Promise<SchoolMembership | undefined> {
    throw new Error("School memberships not implemented in MemStorage");
  }

  async deleteMembership(id: string): Promise<boolean> {
    throw new Error("School memberships not implemented in MemStorage");
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
  
  // Meetings - Not implemented in MemStorage (use DbStorage)
  async getMeetingsBySchool(schoolId: string, membershipId?: string): Promise<Meeting[]> {
    throw new Error("Meetings not implemented in MemStorage");
  }

  async getMeeting(id: string): Promise<Meeting | undefined> {
    throw new Error("Meetings not implemented in MemStorage");
  }

  async createMeeting(meeting: InsertMeeting): Promise<Meeting> {
    throw new Error("Meetings not implemented in MemStorage");
  }

  async updateMeeting(id: string, updates: Partial<Meeting>): Promise<Meeting | undefined> {
    throw new Error("Meetings not implemented in MemStorage");
  }

  async deleteMeeting(id: string): Promise<boolean> {
    throw new Error("Meetings not implemented in MemStorage");
  }

  // Meeting Attendees - Not implemented in MemStorage (use DbStorage)
  async getAttendeesByMeeting(meetingId: string): Promise<MeetingAttendee[]> {
    throw new Error("Meeting attendees not implemented in MemStorage");
  }

  async createMeetingAttendee(attendee: InsertMeetingAttendee): Promise<MeetingAttendee> {
    throw new Error("Meeting attendees not implemented in MemStorage");
  }

  async deleteMeetingAttendee(id: string): Promise<boolean> {
    throw new Error("Meeting attendees not implemented in MemStorage");
  }

  // Meeting Actions - Not implemented in MemStorage (use DbStorage)
  async getActionsByMeeting(meetingId: string): Promise<MeetingAction[]> {
    throw new Error("Meeting actions not implemented in MemStorage");
  }

  async getMeetingAction(id: string): Promise<MeetingAction | undefined> {
    throw new Error("Meeting actions not implemented in MemStorage");
  }

  async createMeetingAction(action: InsertMeetingAction): Promise<MeetingAction> {
    throw new Error("Meeting actions not implemented in MemStorage");
  }

  async updateMeetingAction(id: string, updates: Partial<MeetingAction>): Promise<MeetingAction | undefined> {
    throw new Error("Meeting actions not implemented in MemStorage");
  }

  async deleteMeetingAction(id: string): Promise<boolean> {
    throw new Error("Meeting actions not implemented in MemStorage");
  }
  
  // Observations - Not implemented in MemStorage (use DbStorage)
  async getObservationsBySchool(schoolId: string): Promise<Observation[]> {
    throw new Error("Observations not implemented in MemStorage");
  }
  
  async getObservationsByTeacher(teacherId: string): Promise<Observation[]> {
    throw new Error("Observations not implemented in MemStorage");
  }
  
  async getObservation(id: string): Promise<Observation | undefined> {
    throw new Error("Observations not implemented in MemStorage");
  }
  
  async createObservation(observation: InsertObservation): Promise<Observation> {
    throw new Error("Observations not implemented in MemStorage");
  }
}

import { DbStorage } from "./db-storage";

export const storage = new DbStorage();
