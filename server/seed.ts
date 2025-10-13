import { db } from "./db";
import { sql, eq } from "drizzle-orm";
import { schools, teachers, teachingGroups, rubrics, categories, habits, conversations } from "@shared/schema";

async function seed() {
  console.log("🌱 Seeding database...");

  // Create a school
  const [school] = await db
    .insert(schools)
    .values({ name: "Springdale Academy" })
    .returning();
  console.log("✓ Created school:", school.name);

  // Create teaching groups
  const [englishGroup] = await db
    .insert(teachingGroups)
    .values({
      schoolId: school.id,
      name: "English Department",
      groupLeadId: null, // Will update after creating teachers
    })
    .returning();

  const [mathGroup] = await db
    .insert(teachingGroups)
    .values({
      schoolId: school.id,
      name: "Mathematics",
      groupLeadId: null,
    })
    .returning();

  const [scienceGroup] = await db
    .insert(teachingGroups)
    .values({
      schoolId: school.id,
      name: "Science Team",
      groupLeadId: null,
    })
    .returning();

  console.log("✓ Created teaching groups");

  // Create teachers
  const teacherData = [
    { name: "Sarah Mitchell", email: "sarah.mitchell@springdale.edu", groupId: englishGroup.id, role: "Admin" },
    { name: "James Chen", email: "james.chen@springdale.edu", groupId: mathGroup.id, role: "Leader" },
    { name: "Emily Rodriguez", email: "emily.rodriguez@springdale.edu", groupId: scienceGroup.id, role: "Leader" },
    { name: "Lisa Anderson", email: "lisa.anderson@springdale.edu", groupId: englishGroup.id, role: "Teacher" },
    { name: "Michael Brown", email: "michael.brown@springdale.edu", groupId: mathGroup.id, role: "Teacher" },
  ];

  const createdTeachers = await db
    .insert(teachers)
    .values(teacherData.map(t => ({ ...t, schoolId: school.id })))
    .returning();

  console.log(`✓ Created ${createdTeachers.length} teachers`);

  // Update teaching groups with group leads
  await db
    .update(teachingGroups)
    .set({ groupLeadId: createdTeachers[0].id })
    .where(eq(teachingGroups.id, englishGroup.id));

  await db
    .update(teachingGroups)
    .set({ groupLeadId: createdTeachers[1].id })
    .where(eq(teachingGroups.id, mathGroup.id));

  await db
    .update(teachingGroups)
    .set({ groupLeadId: createdTeachers[2].id })
    .where(eq(teachingGroups.id, scienceGroup.id));

  console.log("✓ Updated teaching group leads");

  // Create a default rubric
  const [rubric] = await db
    .insert(rubrics)
    .values({ schoolId: school.id, name: "Standard Teaching Rubric" })
    .returning();

  console.log("✓ Created rubric:", rubric.name);

  // Create categories
  const categoryData = [
    { name: "Entrance and Do Now", order: 1 },
    { name: "Direct Instruction", order: 2 },
    { name: "Behaviour Routines", order: 3 },
    { name: "Academic Talk", order: 4 },
    { name: "Checking for Understanding", order: 5 },
    { name: "Application", order: 6 },
    { name: "Exit Routine", order: 7 },
    { name: "Pace and Presence", order: 8 },
  ];

  const createdCategories = await db
    .insert(categories)
    .values(categoryData.map(c => ({ ...c, rubricId: rubric.id })))
    .returning();

  console.log(`✓ Created ${createdCategories.length} categories`);

  // Create habits for first category (Entrance and Do Now)
  const entranceCategory = createdCategories[0];
  const habitData = [
    { text: "Do Now on board or distributed.", description: "", order: 1 },
    { text: "Uniforms checked and corrected silently.", description: "Quietly scan each pupil's uniform as they enter and use discreet gestures.", order: 2 },
    { text: "Teacher positioned at threshold, greeting each pupil.", description: "", order: 3 },
    { text: "Countdown used.", description: "", order: 4 },
    { text: "Students working within 20 seconds.", description: "", order: 5 },
    { text: "Exercise books handed out by designated students.", description: "Confirm that your two pre-assigned book-handlers distribute exercise books quickly.", order: 6 },
    { text: "All students seated silently within 5 seconds.", description: "", order: 7 },
  ];

  await db
    .insert(habits)
    .values(habitData.map(h => ({ ...h, categoryId: entranceCategory.id })));

  console.log(`✓ Created ${habitData.length} habits for ${entranceCategory.name}`);

  // Create some sample conversations
  const conversationData = [
    {
      schoolId: school.id,
      teacherId: createdTeachers[0].id,
      subject: "Lesson Planning Best Practices",
      details: "Discussed effective strategies for differentiation in mixed-ability classrooms. Sarah shared her approach to scaffolding complex texts.",
      rating: "Best Practice",
    },
    {
      schoolId: school.id,
      teacherId: createdTeachers[1].id,
      subject: "Classroom Management Techniques",
      details: "Explored methods for maintaining student engagement during independent work time.",
      rating: "Neutral",
    },
    {
      schoolId: school.id,
      teacherId: createdTeachers[2].id,
      subject: "Assessment Strategies",
      details: "Reviewed formative assessment techniques and their impact on student learning outcomes.",
      rating: "Best Practice",
    },
  ];

  await db.insert(conversations).values(conversationData);

  console.log(`✓ Created ${conversationData.length} conversations`);

  console.log("✅ Seeding complete!");
}

seed()
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });
