import { db } from "./db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { 
  type User, 
  type InsertUser, 
  type SchoolMembership,
  type InsertSchoolMembership,
  type School,
  type InsertSchool,
  type TeachingGroup, 
  type InsertTeachingGroup, 
  type Conversation, 
  type InsertConversation,
  type Observation,
  type InsertObservation,
  type Meeting,
  type InsertMeeting,
  type MeetingAttendee,
  type InsertMeetingAttendee,
  type MeetingAction,
  type InsertMeetingAction,
  users,
  schoolMemberships,
  schools,
  teachingGroups,
  conversations,
  observations,
  meetings,
  meetingAttendees,
  meetingActions,
} from "@shared/schema";
import { type IStorage } from "./storage";

export class DbStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    console.log("[DB] getUserByEmail searching for email:", email);
    const [user] = await db.select().from(users).where(eq(users.email, email));
    console.log("[DB] getUserByEmail result:", user ? `Found user ${user.id}` : "No user found");
    return user;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.reset_token, token));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(userData: InsertUser): Promise<User> {
    console.log("[DB] createUser input:", { email: userData.email });
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    console.log("[DB] createUser result:", { id: user.id, email: user.email });
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    console.log("[DB] updateUser:", { id, updates });
    const [user] = await db
      .update(users)
      .set({ ...updates, updated_at: new Date() })
      .where(eq(users.id, id))
      .returning();
    console.log("[DB] updateUser result:", user ? `Updated user ${user.id}` : "No user found");
    return user;
  }

  // Schools
  async getAllSchools(): Promise<School[]> {
    return await db.select().from(schools);
  }

  async getSchool(id: string): Promise<School | undefined> {
    const [school] = await db.select().from(schools).where(eq(schools.id, id));
    return school;
  }

  async createSchool(insertSchool: InsertSchool): Promise<School> {
    const [school] = await db.insert(schools).values(insertSchool).returning();
    return school;
  }

  async updateSchool(id: string, updates: Partial<School>): Promise<School | undefined> {
    const [school] = await db.update(schools).set(updates).where(eq(schools.id, id)).returning();
    return school;
  }

  async deleteSchool(id: string): Promise<boolean> {
    const result = await db.delete(schools).where(eq(schools.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // School Memberships
  async getMembershipsBySchool(schoolId: string): Promise<SchoolMembership[]> {
    return await db.select().from(schoolMemberships).where(eq(schoolMemberships.schoolId, schoolId));
  }

  async getMembershipsByUser(userId: string): Promise<SchoolMembership[]> {
    return await db.select().from(schoolMemberships).where(eq(schoolMemberships.userId, userId));
  }

  async getMembership(id: string): Promise<SchoolMembership | undefined> {
    const [membership] = await db.select().from(schoolMemberships).where(eq(schoolMemberships.id, id));
    return membership;
  }

  async getMembershipByUserAndSchool(userId: string, schoolId: string): Promise<SchoolMembership | undefined> {
    const [membership] = await db
      .select()
      .from(schoolMemberships)
      .where(and(
        eq(schoolMemberships.userId, userId),
        eq(schoolMemberships.schoolId, schoolId)
      ));
    return membership;
  }

  async createMembership(insertMembership: InsertSchoolMembership): Promise<SchoolMembership> {
    const [membership] = await db.insert(schoolMemberships).values(insertMembership).returning();
    return membership;
  }

  async updateMembership(id: string, updates: Partial<SchoolMembership>): Promise<SchoolMembership | undefined> {
    const [membership] = await db.update(schoolMemberships).set(updates).where(eq(schoolMemberships.id, id)).returning();
    return membership;
  }

  async deleteMembership(id: string): Promise<boolean> {
    const result = await db.delete(schoolMemberships).where(eq(schoolMemberships.id, id));
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

  // Observations
  async getObservationsBySchool(schoolId: string): Promise<Observation[]> {
    return await db
      .select()
      .from(observations)
      .where(eq(observations.schoolId, schoolId))
      .orderBy(desc(observations.date));
  }

  async getObservationsByTeacher(teacherId: string): Promise<Observation[]> {
    return await db
      .select()
      .from(observations)
      .where(eq(observations.teacherId, teacherId))
      .orderBy(desc(observations.date));
  }

  async getObservation(id: string): Promise<Observation | undefined> {
    const [observation] = await db.select().from(observations).where(eq(observations.id, id));
    return observation;
  }

  async createObservation(insertObservation: InsertObservation): Promise<Observation> {
    const [observation] = await db.insert(observations).values(insertObservation).returning();
    return observation;
  }

  // Meetings
  async getMeetingsBySchool(schoolId: string, membershipId?: string): Promise<Meeting[]> {
    // If membershipId is provided, filter to only meetings where user is an attendee or organizer
    if (membershipId) {
      const userMembership = await db
        .select()
        .from(schoolMemberships)
        .where(eq(schoolMemberships.id, membershipId))
        .limit(1);
      
      if (userMembership.length === 0) {
        return [];
      }

      const userId = userMembership[0].userId;

      // Get meetings where user is organizer
      const organizedMeetings = await db
        .select()
        .from(meetings)
        .where(
          and(
            eq(meetings.schoolId, schoolId),
            eq(meetings.organizerId, userId)
          )
        )
        .orderBy(desc(meetings.createdAt));

      // Get meetings where user is an attendee
      const attendedMeetingIds = await db
        .select({ meetingId: meetingAttendees.meetingId })
        .from(meetingAttendees)
        .where(eq(meetingAttendees.membershipId, membershipId));

      if (attendedMeetingIds.length > 0) {
        const attendedMeetings = await db
          .select()
          .from(meetings)
          .where(
            and(
              eq(meetings.schoolId, schoolId),
              inArray(
                meetings.id,
                attendedMeetingIds.map((a) => a.meetingId)
              )
            )
          )
          .orderBy(desc(meetings.createdAt));

        // Merge and deduplicate
        const allMeetings = [...organizedMeetings, ...attendedMeetings];
        const uniqueMeetings = Array.from(
          new Map(allMeetings.map((m) => [m.id, m])).values()
        );
        return uniqueMeetings.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }

      return organizedMeetings;
    }

    // If no membershipId, return all meetings for the school (Creator access)
    return await db
      .select()
      .from(meetings)
      .where(eq(meetings.schoolId, schoolId))
      .orderBy(desc(meetings.createdAt));
  }

  async getMeeting(id: string): Promise<Meeting | undefined> {
    const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id));
    return meeting;
  }

  async createMeeting(insertMeeting: InsertMeeting): Promise<Meeting> {
    const [meeting] = await db.insert(meetings).values(insertMeeting).returning();
    return meeting;
  }

  async updateMeeting(id: string, updates: Partial<Meeting>): Promise<Meeting | undefined> {
    const [meeting] = await db
      .update(meetings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(meetings.id, id))
      .returning();
    return meeting;
  }

  async deleteMeeting(id: string): Promise<boolean> {
    const result = await db.delete(meetings).where(eq(meetings.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Meeting Attendees
  async getAttendeesByMeeting(meetingId: string): Promise<MeetingAttendee[]> {
    return await db
      .select()
      .from(meetingAttendees)
      .where(eq(meetingAttendees.meetingId, meetingId));
  }

  async createMeetingAttendee(insertAttendee: InsertMeetingAttendee): Promise<MeetingAttendee> {
    const [attendee] = await db.insert(meetingAttendees).values(insertAttendee).returning();
    return attendee;
  }

  async deleteMeetingAttendee(id: string): Promise<boolean> {
    const result = await db.delete(meetingAttendees).where(eq(meetingAttendees.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Meeting Actions
  async getActionsByMeeting(meetingId: string): Promise<MeetingAction[]> {
    return await db
      .select()
      .from(meetingActions)
      .where(eq(meetingActions.meetingId, meetingId))
      .orderBy(desc(meetingActions.createdAt));
  }

  async getMeetingAction(id: string): Promise<MeetingAction | undefined> {
    const [action] = await db.select().from(meetingActions).where(eq(meetingActions.id, id));
    return action;
  }

  async createMeetingAction(insertAction: InsertMeetingAction): Promise<MeetingAction> {
    const [action] = await db.insert(meetingActions).values(insertAction).returning();
    return action;
  }

  async updateMeetingAction(id: string, updates: Partial<MeetingAction>): Promise<MeetingAction | undefined> {
    const [action] = await db
      .update(meetingActions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(meetingActions.id, id))
      .returning();
    return action;
  }

  async deleteMeetingAction(id: string): Promise<boolean> {
    const result = await db.delete(meetingActions).where(eq(meetingActions.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
}
