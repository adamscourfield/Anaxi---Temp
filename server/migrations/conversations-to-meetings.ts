import { db } from "../db";
import { conversations, meetings, meetingAttendees, schoolMemberships, teachers } from "@shared/schema";
import { eq, and } from "drizzle-orm";

/**
 * Migration script to convert existing conversations to meetings
 * Run this once to migrate data from the legacy conversations table
 */
export async function migrateConversationsToMeetings() {
  console.log("Starting migration from conversations to meetings...");

  try {
    // Fetch all conversations
    const allConversations = await db.select().from(conversations);
    console.log(`Found ${allConversations.length} conversations to migrate`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const conversation of allConversations) {
      try {
        // Get the teacher record to find the associated user
        const teacher = await db
          .select()
          .from(teachers)
          .where(eq(teachers.id, conversation.teacherId))
          .limit(1);

        if (!teacher || teacher.length === 0) {
          console.warn(`Skipping conversation ${conversation.id}: Teacher ${conversation.teacherId} not found`);
          skippedCount++;
          continue;
        }

        const teacherRecord = teacher[0];

        // Create the meeting record
        const [meeting] = await db.insert(meetings).values({
          schoolId: conversation.schoolId,
          organizerId: teacherRecord.userId || '', // Use teacher's userId as organizer
          type: "two_person",
          subject: conversation.subject,
          details: conversation.details,
          rating: conversation.rating,
          minutes: conversation.details, // Copy details to minutes
          minutesAuthorId: teacherRecord.userId,
          scheduledAt: conversation.createdAt,
          createdAt: conversation.createdAt,
          updatedAt: conversation.createdAt,
        }).returning();

        // Find the school membership for the teacher
        if (teacherRecord.userId) {
          const membership = await db
            .select()
            .from(schoolMemberships)
            .where(and(
              eq(schoolMemberships.userId, teacherRecord.userId),
              eq(schoolMemberships.schoolId, conversation.schoolId)
            ))
            .limit(1);

          if (membership && membership.length > 0) {
            // Create attendee record for the teacher
            await db.insert(meetingAttendees).values({
              meetingId: meeting.id,
              membershipId: membership[0].id,
              attendeeRole: "Participant",
              attendanceStatus: "attended",
              isRequired: true,
              joinedAt: conversation.createdAt,
            });
          }
        }

        migratedCount++;
        if (migratedCount % 10 === 0) {
          console.log(`Migrated ${migratedCount} conversations...`);
        }
      } catch (error) {
        console.error(`Error migrating conversation ${conversation.id}:`, error);
        skippedCount++;
      }
    }

    console.log(`\nMigration completed!`);
    console.log(`Successfully migrated: ${migratedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`Total: ${allConversations.length}`);

    return { migrated: migratedCount, skipped: skippedCount, total: allConversations.length };
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateConversationsToMeetings()
    .then(() => {
      console.log("Migration complete. Exiting...");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
