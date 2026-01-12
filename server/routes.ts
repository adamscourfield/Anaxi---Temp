import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import { DbStorage } from "./db-storage";
import { db } from "./db";
import { sql, desc } from "drizzle-orm";
import { insertSchoolSchema, insertSchoolMembershipSchema, insertTeachingGroupSchema, insertDepartmentSchema, insertConversationSchema, insertMeetingSchema, insertMeetingAttendeeSchema, insertMeetingActionSchema, insertLeaveRequestSchema, insertObservationSchema, insertRubricSchema, insertCategorySchema, insertHabitSchema, meetingActions } from "@shared/schema";
import { z } from "zod";
import { toZonedTime } from "date-fns-tz";
import { getHours, getDay } from "date-fns";
// Referenced from blueprint:javascript_object_storage
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { setupAuth, isAuthenticated, hashPassword } from "./auth";
import { emailService } from "./email";

const storage = new DbStorage();

// Helper function to sanitize user data (remove sensitive fields)
function sanitizeUser(user: any) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    profile_image_url: user.profile_image_url,
    global_role: user.global_role,
    archived: user.archived,
    date_of_birth: user.date_of_birth,
  };
}

// Permission middleware
type Role = "Teacher" | "Leader" | "Admin";
type GlobalRole = "Creator";

// Middleware to require Creator global role
function requireCreator() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      
      if (!user) {
        return res.status(401).json({ message: "Unauthorized: No authenticated user" });
      }

      if (user.global_role !== "Creator") {
        return res.status(403).json({ 
          message: "Forbidden: Only Creators can perform this action" 
        });
      }

      (req as any).authUser = user;
      next();
    } catch (error) {
      console.error("Permission check error:", error);
      res.status(500).json({ message: "Permission check failed" });
    }
  };
}

function requireRole(allowedRoles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get user from authenticated session (set by isAuthenticated middleware)
      const user = (req as any).user;
      
      if (!user) {
        return res.status(401).json({ message: "Unauthorized: No authenticated user" });
      }

      // Creators have access to everything
      if (user.global_role === "Creator") {
        (req as any).authUser = user;
        return next();
      }

      // Get user's school memberships to check role
      const memberships = await storage.getMembershipsByUser(user.id);
      
      if (!memberships || memberships.length === 0) {
        return res.status(401).json({ message: "Unauthorized: No school memberships found" });
      }

      // Check if user has required role in ANY of their schools
      // This correctly handles multi-school users with different roles
      const matchingMembership = memberships.find(m => {
        const role = (m.role || "Teacher") as Role;
        return allowedRoles.includes(role);
      });
      
      if (!matchingMembership) {
        const userRole = (memberships[0].role || "Teacher") as Role;
        return res.status(403).json({ 
          message: `Forbidden: ${userRole}s are not allowed to perform this action. Required role: ${allowedRoles.join(" or ")}` 
        });
      }

      // Attach user info to request for later use
      (req as any).currentMembership = matchingMembership;
      (req as any).authUser = user;
      next();
    } catch (error) {
      console.error("Permission check error:", error);
      res.status(500).json({ message: "Permission check failed" });
    }
  };
}

// Middleware to require a specific feature to be enabled for the school
function requireFeature(featureName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Determine schoolId from query params, body, route params, or existing leave request/meeting
      let schoolId: string | undefined;
      
      // Try to get schoolId from route params first (for /api/schools/:schoolId/* patterns)
      schoolId = (req.params as any).schoolId;
      
      // If not in route params, try query params
      if (!schoolId) {
        schoolId = req.query.schoolId as string;
      }
      
      // If not in query, try request body
      if (!schoolId && req.body && req.body.schoolId) {
        schoolId = req.body.schoolId;
      }
      
      // If still not found and this is operating on/under an existing resource, get it from the resource
      if (!schoolId && req.params.id) {
        // For leave requests
        if (req.path.includes('/leave-requests/')) {
          const leaveRequest = await storage.getLeaveRequest(req.params.id);
          if (leaveRequest) {
            schoolId = leaveRequest.schoolId;
          }
        }
        // For on-calls
        else if (req.path.includes('/oncalls/')) {
          const oncall = await storage.getOncall(req.params.id);
          if (oncall) {
            schoolId = oncall.schoolId;
          }
        }
        // For meetings and meeting sub-resources (attendees, actions)
        else if (req.path.includes('/meetings/')) {
          const meeting = await storage.getMeeting(req.params.id);
          if (meeting) {
            schoolId = meeting.schoolId;
          }
        }
        // For observations
        else if (req.path.includes('/observations/')) {
          const observation = await storage.getObservation(req.params.id);
          if (observation) {
            schoolId = observation.schoolId;
          }
        }
        // For students
        else if (req.path.includes('/students/')) {
          const student = await storage.getStudent(req.params.id);
          if (student) {
            schoolId = student.schoolId;
          }
        }
      }
      
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required to verify feature access" });
      }
      
      // Get the school to check enabled features
      const school = await storage.getSchool(schoolId);
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }
      
      // Check if the feature is enabled
      const enabledFeatures = school.enabled_features || [];
      if (!enabledFeatures.includes(featureName)) {
        return res.status(403).json({ 
          message: `Forbidden: The '${featureName}' feature is not enabled for this school` 
        });
      }
      
      next();
    } catch (error) {
      console.error("Feature check error:", error);
      res.status(500).json({ message: "Feature check failed" });
    }
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware - Referenced from blueprint:javascript_log_in_with_replit
  await setupAuth(app);

  // School management routes
  // Get schools (Creator sees all, Admin sees their schools)
  app.get("/api/schools", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Creators can see all schools
      if (user.global_role === "Creator") {
        const schools = await storage.getAllSchools();
        return res.json(schools);
      }

      // Admins can see schools they manage
      const userMemberships = await storage.getMembershipsByUser(user.id);
      const isAdmin = userMemberships.some(m => m.role === "Admin");
      
      if (!isAdmin) {
        return res.status(403).json({ message: "Forbidden: Only Admins or Creators can view schools" });
      }

      // Get schools where user is Admin
      const adminSchoolIds = userMemberships
        .filter(m => m.role === "Admin")
        .map(m => m.schoolId);
      
      const allSchools = await storage.getAllSchools();
      const adminSchools = allSchools.filter(s => adminSchoolIds.includes(s.id));
      
      res.json(adminSchools);
    } catch (error) {
      console.error("Error fetching schools:", error);
      res.status(500).json({ message: "Failed to fetch schools" });
    }
  });

  app.post("/api/schools", isAuthenticated, requireCreator(), async (req, res) => {
    try {
      const validated = insertSchoolSchema.parse(req.body);
      const school = await storage.createSchool(validated);
      res.status(201).json(school);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid school data", errors: error.errors });
      }
      console.error("Error creating school:", error);
      res.status(500).json({ message: "Failed to create school" });
    }
  });

  app.patch("/api/schools/:id", isAuthenticated, requireCreator(), async (req, res) => {
    try {
      const { id } = req.params;
      const school = await storage.updateSchool(id, req.body);
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }
      res.json(school);
    } catch (error) {
      console.error("Error updating school:", error);
      res.status(500).json({ message: "Failed to update school" });
    }
  });

  app.delete("/api/schools/:id", isAuthenticated, requireCreator(), async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteSchool(id);
      if (!deleted) {
        return res.status(404).json({ message: "School not found" });
      }
      res.json({ message: "School deleted successfully" });
    } catch (error) {
      console.error("Error deleting school:", error);
      res.status(500).json({ message: "Failed to delete school" });
    }
  });

  // Get current user's memberships (with school details)
  app.get("/api/my-memberships", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const memberships = await storage.getMembershipsByUser(user.id);
      
      // Enrich memberships with school details
      const enrichedMemberships = await Promise.all(
        memberships.map(async (m) => {
          const school = await storage.getSchool(m.schoolId);
          return { ...m, school };
        })
      );
      
      res.json(enrichedMemberships);
    } catch (error) {
      console.error("Error fetching user memberships:", error);
      res.status(500).json({ message: "Failed to fetch memberships" });
    }
  });

  // School membership routes
  app.get("/api/schools/:schoolId/memberships", isAuthenticated, async (req: any, res) => {
    try {
      const { schoolId } = req.params;
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Creators can see all memberships
      if (user.global_role === "Creator") {
        const memberships = await storage.getMembershipsBySchool(schoolId);
        
        // Enrich with user data
        const membershipsWithUsers = await Promise.all(
          memberships.map(async (m) => {
            const memberUser = await storage.getUser(m.userId);
            return {
              ...m,
              user: memberUser ? {
                id: memberUser.id,
                email: memberUser.email,
                first_name: memberUser.first_name,
                last_name: memberUser.last_name,
              } : null,
            };
          })
        );
        
        return res.json(membershipsWithUsers);
      }

      // Check if user has Admin role in this school
      const userMembership = await storage.getMembershipByUserAndSchool(user.id, schoolId);
      if (!userMembership) {
        return res.status(403).json({ message: "Forbidden: You don't have access to this school" });
      }

      if (userMembership.role !== "Admin") {
        return res.status(403).json({ message: "Forbidden: Only administrators can view memberships" });
      }

      const memberships = await storage.getMembershipsBySchool(schoolId);
      
      // Enrich with user data
      const membershipsWithUsers = await Promise.all(
        memberships.map(async (m) => {
          const memberUser = await storage.getUser(m.userId);
          return {
            ...m,
            user: memberUser ? {
              id: memberUser.id,
              email: memberUser.email,
              first_name: memberUser.first_name,
              last_name: memberUser.last_name,
            } : null,
          };
        })
      );
      
      res.json(membershipsWithUsers);
    } catch (error) {
      console.error("Error fetching memberships:", error);
      res.status(500).json({ message: "Failed to fetch memberships" });
    }
  });

  app.post("/api/schools/:schoolId/memberships", isAuthenticated, async (req: any, res) => {
    try {
      const { schoolId } = req.params;
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Creators can create memberships in any school
      if (user.global_role !== "Creator") {
        // Regular users must be Admin in this school to create memberships
        const userMembership = await storage.getMembershipByUserAndSchool(user.id, schoolId);
        if (!userMembership || userMembership.role !== "Admin") {
          return res.status(403).json({ message: "Forbidden: You must be an Admin in this school" });
        }
      }

      const membershipData = {
        ...req.body,
        schoolId,
      };
      const validated = insertSchoolMembershipSchema.parse(membershipData);
      const membership = await storage.createMembership(validated);
      res.status(201).json(membership);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid membership data", errors: error.errors });
      }
      console.error("Error creating membership:", error);
      res.status(500).json({ message: "Failed to create membership" });
    }
  });

  app.patch("/api/memberships/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get the membership to check school
      const membership = await storage.getMembership(id);
      if (!membership) {
        return res.status(404).json({ message: "Membership not found" });
      }

      // Creators can update any membership
      if (user.global_role !== "Creator") {
        // Regular users must be Admin in the school to update memberships
        const userMembership = await storage.getMembershipByUserAndSchool(user.id, membership.schoolId);
        if (!userMembership || userMembership.role !== "Admin") {
          return res.status(403).json({ message: "Forbidden: You must be an Admin in this school" });
        }
      }

      // Validate update payload
      const updateSchema = z.object({
        role: z.string().optional(),
        displayName: z.string().optional(),
        profilePicture: z.string().optional(),
        groupId: z.string().optional(),
        canApproveLeaveRequests: z.boolean().optional(),
        canManageBehaviour: z.boolean().optional(),
      });

      const validatedData = updateSchema.parse(req.body);
      const updated = await storage.updateMembership(id, validatedData);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      console.error("Error updating membership:", error);
      res.status(500).json({ message: "Failed to update membership" });
    }
  });

  app.delete("/api/memberships/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get the membership to check school
      const membership = await storage.getMembership(id);
      if (!membership) {
        return res.status(404).json({ message: "Membership not found" });
      }

      // Creators can delete any membership
      if (user.global_role !== "Creator") {
        // Regular users must be Admin in the school to delete memberships
        const userMembership = await storage.getMembershipByUserAndSchool(user.id, membership.schoolId);
        if (!userMembership || userMembership.role !== "Admin") {
          return res.status(403).json({ message: "Forbidden: You must be an Admin in this school" });
        }
      }

      const deleted = await storage.deleteMembership(id);
      res.json({ message: "Membership deleted successfully" });
    } catch (error) {
      console.error("Error deleting membership:", error);
      res.status(500).json({ message: "Failed to delete membership" });
    }
  });

  // Get memberships for a specific user (Admin/Creator only)
  app.get("/api/users/:userId/memberships", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const targetMemberships = await storage.getMembershipsByUser(userId);

      // Creators can view all memberships
      if (user.global_role === "Creator") {
        return res.json(targetMemberships);
      }

      // Admins can only view memberships for schools they manage
      const userMemberships = await storage.getMembershipsByUser(user.id);
      const adminSchoolIds = userMemberships
        .filter(m => m.role === "Admin")
        .map(m => m.schoolId);

      if (adminSchoolIds.length === 0) {
        return res.status(403).json({ message: "Forbidden: Only Admins or Creators can view user memberships" });
      }

      // Filter target memberships to only include schools the Admin manages
      const filteredMemberships = targetMemberships.filter(m => 
        adminSchoolIds.includes(m.schoolId)
      );

      res.json(filteredMemberships);
    } catch (error) {
      console.error("Error fetching user memberships:", error);
      res.status(500).json({ message: "Failed to fetch user memberships" });
    }
  });

  // Teacher management routes (Admin/Creator only)
  // Get all teachers (users) with their school memberships
  app.get("/api/users/teachers", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Only Admin or Creator can view all teachers
      if (user.global_role !== "Creator") {
        // Check if user has Admin role in any school
        const userMemberships = await storage.getMembershipsByUser(user.id);
        const isAdmin = userMemberships.some(m => m.role === "Admin");
        if (!isAdmin) {
          return res.status(403).json({ message: "Forbidden: Only Admins or Creators can view teachers" });
        }
      }

      const includeArchived = req.query.includeArchived === "true";
      
      // Only Creators can view archived users
      if (includeArchived && user.global_role !== "Creator") {
        return res.status(403).json({ message: "Forbidden: Only Creators can view archived users" });
      }

      const users = await storage.getAllUsers();
      // Filter out archived users unless specifically requested by Creator
      const filteredUsers = includeArchived ? users : users.filter(u => !u.archived);
      res.json(filteredUsers.map(sanitizeUser));
    } catch (error) {
      console.error("Error fetching teachers:", error);
      res.status(500).json({ message: "Failed to fetch teachers" });
    }
  });

  // Create a new teacher (user account)
  app.post("/api/users/teachers", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Only Admin or Creator can create teachers
      if (user.global_role !== "Creator") {
        const userMemberships = await storage.getMembershipsByUser(user.id);
        const isAdmin = userMemberships.some(m => m.role === "Admin");
        if (!isAdmin) {
          return res.status(403).json({ message: "Forbidden: Only Admins or Creators can create teachers" });
        }
      }

      const { email, first_name, last_name, schoolIds, role } = req.body;

      // Validate required fields
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // Generate password setup token
      const setupToken = crypto.randomBytes(32).toString('hex');
      const setupTokenExpires = new Date();
      setupTokenExpires.setDate(setupTokenExpires.getDate() + 7); // Token expires in 7 days

      // Create user account without password (will be set via email link)
      const newUser = await storage.createUser({
        email,
        password_hash: null,
        first_name: first_name || null,
        last_name: last_name || null,
        global_role: null,
        password_setup_token: setupToken,
        password_setup_token_expires: setupTokenExpires,
      });

      // Create school memberships if schoolIds provided
      let primarySchoolName = "Anaxi";
      if (schoolIds && Array.isArray(schoolIds) && schoolIds.length > 0) {
        for (const schoolId of schoolIds) {
          await storage.createMembership({
            userId: newUser.id,
            schoolId,
            role: role || "Teacher",
          });
        }
        // Get the first school's name for the welcome email
        const firstSchool = await storage.getSchool(schoolIds[0]);
        if (firstSchool) {
          primarySchoolName = firstSchool.name;
        }
      }

      // Send welcome email with password setup link (fire and forget)
      void (async () => {
        try {
          const userName = `${first_name || ''} ${last_name || ''}`.trim() || email || 'there';
          
          await emailService.sendWelcomeEmail({
            to: email,
            userName,
            schoolName: primarySchoolName,
            setupToken,
          });
        } catch (error) {
          console.error("[EMAIL] Failed to send welcome email:", error);
        }
      })();

      res.status(201).json(sanitizeUser(newUser));
    } catch (error) {
      console.error("Error creating teacher:", error);
      res.status(500).json({ message: "Failed to create teacher" });
    }
  });

  // Bulk import teachers from CSV
  app.post("/api/users/teachers/import-csv", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Only Admin or Creator can import teachers
      if (user.global_role !== "Creator") {
        const userMemberships = await storage.getMembershipsByUser(user.id);
        const isAdmin = userMemberships.some(m => m.role === "Admin");
        if (!isAdmin) {
          return res.status(403).json({ message: "Forbidden: Only Admins or Creators can import teachers" });
        }
      }

      const { teachers } = req.body;

      if (!teachers || !Array.isArray(teachers)) {
        return res.status(400).json({ message: "Invalid CSV data. Expected an array of teachers." });
      }

      const results = {
        success: [] as any[],
        errors: [] as any[],
      };

      for (const teacherData of teachers) {
        try {
          const { email, first_name, last_name, schoolIds, role } = teacherData;

          // Validate required fields
          if (!email) {
            results.errors.push({
              email: email || "unknown",
              error: "Email is required",
            });
            continue;
          }

          // Check if user already exists
          const existingUser = await storage.getUserByEmail(email);
          if (existingUser) {
            results.errors.push({
              email,
              error: "User with this email already exists",
            });
            continue;
          }

          // Generate password setup token
          const setupToken = crypto.randomBytes(32).toString('hex');
          const setupTokenExpires = new Date();
          setupTokenExpires.setDate(setupTokenExpires.getDate() + 7); // Token expires in 7 days

          // Create user account without password (will be set via email link)
          const newUser = await storage.createUser({
            email,
            password_hash: null,
            first_name: first_name || null,
            last_name: last_name || null,
            global_role: null,
            password_setup_token: setupToken,
            password_setup_token_expires: setupTokenExpires,
          });

          // Create school memberships
          let primarySchoolName = "Anaxi";
          if (schoolIds && Array.isArray(schoolIds) && schoolIds.length > 0) {
            for (const schoolId of schoolIds) {
              await storage.createMembership({
                userId: newUser.id,
                schoolId,
                role: role || "Teacher",
              });
            }
            // Get the first school's name for the welcome email
            const firstSchool = await storage.getSchool(schoolIds[0]);
            if (firstSchool) {
              primarySchoolName = firstSchool.name;
            }
          }

          // Send welcome email with password setup link (fire and forget)
          void (async () => {
            try {
              const userName = `${first_name || ''} ${last_name || ''}`.trim() || email || 'there';
              
              await emailService.sendWelcomeEmail({
                to: email,
                userName,
                schoolName: primarySchoolName,
                setupToken,
              });
            } catch (error) {
              console.error("[EMAIL] Failed to send welcome email:", error);
            }
          })();

          results.success.push({
            email: newUser.email,
            id: newUser.id,
          });
        } catch (error: any) {
          results.errors.push({
            email: teacherData.email || "unknown",
            error: error.message || "Failed to create teacher",
          });
        }
      }

      res.json(results);
    } catch (error) {
      console.error("Error importing teachers:", error);
      res.status(500).json({ message: "Failed to import teachers" });
    }
  });

  // Update teacher information
  app.patch("/api/users/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const { userId } = req.params;
      
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Users can update their own profile, or Admin/Creator can update others
      const isOwnProfile = user.id === userId;
      if (!isOwnProfile && user.global_role !== "Creator") {
        const userMemberships = await storage.getMembershipsByUser(user.id);
        const isAdmin = userMemberships.some(m => m.role === "Admin");
        if (!isAdmin) {
          return res.status(403).json({ message: "Forbidden: You can only update your own profile" });
        }
      }

      const { name, first_name, last_name, email, profile_image_url, date_of_birth } = req.body;

      // Parse name into first_name and last_name if provided
      let firstName = first_name;
      let lastName = last_name;
      if (name && !first_name && !last_name) {
        const nameParts = name.trim().split(/\s+/);
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(" ");
      }

      // Check if email is being changed and if it's already in use
      if (email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ message: "Email is already in use by another user" });
        }
      }

      // Update user
      const updatedUser = await storage.updateUser(userId, {
        first_name: firstName !== undefined ? firstName : undefined,
        last_name: lastName !== undefined ? lastName : undefined,
        email: email !== undefined ? email : undefined,
        profile_image_url: profile_image_url !== undefined ? profile_image_url : undefined,
        date_of_birth: date_of_birth !== undefined ? date_of_birth : undefined,
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(sanitizeUser(updatedUser));
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Update teacher school assignments
  app.post("/api/users/:userId/schools", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const { userId } = req.params;
      const { schoolIds, role } = req.body;
      
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Only Admin or Creator can manage school assignments
      if (user.global_role !== "Creator") {
        const userMemberships = await storage.getMembershipsByUser(user.id);
        const isAdmin = userMemberships.some(m => m.role === "Admin");
        if (!isAdmin) {
          return res.status(403).json({ message: "Forbidden: Only Admins or Creators can manage school assignments" });
        }
      }

      if (!schoolIds || !Array.isArray(schoolIds)) {
        return res.status(400).json({ message: "schoolIds must be an array" });
      }

      // Get existing memberships
      const existingMemberships = await storage.getMembershipsByUser(userId);
      
      // Remove memberships that are not in the new schoolIds
      for (const membership of existingMemberships) {
        if (!schoolIds.includes(membership.schoolId)) {
          await storage.deleteMembership(membership.id);
        }
      }

      // Add new memberships
      for (const schoolId of schoolIds) {
        const exists = existingMemberships.find(m => m.schoolId === schoolId);
        if (!exists) {
          await storage.createMembership({
            userId,
            schoolId,
            role: role || "Teacher",
          });
        }
      }

      res.json({ message: "School assignments updated successfully" });
    } catch (error) {
      console.error("Error updating school assignments:", error);
      res.status(500).json({ message: "Failed to update school assignments" });
    }
  });

  // Archive user (Creator only)
  app.post("/api/users/:userId/archive", isAuthenticated, requireCreator(), async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Update user to archived status
      const updatedUser = await storage.updateUser(userId, { archived: true });
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ message: "User archived successfully", user: sanitizeUser(updatedUser) });
    } catch (error) {
      console.error("Error archiving user:", error);
      res.status(500).json({ message: "Failed to archive user" });
    }
  });

  // Unarchive user (Creator only)
  app.post("/api/users/:userId/unarchive", isAuthenticated, requireCreator(), async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      // Update user to unarchived status
      const updatedUser = await storage.updateUser(userId, { archived: false });
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ message: "User unarchived successfully", user: sanitizeUser(updatedUser) });
    } catch (error) {
      console.error("Error unarchiving user:", error);
      res.status(500).json({ message: "Failed to unarchive user" });
    }
  });

  // Teaching Groups routes
  app.get("/api/teaching-groups", isAuthenticated, async (req, res) => {
    const schoolId = req.query.schoolId as string;
    if (!schoolId) {
      return res.status(400).json({ message: "School ID is required" });
    }
    
    const groups = await storage.getTeachingGroupsBySchool(schoolId);
    res.json(groups);
  });

  app.post("/api/teaching-groups", requireRole(["Admin"]), async (req, res) => {
    try {
      const validated = insertTeachingGroupSchema.parse(req.body);
      const group = await storage.createTeachingGroup(validated);
      res.status(201).json(group);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid group data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create teaching group" });
    }
  });

  app.patch("/api/teaching-groups/:id", requireRole(["Admin"]), async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const updatedGroup = await storage.updateTeachingGroup(id, updates);
      if (!updatedGroup) {
        return res.status(404).json({ message: "Teaching group not found" });
      }
      
      res.json(updatedGroup);
    } catch (error) {
      res.status(500).json({ message: "Failed to update teaching group" });
    }
  });

  app.delete("/api/teaching-groups/:id", requireRole(["Admin"]), async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteTeachingGroup(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Teaching group not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete teaching group" });
    }
  });

  // Departments routes
  app.get("/api/schools/:schoolId/departments", isAuthenticated, async (req, res) => {
    try {
      const { schoolId } = req.params;
      const user = (req as any).user;
      
      // Verify user has access to this school
      if (user.global_role !== "Creator") {
        const userMemberships = await storage.getMembershipsByUser(user.id);
        const membership = userMemberships.find(m => m.schoolId === schoolId);
        
        if (!membership) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this school" });
        }
      }
      
      const departments = await storage.getDepartmentsBySchool(schoolId);
      res.json(departments);
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({ message: "Failed to fetch departments" });
    }
  });

  app.post("/api/schools/:schoolId/departments", isAuthenticated, async (req, res) => {
    try {
      const { schoolId } = req.params;
      const user = (req as any).user;
      
      // Verify user is Admin or Creator in this specific school
      if (user.global_role !== "Creator") {
        const userMemberships = await storage.getMembershipsByUser(user.id);
        const membership = userMemberships.find(m => m.schoolId === schoolId);
        
        if (!membership) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this school" });
        }
        
        if (membership.role !== "Admin") {
          return res.status(403).json({ message: "Forbidden: Only Admins can create departments" });
        }
      }
      
      const validated = insertDepartmentSchema.parse({
        ...req.body,
        schoolId,
      });
      
      const department = await storage.createDepartment(validated);
      res.status(201).json(department);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid department data", errors: error.errors });
      }
      console.error("Error creating department:", error);
      res.status(500).json({ message: "Failed to create department" });
    }
  });

  app.patch("/api/departments/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      
      // Get the department to verify school access
      const department = await storage.getDepartment(id);
      if (!department) {
        return res.status(404).json({ message: "Department not found" });
      }
      
      // Verify user is Admin or Creator in this department's school
      if (user.global_role !== "Creator") {
        const userMemberships = await storage.getMembershipsByUser(user.id);
        const membership = userMemberships.find(m => m.schoolId === department.schoolId);
        
        if (!membership) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this school" });
        }
        
        if (membership.role !== "Admin") {
          return res.status(403).json({ message: "Forbidden: Only Admins can update departments" });
        }
      }
      
      const updates = req.body;
      const updatedDepartment = await storage.updateDepartment(id, updates);
      
      if (!updatedDepartment) {
        return res.status(404).json({ message: "Department not found" });
      }
      
      res.json(updatedDepartment);
    } catch (error) {
      console.error("Error updating department:", error);
      res.status(500).json({ message: "Failed to update department" });
    }
  });

  app.delete("/api/departments/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      
      // Get the department to verify school access
      const department = await storage.getDepartment(id);
      if (!department) {
        return res.status(404).json({ message: "Department not found" });
      }
      
      // Verify user is Admin or Creator in this department's school
      if (user.global_role !== "Creator") {
        const userMemberships = await storage.getMembershipsByUser(user.id);
        const membership = userMemberships.find(m => m.schoolId === department.schoolId);
        
        if (!membership) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this school" });
        }
        
        if (membership.role !== "Admin") {
          return res.status(403).json({ message: "Forbidden: Only Admins can delete departments" });
        }
      }
      
      const deleted = await storage.deleteDepartment(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Department not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting department:", error);
      res.status(500).json({ message: "Failed to delete department" });
    }
  });

  // Conversations routes
  app.get("/api/conversations", isAuthenticated, async (req, res) => {
    const schoolId = req.query.schoolId as string;
    if (!schoolId) {
      return res.status(400).json({ message: "School ID is required" });
    }
    
    const conversations = await storage.getConversationsBySchool(schoolId);
    res.json(conversations);
  });

  app.post("/api/conversations", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const validated = insertConversationSchema.parse(req.body);
      const conversation = await storage.createConversation(validated);
      
      // Send email notification to the staff member (fire and forget - errors handled internally)
      void (async () => {
        try {
          const staffMember = await storage.getMembership(validated.staffMemberId);
          const staffUser = await storage.getUser(staffMember.userId);
          
          if (staffUser?.email) {
            const staffName = `${staffUser.first_name || ''} ${staffUser.last_name || ''}`.trim() || staffUser.email;
            
            await emailService.sendConversationNotification({
              to: staffUser.email,
              staffMemberName: staffName,
              conversationSubject: validated.subject,
              rating: validated.rating,
              conversationId: conversation.id,
            });
          }
        } catch (error) {
          // Email errors are logged in emailService.safeSendEmail
        }
      })();
      
      res.status(201).json(conversation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid conversation data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  // Meetings routes
  app.get("/api/meetings", isAuthenticated, requireFeature("meetings"), async (req, res) => {
    try {
      const user = req.user!;
      const schoolId = req.query.schoolId as string;
      
      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }
      
      // Verify user has access to this school and get their membership
      let userMembershipId: string | undefined;
      
      if (user.global_role !== "Creator") {
        const userMemberships = await storage.getMembershipsByUser(user.id);
        const membership = userMemberships.find(m => m.schoolId === schoolId);
        
        if (!membership) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this school" });
        }
        
        userMembershipId = membership.id;
      }
      
      // Pass membershipId to filter meetings (undefined for Creators = see all)
      const meetings = await storage.getMeetingsBySchool(schoolId, userMembershipId);
      
      // Enrich meetings with attendee information
      const meetingsWithAttendees = await Promise.all(
        meetings.map(async (meeting) => {
          const attendees = await storage.getAttendeesByMeeting(meeting.id);
          console.log(`Meeting ${meeting.id} has ${attendees.length} attendees`);
          
          // Get user details for each attendee
          const attendeeDetails = await Promise.all(
            attendees.map(async (attendee) => {
              const membership = await storage.getMembership(attendee.membershipId);
              if (!membership) {
                console.log(`No membership found for attendee ${attendee.id}`);
                return null;
              }
              
              const user = await storage.getUser(membership.userId);
              if (!user) {
                console.log(`No user found for membership ${membership.id}`);
                return null;
              }
              
              const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
              console.log(`Attendee: ${name}`);
              
              return {
                id: attendee.id,
                name,
                email: user.email,
                userId: user.id,
                attendanceStatus: attendee.attendanceStatus,
              };
            })
          );
          
          const filtered = attendeeDetails.filter((a): a is NonNullable<typeof a> => a !== null);
          console.log(`Meeting ${meeting.id} final attendees count: ${filtered.length}`);
          
          return {
            ...meeting,
            attendees: filtered,
          };
        })
      );
      
      res.json(meetingsWithAttendees);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch meetings" });
    }
  });

  app.get("/api/meetings/:id", isAuthenticated, requireFeature("meetings"), async (req, res) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const meeting = await storage.getMeeting(id);
      
      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      
      // Verify user has access to the meeting's school
      if (user.global_role !== "Creator") {
        const userMemberships = await storage.getMembershipsByUser(user.id);
        const hasAccess = userMemberships.some(m => m.schoolId === meeting.schoolId);
        
        if (!hasAccess) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this meeting" });
        }
      }
      
      // Enrich meeting with organizer name
      let organizerName = null;
      if (meeting.organizerId) {
        const organizer = await storage.getUser(meeting.organizerId);
        if (organizer) {
          organizerName = `${organizer.first_name || ''} ${organizer.last_name || ''}`.trim() || organizer.email;
        }
      }
      
      // Enrich meeting with department name
      let departmentName = null;
      if (meeting.departmentId) {
        const department = await storage.getDepartment(meeting.departmentId);
        if (department) {
          departmentName = department.name;
        }
      }
      
      res.json({
        ...meeting,
        organizerName,
        departmentName,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch meeting" });
    }
  });

  app.post("/api/meetings", isAuthenticated, requireFeature("meetings"), async (req, res) => {
    try {
      const user = req.user!;
      const validated = insertMeetingSchema.parse(req.body);
      
      // Verify user has access to the school they're creating a meeting for
      if (user.global_role !== "Creator") {
        const userMemberships = await storage.getMembershipsByUser(user.id);
        const hasAccess = userMemberships.some(m => m.schoolId === validated.schoolId);
        
        if (!hasAccess) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this school" });
        }
      }
      
      const meeting = await storage.createMeeting(validated);
      
      // Automatically add the creator as an attendee
      try {
        const userMemberships = await storage.getMembershipsByUser(user.id);
        const creatorMembership = userMemberships.find(m => m.schoolId === validated.schoolId);
        
        if (creatorMembership) {
          await storage.createMeetingAttendee({
            meetingId: meeting.id,
            membershipId: creatorMembership.id,
            attendeeRole: "Organizer",
            attendanceStatus: "attended",
            isRequired: true,
          });
        }
      } catch (error) {
        console.error("[ERROR] Failed to add creator as attendee:", error);
        // Don't fail the meeting creation if adding creator as attendee fails
      }
      
      // Send email notifications to attendees (fire and forget - errors handled internally)
      void (async () => {
        try {
          if (validated.attendeeIds && validated.attendeeIds.length > 0) {
            const attendeeEmails: string[] = [];
            for (const membershipId of validated.attendeeIds) {
              const membership = await storage.getMembership(membershipId);
              const attendeeUser = await storage.getUser(membership.userId);
              if (attendeeUser?.email) {
                attendeeEmails.push(attendeeUser.email);
              }
            }
            
            if (attendeeEmails.length > 0) {
              const organizerName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'A colleague';
              const meetingDate = new Date(validated.meetingDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              });
              
              await emailService.sendMeetingInvitation({
                to: attendeeEmails,
                organizerName,
                meetingType: validated.type,
                meetingSubject: validated.subject,
                meetingDate,
                meetingId: meeting.id,
              });
            }
          }
        } catch (error) {
          // Email errors are logged in emailService.safeSendEmail
        }
      })();
      
      res.status(201).json(meeting);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid meeting data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create meeting" });
    }
  });

  app.patch("/api/meetings/:id", isAuthenticated, requireFeature("meetings"), async (req, res) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const updates = req.body;
      
      // First, get the meeting to verify access
      const existingMeeting = await storage.getMeeting(id);
      if (!existingMeeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      
      // Verify user has access to the meeting's school
      if (user.global_role !== "Creator") {
        const userMemberships = await storage.getMembershipsByUser(user.id);
        const hasAccess = userMemberships.some(m => m.schoolId === existingMeeting.schoolId);
        
        if (!hasAccess) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this meeting" });
        }
      }
      
      const meeting = await storage.updateMeeting(id, updates);
      res.json(meeting);
    } catch (error) {
      res.status(500).json({ message: "Failed to update meeting" });
    }
  });

  app.delete("/api/meetings/:id", isAuthenticated, requireFeature("meetings"), async (req, res) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      
      // First, get the meeting to verify access
      const existingMeeting = await storage.getMeeting(id);
      if (!existingMeeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      
      // Verify user has access to the meeting's school
      if (user.global_role !== "Creator") {
        const userMemberships = await storage.getMembershipsByUser(user.id);
        const hasAccess = userMemberships.some(m => m.schoolId === existingMeeting.schoolId);
        
        if (!hasAccess) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this meeting" });
        }
      }
      
      const deleted = await storage.deleteMeeting(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete meeting" });
    }
  });

  // Meeting attendees routes
  app.get("/api/meetings/:id/attendees", isAuthenticated, requireFeature("meetings"), async (req, res) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      
      // Verify user has access to the meeting's school
      const meeting = await storage.getMeeting(id);
      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      
      if (user.global_role !== "Creator") {
        const userMemberships = await storage.getMembershipsByUser(user.id);
        const hasAccess = userMemberships.some(m => m.schoolId === meeting.schoolId);
        
        if (!hasAccess) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this meeting" });
        }
      }
      
      const attendees = await storage.getAttendeesByMeeting(id);
      
      // Enrich attendees with user information
      const enrichedAttendees = await Promise.all(
        attendees.map(async (attendee) => {
          const membership = await storage.getMembership(attendee.membershipId);
          if (!membership) return null;
          
          const attendeeUser = await storage.getUser(membership.userId);
          if (!attendeeUser) return null;
          
          const name = `${attendeeUser.first_name || ''} ${attendeeUser.last_name || ''}`.trim() || attendeeUser.email;
          
          return {
            id: attendee.id,
            name,
            email: attendeeUser.email,
            userId: attendeeUser.id,
            role: membership.role,
            attendeeRole: attendee.attendeeRole,
            attendanceStatus: attendee.attendanceStatus,
            isRequired: attendee.isRequired,
            joinedAt: attendee.joinedAt,
          };
        })
      );
      
      res.json(enrichedAttendees.filter(a => a !== null));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch attendees" });
    }
  });

  app.post("/api/meetings/:id/attendees", isAuthenticated, requireFeature("meetings"), async (req, res) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      
      // Verify user has access to the meeting's school
      const meeting = await storage.getMeeting(id);
      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      
      if (user.global_role !== "Creator") {
        const userMemberships = await storage.getMembershipsByUser(user.id);
        const hasAccess = userMemberships.some(m => m.schoolId === meeting.schoolId);
        
        if (!hasAccess) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this meeting" });
        }
      }
      
      console.log("[DEBUG] Creating attendee for meeting:", id);
      console.log("[DEBUG] Request body:", JSON.stringify(req.body, null, 2));
      
      // Prepare the attendee data with defaults
      const attendeeData = {
        meetingId: id,
        membershipId: req.body.membershipId,
        attendeeRole: req.body.attendeeRole || null,
        attendanceStatus: req.body.attendanceStatus || "pending",
        isRequired: req.body.isRequired !== undefined ? req.body.isRequired : true,
        joinedAt: req.body.joinedAt || null,
      };
      
      console.log("[DEBUG] Prepared attendee data:", JSON.stringify(attendeeData, null, 2));
      
      const validated = insertMeetingAttendeeSchema.parse(attendeeData);
      console.log("[DEBUG] Validated attendee data:", JSON.stringify(validated, null, 2));
      
      const attendee = await storage.createMeetingAttendee(validated);
      res.status(201).json(attendee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("[DEBUG] Zod validation error:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ message: "Invalid attendee data", errors: error.errors });
      }
      console.error("Error creating attendee:", error);
      res.status(500).json({ message: "Failed to add attendee" });
    }
  });

  app.delete("/api/meetings/:id/attendees/:attendeeId", isAuthenticated, requireFeature("meetings"), async (req, res) => {
    try {
      const user = req.user!;
      const { id, attendeeId } = req.params;
      
      // Verify user has access to the meeting's school
      const meeting = await storage.getMeeting(id);
      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      
      if (user.global_role !== "Creator") {
        const userMemberships = await storage.getMembershipsByUser(user.id);
        const hasAccess = userMemberships.some(m => m.schoolId === meeting.schoolId);
        
        if (!hasAccess) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this meeting" });
        }
      }
      
      const deleted = await storage.deleteMeetingAttendee(attendeeId);
      if (!deleted) {
        return res.status(404).json({ message: "Attendee not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to remove attendee" });
    }
  });

  // Meeting actions routes
  app.get("/api/meetings/:id/actions", isAuthenticated, requireFeature("meetings"), async (req, res) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      
      // Verify user has access to the meeting's school
      const meeting = await storage.getMeeting(id);
      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      
      if (user.global_role !== "Creator") {
        const userMemberships = await storage.getMembershipsByUser(user.id);
        const hasAccess = userMemberships.some(m => m.schoolId === meeting.schoolId);
        
        if (!hasAccess) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this meeting" });
        }
      }
      
      const actions = await storage.getActionsByMeeting(id);
      
      // Enrich actions with assignee information
      const enrichedActions = await Promise.all(
        actions.map(async (action) => {
          let assignedTo = null;
          if (action.assignedToMembershipId) {
            const membership = await storage.getMembership(action.assignedToMembershipId);
            if (membership) {
              const assigneeUser = await storage.getUser(membership.userId);
              if (assigneeUser) {
                assignedTo = `${assigneeUser.first_name || ''} ${assigneeUser.last_name || ''}`.trim() || assigneeUser.email;
              }
            }
          }
          
          return {
            ...action,
            assignedTo,
          };
        })
      );
      
      res.json(enrichedActions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch actions" });
    }
  });

  app.post("/api/meetings/:id/actions", isAuthenticated, requireFeature("meetings"), async (req, res) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      
      // Verify user has access to the meeting's school
      const meeting = await storage.getMeeting(id);
      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      
      if (user.global_role !== "Creator") {
        const userMemberships = await storage.getMembershipsByUser(user.id);
        const hasAccess = userMemberships.some(m => m.schoolId === meeting.schoolId);
        
        if (!hasAccess) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this meeting" });
        }
      }
      
      const validated = insertMeetingActionSchema.parse({ ...req.body, meetingId: id });
      const action = await storage.createMeetingAction(validated);
      res.status(201).json(action);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid action data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create action" });
    }
  });

  app.patch("/api/meetings/:id/actions/:actionId", isAuthenticated, requireFeature("meetings"), async (req, res) => {
    try {
      const user = req.user!;
      const { id, actionId } = req.params;
      const updates = req.body;
      
      // Verify user has access to the meeting's school
      const meeting = await storage.getMeeting(id);
      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      
      if (user.global_role !== "Creator") {
        const userMemberships = await storage.getMembershipsByUser(user.id);
        const hasAccess = userMemberships.some(m => m.schoolId === meeting.schoolId);
        
        if (!hasAccess) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this meeting" });
        }
      }
      
      const action = await storage.updateMeetingAction(actionId, updates);
      if (!action) {
        return res.status(404).json({ message: "Action not found" });
      }
      
      res.json(action);
    } catch (error) {
      res.status(500).json({ message: "Failed to update action" });
    }
  });

  app.delete("/api/meetings/:id/actions/:actionId", isAuthenticated, requireFeature("meetings"), async (req, res) => {
    try {
      const user = req.user!;
      const { id, actionId } = req.params;
      
      // Verify user has access to the meeting's school
      const meeting = await storage.getMeeting(id);
      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      
      if (user.global_role !== "Creator") {
        const userMemberships = await storage.getMembershipsByUser(user.id);
        const hasAccess = userMemberships.some(m => m.schoolId === meeting.schoolId);
        
        if (!hasAccess) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this meeting" });
        }
      }
      
      const deleted = await storage.deleteMeetingAction(actionId);
      if (!deleted) {
        return res.status(404).json({ message: "Action not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete action" });
    }
  });

  // Leave Request routes
  // POST /api/leave-requests - Create a new leave request
  app.post("/api/leave-requests", isAuthenticated, requireFeature("absence_management"), async (req, res) => {
    try {
      const user = req.user!;
      const requestData = req.body;
      
      // Validate that schoolId is provided
      if (!requestData.schoolId) {
        return res.status(400).json({ message: "schoolId is required" });
      }
      
      // Get user's membership for the specified school
      const userMemberships = await storage.getMembershipsByUser(user.id);
      const membership = userMemberships.find(m => m.schoolId === requestData.schoolId);
      
      if (!membership) {
        return res.status(403).json({ message: "Forbidden: You don't have a membership in this school" });
      }
      
      // Set membershipId from authenticated user's membership and default status
      // Convert date strings to Date objects for Zod validation
      const leaveRequestData = {
        ...requestData,
        membershipId: membership.id,
        status: "pending",
        startDate: new Date(requestData.startDate),
        endDate: new Date(requestData.endDate),
      };
      
      // Validate the request data
      const validated = insertLeaveRequestSchema.parse(leaveRequestData);
      const leaveRequest = await storage.createLeaveRequest(validated);
      
      res.status(201).json(leaveRequest);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid leave request data", errors: error.errors });
      }
      console.error("Error creating leave request:", error);
      res.status(500).json({ message: "Failed to create leave request" });
    }
  });

  // GET /api/leave-requests - List leave requests with optional filtering
  app.get("/api/leave-requests", isAuthenticated, requireFeature("absence_management"), async (req, res) => {
    try {
      const user = req.user!;
      const schoolId = req.query.schoolId as string;
      const status = req.query.status as string | undefined;
      const myRequests = req.query.myRequests === "true";
      
      if (!schoolId) {
        return res.status(400).json({ message: "schoolId is required" });
      }
      
      // Verify user has access to this school
      let userMembership;
      if (user.global_role !== "Creator") {
        const userMemberships = await storage.getMembershipsByUser(user.id);
        userMembership = userMemberships.find(m => m.schoolId === schoolId);
        
        if (!userMembership) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this school" });
        }
      }
      
      // Get all leave requests for the school
      let leaveRequests = await storage.getLeaveRequestsBySchool(schoolId);
      
      // Filter by membership if regular user or myRequests is true
      if (userMembership) {
        const canApprove = userMembership.canApproveLeaveRequests;
        
        // Users without approval permission can only see their own requests
        // Users with permission can see all, but can filter to myRequests
        if (!canApprove || myRequests) {
          leaveRequests = leaveRequests.filter(lr => lr.membershipId === userMembership.id);
        }
      } else if (myRequests && user.global_role === "Creator") {
        // Creators with myRequests=true should get empty array (they have no membership)
        leaveRequests = [];
      }
      
      // Filter by status if provided
      if (status) {
        leaveRequests = leaveRequests.filter(lr => lr.status === status);
      }
      
      // Enrich leave requests with user information
      const enrichedRequests = await Promise.all(
        leaveRequests.map(async (request) => {
          const membership = await storage.getMembership(request.membershipId);
          const requestUser = membership ? await storage.getUser(membership.userId) : null;
          
          let approver = null;
          if (request.approvedBy) {
            const approverMembership = await storage.getMembership(request.approvedBy);
            if (approverMembership) {
              const approverUser = await storage.getUser(approverMembership.userId);
              approver = approverUser ? {
                firstName: approverUser.first_name,
                lastName: approverUser.last_name,
                email: approverUser.email,
              } : null;
            }
          }
          
          return {
            ...request,
            requester: requestUser ? {
              firstName: requestUser.first_name,
              lastName: requestUser.last_name,
              email: requestUser.email,
            } : null,
            approver,
          };
        })
      );
      
      res.json(enrichedRequests);
    } catch (error) {
      console.error("Error fetching leave requests:", error);
      res.status(500).json({ message: "Failed to fetch leave requests" });
    }
  });

  // GET /api/leave-requests/:id - Get a single leave request with authorization
  app.get("/api/leave-requests/:id", isAuthenticated, requireFeature("absence_management"), async (req, res) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      
      // Get the leave request
      const leaveRequest = await storage.getLeaveRequest(id);
      if (!leaveRequest) {
        return res.status(404).json({ message: "Leave request not found" });
      }
      
      // Get the membership for the leave request to determine the school
      const requestMembership = await storage.getMembership(leaveRequest.membershipId);
      if (!requestMembership) {
        return res.status(404).json({ message: "Membership not found" });
      }
      
      // Verify user has access to the school and proper authorization
      if (user.global_role !== "Creator") {
        const userMemberships = await storage.getMembershipsByUser(user.id);
        const userMembership = userMemberships.find(m => m.schoolId === requestMembership.schoolId);
        
        if (!userMembership) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this school" });
        }
        
        const canApprove = userMembership.canApproveLeaveRequests;
        const isOwnRequest = userMembership.id === leaveRequest.membershipId;
        
        // Users without approval permission can only see their own requests
        // Users with permission can see all requests for their school
        if (!canApprove && !isOwnRequest) {
          return res.status(403).json({ message: "Forbidden: You can only view your own leave requests" });
        }
      }
      
      res.json(leaveRequest);
    } catch (error) {
      console.error("Error fetching leave request:", error);
      res.status(500).json({ message: "Failed to fetch leave request" });
    }
  });

  // PATCH /api/leave-requests/:id - Update a leave request
  app.patch("/api/leave-requests/:id", isAuthenticated, requireFeature("absence_management"), async (req, res) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const updates = req.body;
      
      // Get the existing leave request
      const existingRequest = await storage.getLeaveRequest(id);
      if (!existingRequest) {
        return res.status(404).json({ message: "Leave request not found" });
      }
      
      // Get the membership for the leave request to determine the school
      const requestMembership = await storage.getMembership(existingRequest.membershipId);
      if (!requestMembership) {
        return res.status(404).json({ message: "Membership not found" });
      }
      
      // Verify user has permission to update (even Creators need this)
      const userMemberships = await storage.getMembershipsByUser(user.id);
      const userMembership = userMemberships.find(m => m.schoolId === requestMembership.schoolId);
      
      if (!userMembership) {
        return res.status(403).json({ message: "Forbidden: You don't have access to this school" });
      }
      
      // Only users with approve permission can approve/deny
      if (!userMembership.canApproveLeaveRequests) {
        return res.status(403).json({ message: "Forbidden: You don't have permission to approve or deny leave requests" });
      }
      
      // If status is being changed to approved or denied, set approvedBy
      const finalUpdates = { ...updates };
      if (updates.status && (updates.status.includes("approved") || updates.status === "denied")) {
        // If approvedBy not provided in updates, use the authenticated user's membership
        if (!updates.approvedBy && userMembership) {
          finalUpdates.approvedBy = userMembership.id;
        }
      }
      
      const updatedRequest = await storage.updateLeaveRequest(id, finalUpdates);
      if (!updatedRequest) {
        return res.status(404).json({ message: "Leave request not found" });
      }
      
      // Send email notification if status changed to approved/denied (fire and forget)
      void (async () => {
        try {
          if (updates.status && (updates.status.includes("approved") || updates.status === "denied")) {
            const requestMembershipData = await storage.getMembership(updatedRequest.membershipId);
            const requestingUser = requestMembershipData ? await storage.getUser(requestMembershipData.userId) : null;
            
            if (requestingUser && requestingUser.email) {
              const approverMembership = updatedRequest.approvedBy ? await storage.getMembership(updatedRequest.approvedBy) : null;
              const approverUser = approverMembership ? await storage.getUser(approverMembership.userId) : null;
              const approverName = approverUser 
                ? `${approverUser.first_name || ''} ${approverUser.last_name || ''}`.trim() || approverUser.email || 'An administrator'
                : 'An administrator';
              
              const teacherName = `${requestingUser.first_name || ''} ${requestingUser.last_name || ''}`.trim() || requestingUser.email || 'there';
              
              await emailService.sendLeaveRequestApproval({
                to: requestingUser.email,
                teacherName,
                approverName,
                leaveType: updatedRequest.type,
                startDate: new Date(updatedRequest.startDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }),
                endDate: new Date(updatedRequest.endDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }),
                status: updatedRequest.status,
                responseNotes: updatedRequest.responseNotes || undefined,
              });
            }
          }
        } catch (error) {
          console.error("[EMAIL] Failed to send leave request approval notification:", error);
        }
      })();
      
      res.json(updatedRequest);
    } catch (error) {
      console.error("Error updating leave request:", error);
      res.status(500).json({ message: "Failed to update leave request" });
    }
  });

  // DELETE /api/leave-requests/:id - Delete a leave request
  app.delete("/api/leave-requests/:id", isAuthenticated, requireFeature("absence_management"), async (req, res) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      
      // Get the existing leave request
      const existingRequest = await storage.getLeaveRequest(id);
      if (!existingRequest) {
        return res.status(404).json({ message: "Leave request not found" });
      }
      
      // Get the membership for the leave request
      const requestMembership = await storage.getMembership(existingRequest.membershipId);
      if (!requestMembership) {
        return res.status(404).json({ message: "Membership not found" });
      }
      
      // Verify user has permission to delete
      if (user.global_role !== "Creator") {
        const userMemberships = await storage.getMembershipsByUser(user.id);
        const userMembership = userMemberships.find(m => m.schoolId === requestMembership.schoolId);
        
        if (!userMembership) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this school" });
        }
        
        // User can delete their own request, or Leaders/Admins can delete any
        const isOwnRequest = userMembership.id === existingRequest.membershipId;
        const isLeaderOrAdmin = userMembership.role === "Leader" || userMembership.role === "Admin";
        
        if (!isOwnRequest && !isLeaderOrAdmin) {
          return res.status(403).json({ message: "Forbidden: You can only delete your own requests unless you are a Leader or Admin" });
        }
      }
      
      const deleted = await storage.deleteLeaveRequest(id);
      if (!deleted) {
        return res.status(404).json({ message: "Leave request not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting leave request:", error);
      res.status(500).json({ message: "Failed to delete leave request" });
    }
  });

  // GET /api/my-leave-requests - Get all leave requests for current user across all schools
  app.get("/api/my-leave-requests", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      
      // Get all user's memberships
      const memberships = await storage.getMembershipsByUser(user.id);
      
      // Fetch leave requests for each membership
      const allLeaveRequests = await Promise.all(
        memberships.map(m => storage.getLeaveRequestsByMembership(m.id))
      );
      
      // Flatten and sort by creation date (most recent first)
      const leaveRequests = allLeaveRequests
        .flat()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      res.json(leaveRequests);
    } catch (error) {
      console.error("Error fetching user's leave requests:", error);
      res.status(500).json({ message: "Failed to fetch leave requests" });
    }
  });

  // GET /api/my-actions - Get all meeting actions assigned to current user across all schools
  app.get("/api/my-actions", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      
      // Get all user's memberships
      const memberships = await storage.getMembershipsByUser(user.id);
      const membershipIds = memberships.map(m => m.id);
      
      // If user has no memberships, return empty array
      if (membershipIds.length === 0) {
        return res.json([]);
      }
      
      // Query database directly for actions assigned to any of the user's memberships
      const actions = await db
        .select()
        .from(meetingActions)
        .where(sql`${meetingActions.assignedToMembershipId} IN (${sql.join(membershipIds.map(id => sql`${id}`), sql`, `)})`)
        .orderBy(desc(meetingActions.createdAt));
      
      res.json(actions);
    } catch (error) {
      console.error("Error fetching user's actions:", error);
      res.status(500).json({ message: "Failed to fetch actions" });
    }
  });

  // User lookup endpoint (for membership management)
  // Get users by school (for displaying teacher/observer names)
  app.get("/api/users", isAuthenticated, async (req: any, res) => {
    try {
      const { schoolId, email } = req.query;
      const user = req.user;

      // If email is provided, find user by email
      if (email) {
        const foundUser = await storage.getUserByEmail(email as string);
        if (!foundUser) {
          return res.status(404).json({ message: "User not found" });
        }
        return res.json(sanitizeUser(foundUser));
      }

      // If schoolId is provided, get all users in that school
      if (schoolId) {
        // Verify user has access to this school
        if (user.global_role !== "Creator") {
          const membership = await storage.getMembershipByUserAndSchool(user.id, schoolId as string);
          if (!membership) {
            return res.status(403).json({ message: "Forbidden: You don't have access to this school" });
          }
        }

        // Get all memberships for this school
        const memberships = await storage.getMembershipsBySchool(schoolId as string);
        const userIds = [...new Set(memberships.map(m => m.userId))];

        // Fetch all users
        const users = await Promise.all(
          userIds.map(async (userId) => {
            const u = await storage.getUser(userId);
            return u;
          })
        );

        // Filter out nulls and archived users
        const filteredUsers = users.filter(u => u && !u.archived);
        
        return res.json(filteredUsers.map(sanitizeUser));
      }

      return res.status(400).json({ message: "Either email or schoolId parameter is required" });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Dashboard analytics endpoint
  app.get("/api/dashboard/analytics", isAuthenticated, async (req: any, res) => {
    try {
      const schoolId = req.query.schoolId as string;
      const categoryTimePeriod = (req.query.categoryTimePeriod as string) || "month";
      const topPerformersTimePeriod = (req.query.topPerformersTimePeriod as string) || "all";
      const lowestPerformersTimePeriod = (req.query.lowestPerformersTimePeriod as string) || "all";
      const includeLowest = req.query.includeLowest === "true";
      const trendTimePeriod = (req.query.trendTimePeriod as string) || "week";
      const staffIds = req.query.staffIds ? (Array.isArray(req.query.staffIds) ? req.query.staffIds : [req.query.staffIds]) : [];
      const user = req.user;
      
      if (!schoolId) {
        return res.status(400).json({ message: "schoolId parameter is required" });
      }

      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Verify user has access to this school
      if (user.global_role !== "Creator") {
        const membership = await storage.getMembershipByUserAndSchool(user.id, schoolId);
        if (!membership) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this school" });
        }
      }

      // Get all observations for this school
      const allObservations = await storage.getObservationsBySchool(schoolId);
      
      // Helper function to filter observations by time period
      const now = new Date();
      const getFilteredObservations = (timePeriod: string) => {
        if (timePeriod === "all") return allObservations;
        
        let startDate = new Date();
        switch (timePeriod) {
          case "week":
            startDate.setDate(now.getDate() - 7);
            break;
          case "month":
            startDate.setMonth(now.getMonth() - 1);
            break;
          case "year":
            startDate.setFullYear(now.getFullYear() - 1);
            break;
          default:
            return allObservations;
        }
        
        return allObservations.filter(obs => {
          const obsDate = new Date(obs.date);
          return obsDate >= startDate;
        });
      };
      
      // Filter observations by time period for different analytics
      const filteredObservationsForCategories = getFilteredObservations(categoryTimePeriod);
      const filteredObservationsForTopPerformers = getFilteredObservations(topPerformersTimePeriod);
      const filteredObservationsForLowestPerformers = getFilteredObservations(lowestPerformersTimePeriod);
      const filteredObservationsForTrend = getFilteredObservations(trendTimePeriod);
      
      // Apply staff filtering if provided
      const trendObservations = staffIds.length > 0
        ? filteredObservationsForTrend.filter(obs => 
            staffIds.includes(obs.teacherId) || staffIds.includes(obs.observerId)
          )
        : filteredObservationsForTrend;
      
      // Use all observations for qualitative feedback
      const schoolObservations = allObservations;

      // Fetch all users for the school to get teacher names
      const memberships = await storage.getMembershipsBySchool(schoolId);
      const userIds = [...new Set(memberships.map(m => m.userId))];
      const users = await Promise.all(
        userIds.map(async (userId) => {
          const u = await storage.getUser(userId);
          return u;
        })
      );
      const userMap = new Map<string, { firstName: string; lastName: string; email: string }>();
      users.filter(u => u && !u.archived).forEach(u => {
        if (u) {
          userMap.set(u.id, {
            firstName: u.first_name || '',
            lastName: u.last_name || '',
            email: u.email
          });
        }
      });

      // Calculate observation trend with quality scores
      const getDaysCount = (timePeriod: string) => {
        switch (timePeriod) {
          case "week": return 7;
          case "month": return 30;
          case "year": return 12; // Will use months instead of days
          default: return 7;
        }
      };
      
      const trendData = [];
      const daysCount = getDaysCount(trendTimePeriod);
      const isYearView = trendTimePeriod === "year";
      
      if (isYearView) {
        // For year view, group by month
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        for (let i = 11; i >= 0; i--) {
          const date = new Date(now);
          date.setMonth(date.getMonth() - i);
          const monthName = monthNames[date.getMonth()];
          const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
          const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
          
          const monthObs = trendObservations.filter(obs => {
            const obsDate = new Date(obs.date);
            return obsDate >= monthStart && obsDate <= monthEnd;
          });
          
          const avgQuality = monthObs.length > 0
            ? (monthObs.reduce((sum, obs) => sum + (obs.totalScore / obs.totalMaxScore) * 5, 0) / monthObs.length)
            : 0;
          
          trendData.push({
            label: monthName,
            value: monthObs.length,
            quality: Number(avgQuality.toFixed(2))
          });
        }
      } else {
        // For week/month view, group by day
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        for (let i = daysCount - 1; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          const dayName = dayNames[date.getDay()];
          const label = trendTimePeriod === "week" ? dayName : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          
          const dayObs = trendObservations.filter(obs => {
            const obsDate = new Date(obs.date);
            return obsDate.toDateString() === date.toDateString();
          });
          
          const avgQuality = dayObs.length > 0
            ? (dayObs.reduce((sum, obs) => sum + (obs.totalScore / obs.totalMaxScore) * 5, 0) / dayObs.length)
            : 0;
          
          trendData.push({
            label,
            value: dayObs.length,
            quality: Number(avgQuality.toFixed(2))
          });
        }
      }

      // Calculate top performers (teachers with highest avg scores)
      const topTeacherScores: Record<string, { totalScore: number; totalMaxScore: number; count: number; name: string }> = {};
      
      for (const obs of filteredObservationsForTopPerformers) {
        if (!topTeacherScores[obs.teacherId]) {
          const userData = userMap.get(obs.teacherId);
          const teacherName = userData
            ? `${userData.firstName} ${userData.lastName}`.trim() || userData.email
            : "Unknown";
          
          topTeacherScores[obs.teacherId] = {
            totalScore: 0,
            totalMaxScore: 0,
            count: 0,
            name: teacherName
          };
        }
        topTeacherScores[obs.teacherId].totalScore += obs.totalScore;
        topTeacherScores[obs.teacherId].totalMaxScore += obs.totalMaxScore;
        topTeacherScores[obs.teacherId].count += 1;
      }

      const topPerformers = Object.entries(topTeacherScores)
        .filter(([_, data]) => data.count > 0) // Only include teachers with observations
        .map(([teacherId, data]) => ({
          label: data.name,
          value: (data.totalScore / data.totalMaxScore) * 5,
          maxValue: 5,
          count: data.count
        }))
        .filter(item => item.value >= 4.0) // Only show teachers scoring 4.0/5 (80%) or above
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
      
      // Calculate lowest performers separately with their own time filter
      let lowestPerformers: any[] = [];
      if (includeLowest) {
        const lowestTeacherScores: Record<string, { totalScore: number; totalMaxScore: number; count: number; name: string }> = {};
        
        for (const obs of filteredObservationsForLowestPerformers) {
          if (!lowestTeacherScores[obs.teacherId]) {
            const userData = userMap.get(obs.teacherId);
            const teacherName = userData
              ? `${userData.firstName} ${userData.lastName}`.trim() || userData.email
              : "Unknown";
            
            lowestTeacherScores[obs.teacherId] = {
              totalScore: 0,
              totalMaxScore: 0,
              count: 0,
              name: teacherName
            };
          }
          lowestTeacherScores[obs.teacherId].totalScore += obs.totalScore;
          lowestTeacherScores[obs.teacherId].totalMaxScore += obs.totalMaxScore;
          lowestTeacherScores[obs.teacherId].count += 1;
        }
        
        lowestPerformers = Object.entries(lowestTeacherScores)
          .filter(([_, data]) => data.count > 0)
          .map(([teacherId, data]) => ({
            label: data.name,
            value: (data.totalScore / data.totalMaxScore) * 5,
            maxValue: 5,
            count: data.count
          }))
          .filter(item => item.value < 3.5) // Only show teachers scoring below 3.5/5 (70%)
          .sort((a, b) => a.value - b.value)
          .slice(0, 5);
      }

      // Calculate category performance (avg scores by category)
      // Bulk-load all observation habits and categories for efficiency
      // Use filtered observations based on selected time period
      const categoryScores: Record<string, { totalScore: number; totalMaxScore: number; count: number }> = {};
      
      // Fetch all observation habits for filtered observations in parallel
      const allObservationHabitsArrays = await Promise.all(
        filteredObservationsForCategories.map(obs => storage.getObservationHabitsByObservation(obs.id))
      );
      
      // Flatten into a single array
      const allObservationHabits = allObservationHabitsArrays.flat();
      
      // Get unique category IDs
      const uniqueCategoryIds = [...new Set(allObservationHabits.map(h => h.categoryId))];
      
      // Bulk-load all categories and create a map
      const categoryMap = new Map<string, string>();
      await Promise.all(
        uniqueCategoryIds.map(async (categoryId) => {
          const category = await storage.getCategory(categoryId);
          if (category) {
            categoryMap.set(categoryId, category.name);
          }
        })
      );
      
      // Process each filtered observation's habits
      for (let i = 0; i < filteredObservationsForCategories.length; i++) {
        const obsHabits = allObservationHabitsArrays[i];
        
        // Group by category for this observation
        const obsCategoryScores = new Map<string, { score: number; maxScore: number }>();
        
        for (const obsHabit of obsHabits) {
          const categoryName = categoryMap.get(obsHabit.categoryId);
          if (!categoryName) continue;
          
          if (!obsCategoryScores.has(categoryName)) {
            obsCategoryScores.set(categoryName, { score: 0, maxScore: 0 });
          }
          
          const catData = obsCategoryScores.get(categoryName)!;
          // Each habit has a maxScore of 1, and scores 1 if observed, 0 if not
          catData.score += obsHabit.observed ? 1 : 0;
          catData.maxScore += 1;
        }
        
        // Add to overall category scores
        for (const [categoryName, data] of Array.from(obsCategoryScores.entries())) {
          if (!categoryScores[categoryName]) {
            categoryScores[categoryName] = {
              totalScore: 0,
              totalMaxScore: 0,
              count: 0
            };
          }
          categoryScores[categoryName].totalScore += data.score;
          categoryScores[categoryName].totalMaxScore += data.maxScore;
          categoryScores[categoryName].count += 1;
        }
      }

      const categoryPerformance = Object.entries(categoryScores).map(([name, data]) => ({
        name,
        avgScore: data.totalScore,
        maxScore: data.totalMaxScore,
        trend: "stable" as const,
        trendValue: 0
      }));

      // Aggregate qualitative feedback (latest 10 observations with feedback)
      const qualitativeFeedback = schoolObservations
        .filter(obs => obs.qualitativeFeedback && obs.qualitativeFeedback.trim().length > 0)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10)
        .map(obs => {
          const teacherData = userMap.get(obs.teacherId);
          const observerData = userMap.get(obs.observerId);
          return {
            teacherName: teacherData ? `${teacherData.first_name || ''} ${teacherData.last_name || ''}`.trim() || teacherData.email : "Unknown",
            observerName: observerData ? `${observerData.first_name || ''} ${observerData.last_name || ''}`.trim() || observerData.email : "Unknown",
            date: obs.date,
            feedback: obs.qualitativeFeedback
          };
        });

      res.json({
        observationTrend: trendData,
        topPerformers,
        lowestPerformers,
        categoryPerformance,
        qualitativeFeedback
      });
    } catch (error) {
      console.error("Error fetching dashboard analytics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard analytics" });
    }
  });

  // Comprehensive Observation Analytics endpoint
  app.get("/api/observation-analytics", isAuthenticated, async (req: any, res) => {
    try {
      const schoolId = req.query.schoolId as string;
      const timePeriod = (req.query.timePeriod as string) || "month";
      const user = req.user;

      if (!schoolId) {
        return res.status(400).json({ message: "schoolId parameter is required" });
      }

      // Verify user has access to this school and is Leader/Admin/Creator
      let hasAccess = false;
      if (user.global_role === "Creator") {
        hasAccess = true;
      } else {
        const membership = await storage.getMembershipByUserAndSchool(user.id, schoolId);
        if (membership && (membership.role === "Leader" || membership.role === "Admin")) {
          hasAccess = true;
        }
      }

      if (!hasAccess) {
        return res.status(403).json({ message: "Forbidden: Analytics requires Leader or Admin access" });
      }

      // Get all observations for this school
      const schoolObservations = await storage.getObservationsBySchool(schoolId);

      // Calculate time filter cutoff
      const now = new Date();
      let cutoffDate: Date | null = null;
      let prevCutoffDate: Date | null = null;
      
      if (timePeriod === "week") {
        cutoffDate = new Date(now);
        cutoffDate.setDate(now.getDate() - 7);
        prevCutoffDate = new Date(cutoffDate);
        prevCutoffDate.setDate(prevCutoffDate.getDate() - 7);
      } else if (timePeriod === "month") {
        cutoffDate = new Date(now);
        cutoffDate.setMonth(now.getMonth() - 1);
        prevCutoffDate = new Date(cutoffDate);
        prevCutoffDate.setMonth(prevCutoffDate.getMonth() - 1);
      } else if (timePeriod === "year") {
        cutoffDate = new Date(now);
        cutoffDate.setFullYear(now.getFullYear() - 1);
        prevCutoffDate = new Date(cutoffDate);
        prevCutoffDate.setFullYear(prevCutoffDate.getFullYear() - 1);
      }

      // Filter observations by time period
      const filteredObservations = cutoffDate
        ? schoolObservations.filter(obs => new Date(obs.date) >= cutoffDate!)
        : schoolObservations;
      
      const prevPeriodObservations = cutoffDate && prevCutoffDate
        ? schoolObservations.filter(obs => {
            const obsDate = new Date(obs.date);
            return obsDate >= prevCutoffDate! && obsDate < cutoffDate!;
          })
        : [];

      // Get all users for name lookups
      const schoolMemberships = await storage.getMembershipsBySchool(schoolId);
      const userIds = [...new Set(schoolMemberships.map(m => m.userId))];
      const allUsers = await Promise.all(userIds.map(id => storage.getUser(id)));
      const userMap = new Map(allUsers.filter(Boolean).map(u => [u!.id, u!]));

      // Summary statistics
      const totalObservations = filteredObservations.length;
      const uniqueTeachers = new Set(filteredObservations.map(obs => obs.teacherId)).size;
      
      // Calculate average score, only counting observations with valid max scores
      const validObservations = filteredObservations.filter(obs => obs.totalMaxScore > 0);
      const averageScore = validObservations.length > 0
        ? validObservations.reduce((sum, obs) => sum + (obs.totalScore / obs.totalMaxScore) * 5, 0) / validObservations.length
        : 0;

      // Calculate score change vs previous period
      const validPrevObservations = prevPeriodObservations.filter(obs => obs.totalMaxScore > 0);
      const prevAvgScore = validPrevObservations.length > 0
        ? validPrevObservations.reduce((sum, obs) => sum + (obs.totalScore / obs.totalMaxScore) * 5, 0) / validPrevObservations.length
        : averageScore;
      const scoreChange = prevAvgScore > 0 && validObservations.length > 0 ? ((averageScore - prevAvgScore) / prevAvgScore) * 100 : 0;

      // Observation trend (group by week for all time periods)
      // Helper to get week start date (Monday)
      const getWeekStart = (date: Date): Date => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as start
        return new Date(d.setDate(diff));
      };
      
      const getWeekLabel = (date: Date): string => {
        const weekStart = getWeekStart(date);
        return weekStart.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      };
      
      const getWeekSortKey = (date: Date): number => {
        return getWeekStart(date).getTime();
      };

      const trendMap = new Map<string, { count: number; totalScore: number; totalMax: number; sortKey: number }>();
      for (const obs of filteredObservations) {
        const date = new Date(obs.date);
        const label = getWeekLabel(date);
        const sortKey = getWeekSortKey(date);
        
        if (!trendMap.has(label)) {
          trendMap.set(label, { count: 0, totalScore: 0, totalMax: 0, sortKey });
        }
        const entry = trendMap.get(label)!;
        entry.count++;
        entry.totalScore += obs.totalScore;
        entry.totalMax += obs.totalMaxScore;
      }
      
      const observationTrend = Array.from(trendMap.entries())
        .map(([label, data]) => ({
          label,
          value: data.count,
          quality: data.totalMax > 0 ? (data.totalScore / data.totalMax) * 5 : 0,
          sortKey: data.sortKey
        }))
        .sort((a, b) => a.sortKey - b.sortKey)
        .slice(-24); // Limit to last 24 weeks

      // Top and lowest performers
      const teacherScores: Record<string, { totalScore: number; totalMax: number; count: number; name: string }> = {};
      for (const obs of filteredObservations) {
        if (!teacherScores[obs.teacherId]) {
          const userData = userMap.get(obs.teacherId);
          teacherScores[obs.teacherId] = {
            totalScore: 0,
            totalMax: 0,
            count: 0,
            name: userData ? `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.email : "Unknown"
          };
        }
        teacherScores[obs.teacherId].totalScore += obs.totalScore;
        teacherScores[obs.teacherId].totalMax += obs.totalMaxScore;
        teacherScores[obs.teacherId].count++;
      }

      const topPerformers = Object.entries(teacherScores)
        .filter(([_, t]) => t.count > 0 && t.totalMax > 0)
        .map(([teacherId, t]) => ({
          teacherId,
          label: t.name,
          value: (t.totalScore / t.totalMax) * 5,
          maxValue: 5,
          count: t.count
        }))
        .filter(t => t.value >= 4.0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      const lowestPerformers = Object.entries(teacherScores)
        .filter(([_, t]) => t.count > 0 && t.totalMax > 0)
        .map(([teacherId, t]) => ({
          teacherId,
          label: t.name,
          value: (t.totalScore / t.totalMax) * 5,
          maxValue: 5,
          count: t.count
        }))
        .filter(t => t.value < 3.5)
        .sort((a, b) => a.value - b.value)
        .slice(0, 10);

      // Category performance
      const categoryScores: Record<string, { totalScore: number; totalMax: number }> = {};
      const allObsHabits = await Promise.all(
        filteredObservations.map(obs => storage.getObservationHabitsByObservation(obs.id))
      );
      const flatObsHabits = allObsHabits.flat();
      
      const categoryIds = [...new Set(flatObsHabits.map(h => h.categoryId))];
      const categories = await Promise.all(categoryIds.map(id => storage.getCategory(id)));
      const categoryMap = new Map(categories.filter(Boolean).map(c => [c!.id, c!.name]));
      
      for (const habit of flatObsHabits) {
        const catName = categoryMap.get(habit.categoryId) || "Unknown";
        if (!categoryScores[catName]) {
          categoryScores[catName] = { totalScore: 0, totalMax: 0 };
        }
        categoryScores[catName].totalScore += habit.observed ? 1 : 0;
        categoryScores[catName].totalMax += 1;
      }
      
      const categoryPerformance = Object.entries(categoryScores).map(([name, data]) => ({
        name,
        avgScore: data.totalScore,
        maxScore: data.totalMax
      }));

      // Teaching group analysis
      const teachingGroups = await storage.getTeachingGroupsBySchool(schoolId);
      const membershipsByGroup = new Map<string, typeof schoolMemberships>();
      
      for (const membership of schoolMemberships) {
        if (membership.groupId) {
          if (!membershipsByGroup.has(membership.groupId)) {
            membershipsByGroup.set(membership.groupId, []);
          }
          membershipsByGroup.get(membership.groupId)!.push(membership);
        }
      }
      
      const teachingGroupAnalysis = teachingGroups.map(group => {
        const groupMemberships = membershipsByGroup.get(group.id) || [];
        const groupUserIds = new Set(groupMemberships.map(m => m.userId));
        
        const groupObs = filteredObservations.filter(obs => groupUserIds.has(obs.teacherId));
        const obsCount = groupObs.length;
        const avgScore = obsCount > 0
          ? groupObs.reduce((sum, obs) => {
              if (obs.totalMaxScore === 0) return sum;
              return sum + (obs.totalScore / obs.totalMaxScore) * 5;
            }, 0) / obsCount
          : 0;
        
        return {
          groupId: group.id,
          groupName: group.name,
          observationCount: obsCount,
          avgScore,
          teacherCount: groupMemberships.length
        };
      }).filter(g => g.teacherCount > 0);

      // Habit analysis - which habits are most commonly observed
      const habitIds = [...new Set(flatObsHabits.map(h => h.habitId))];
      const habits = await Promise.all(habitIds.map(id => storage.getHabit(id)));
      const habitMap = new Map(habits.filter(Boolean).map(h => [h!.id, h!]));
      
      const habitCounts: Record<string, { observed: number; total: number; name: string; category: string }> = {};
      for (const obsHabit of flatObsHabits) {
        const habit = habitMap.get(obsHabit.habitId);
        if (!habit) continue;
        const catName = categoryMap.get(obsHabit.categoryId) || "Unknown";
        
        if (!habitCounts[obsHabit.habitId]) {
          habitCounts[obsHabit.habitId] = {
            observed: 0,
            total: 0,
            name: habit.text,
            category: catName
          };
        }
        habitCounts[obsHabit.habitId].total++;
        if (obsHabit.observed) {
          habitCounts[obsHabit.habitId].observed++;
        }
      }
      
      const habitAnalysis = Object.values(habitCounts)
        .map(h => ({
          habitName: h.name,
          categoryName: h.category,
          observedCount: h.observed,
          totalCount: h.total,
          percentage: h.total > 0 ? (h.observed / h.total) * 100 : 0
        }))
        .sort((a, b) => b.totalCount - a.totalCount);

      // Common phrases analysis (simple word frequency from feedback)
      const allFeedback = filteredObservations
        .filter(obs => obs.qualitativeFeedback && obs.qualitativeFeedback.trim().length > 0)
        .map(obs => obs.qualitativeFeedback!);
      
      const positiveWords = new Set(['excellent', 'great', 'good', 'outstanding', 'effective', 'engaging', 'clear', 'well', 'strong', 'positive', 'progress', 'improvement', 'success']);
      const negativeWords = new Set(['needs', 'improve', 'lacks', 'weak', 'unclear', 'difficult', 'challenge', 'issue', 'problem', 'concern']);
      
      const wordCounts = new Map<string, { count: number; sentiment: 'positive' | 'negative' | 'neutral' }>();
      const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'this', 'that', 'these', 'those', 'it', 'its', 'they', 'their', 'them', 'he', 'she', 'his', 'her', 'you', 'your', 'we', 'our', 'i', 'me', 'my']);
      
      for (const feedback of allFeedback) {
        const words = feedback.toLowerCase()
          .replace(/[^a-z\s]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length > 3 && !stopWords.has(w) && /^[a-z]+$/.test(w));
        
        for (const word of words) {
          if (!wordCounts.has(word)) {
            let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
            if (positiveWords.has(word)) sentiment = 'positive';
            else if (negativeWords.has(word)) sentiment = 'negative';
            wordCounts.set(word, { count: 0, sentiment });
          }
          wordCounts.get(word)!.count++;
        }
      }
      
      const commonPhrases = Array.from(wordCounts.entries())
        .filter(([_, data]) => data.count >= 2)
        .map(([phrase, data]) => ({
          phrase,
          count: data.count,
          sentiment: data.sentiment
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 30);

      // Qualitative feedback samples
      const qualitativeFeedback = filteredObservations
        .filter(obs => obs.qualitativeFeedback && obs.qualitativeFeedback.trim().length > 0)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10)
        .map(obs => {
          const teacherData = userMap.get(obs.teacherId);
          const observerData = userMap.get(obs.observerId);
          return {
            teacherName: teacherData ? `${teacherData.first_name || ''} ${teacherData.last_name || ''}`.trim() || teacherData.email : "Unknown",
            observerName: observerData ? `${observerData.first_name || ''} ${observerData.last_name || ''}`.trim() || observerData.email : "Unknown",
            date: obs.date,
            feedback: obs.qualitativeFeedback
          };
        });

      res.json({
        summary: {
          totalObservations,
          uniqueTeachers,
          averageScore,
          scoreChange
        },
        observationTrend,
        topPerformers,
        lowestPerformers,
        categoryPerformance,
        teachingGroupAnalysis,
        habitAnalysis,
        commonPhrases,
        qualitativeFeedback
      });
    } catch (error) {
      console.error("Error fetching observation analytics:", error);
      res.status(500).json({ message: "Failed to fetch observation analytics" });
    }
  });

  // Observation Period Comparison endpoint
  app.get("/api/observation-comparison", isAuthenticated, async (req: any, res) => {
    try {
      const schoolId = req.query.schoolId as string;
      const periodAStart = req.query.periodAStart as string;
      const periodAEnd = req.query.periodAEnd as string;
      const periodBStart = req.query.periodBStart as string;
      const periodBEnd = req.query.periodBEnd as string;
      const user = req.user;

      if (!schoolId || !periodAStart || !periodAEnd || !periodBStart || !periodBEnd) {
        return res.status(400).json({ message: "All date parameters are required" });
      }

      // Verify user has access to this school and is Leader/Admin/Creator
      let hasAccess = false;
      if (user.global_role === "Creator") {
        hasAccess = true;
      } else {
        const membership = await storage.getMembershipByUserAndSchool(user.id, schoolId);
        if (membership && (membership.role === "Leader" || membership.role === "Admin")) {
          hasAccess = true;
        }
      }

      if (!hasAccess) {
        return res.status(403).json({ message: "Forbidden: Comparison requires Leader or Admin access" });
      }

      // Parse dates - normalize end dates to include the full day (add one day and use < comparison)
      const periodAStartDate = new Date(periodAStart);
      const periodAEndDate = new Date(periodAEnd);
      periodAEndDate.setDate(periodAEndDate.getDate() + 1); // Move to start of next day
      const periodBStartDate = new Date(periodBStart);
      const periodBEndDate = new Date(periodBEnd);
      periodBEndDate.setDate(periodBEndDate.getDate() + 1); // Move to start of next day

      // Get all observations for this school
      const schoolObservations = await storage.getObservationsBySchool(schoolId);

      // Filter observations for each period (using < for end date to include full day)
      const periodAObservations = schoolObservations.filter(obs => {
        const obsDate = new Date(obs.date);
        return obsDate >= periodAStartDate && obsDate < periodAEndDate;
      });

      const periodBObservations = schoolObservations.filter(obs => {
        const obsDate = new Date(obs.date);
        return obsDate >= periodBStartDate && obsDate < periodBEndDate;
      });

      // Calculate averages for each period
      const calcAvgScore = (observations: typeof schoolObservations) => {
        const valid = observations.filter(obs => obs.totalMaxScore > 0);
        if (valid.length === 0) return 0;
        return valid.reduce((sum, obs) => sum + (obs.totalScore / obs.totalMaxScore) * 5, 0) / valid.length;
      };

      const periodAAvgScore = calcAvgScore(periodAObservations);
      const periodBAvgScore = calcAvgScore(periodBObservations);

      // Get habit data for both periods
      const getHabitPerformance = async (observations: typeof schoolObservations) => {
        const obsHabits = await Promise.all(
          observations.map(obs => storage.getObservationHabitsByObservation(obs.id))
        );
        const flatHabits = obsHabits.flat();
        
        // Get categories and habits for lookups
        const categoryIds = [...new Set(flatHabits.map(h => h.categoryId))];
        const categories = await Promise.all(categoryIds.map(id => storage.getCategory(id)));
        const categoryMap = new Map(categories.filter(Boolean).map(c => [c!.id, c!.name]));
        
        const habitIds = [...new Set(flatHabits.map(h => h.habitId))];
        const habits = await Promise.all(habitIds.map(id => storage.getHabit(id)));
        const habitMap = new Map(habits.filter(Boolean).map(h => [h!.id, h!]));

        // Count habits
        const habitCounts: Record<string, { observed: number; total: number; name: string; category: string }> = {};
        for (const obsHabit of flatHabits) {
          const habit = habitMap.get(obsHabit.habitId);
          if (!habit) continue;
          const catName = categoryMap.get(obsHabit.categoryId) || "Unknown";
          
          if (!habitCounts[obsHabit.habitId]) {
            habitCounts[obsHabit.habitId] = {
              observed: 0,
              total: 0,
              name: habit.text,
              category: catName
            };
          }
          habitCounts[obsHabit.habitId].total++;
          if (obsHabit.observed) {
            habitCounts[obsHabit.habitId].observed++;
          }
        }

        return Object.values(habitCounts).map(h => ({
          habitName: h.name,
          categoryName: h.category,
          percentage: h.total > 0 ? (h.observed / h.total) * 100 : 0,
          count: h.total
        }));
      };

      const getCategoryPerformance = async (observations: typeof schoolObservations) => {
        const obsHabits = await Promise.all(
          observations.map(obs => storage.getObservationHabitsByObservation(obs.id))
        );
        const flatHabits = obsHabits.flat();
        
        const categoryIds = [...new Set(flatHabits.map(h => h.categoryId))];
        const categories = await Promise.all(categoryIds.map(id => storage.getCategory(id)));
        const categoryMap = new Map(categories.filter(Boolean).map(c => [c!.id, c!.name]));

        const categoryScores: Record<string, { totalScore: number; totalMax: number }> = {};
        for (const habit of flatHabits) {
          const catName = categoryMap.get(habit.categoryId) || "Unknown";
          if (!categoryScores[catName]) {
            categoryScores[catName] = { totalScore: 0, totalMax: 0 };
          }
          categoryScores[catName].totalScore += habit.observed ? 1 : 0;
          categoryScores[catName].totalMax += 1;
        }

        return Object.entries(categoryScores).map(([name, data]) => ({
          name,
          avgScore: data.totalScore,
          maxScore: data.totalMax,
          percentage: data.totalMax > 0 ? (data.totalScore / data.totalMax) * 100 : 0
        }));
      };

      const periodAHabits = await getHabitPerformance(periodAObservations);
      const periodBHabits = await getHabitPerformance(periodBObservations);
      const periodACategories = await getCategoryPerformance(periodAObservations);
      const periodBCategories = await getCategoryPerformance(periodBObservations);

      // Get per-teacher performance for both periods
      const getTeacherPerformance = async (observations: typeof schoolObservations) => {
        const teacherObsMap = new Map<string, typeof schoolObservations>();
        for (const obs of observations) {
          if (!teacherObsMap.has(obs.teacherId)) {
            teacherObsMap.set(obs.teacherId, []);
          }
          teacherObsMap.get(obs.teacherId)!.push(obs);
        }

        const teacherIds = [...teacherObsMap.keys()];
        const teacherUsers = await Promise.all(teacherIds.map(id => storage.getUser(id)));
        const teacherMap = new Map(teacherUsers.filter(Boolean).map(u => [u!.id, u!]));

        const teacherPerformance: Array<{
          teacherId: string;
          teacherName: string;
          observationCount: number;
          averageScore: number;
          categoryPerformance: Array<{ name: string; percentage: number }>;
        }> = [];

        for (const [teacherId, teacherObs] of teacherObsMap) {
          const teacher = teacherMap.get(teacherId);
          const teacherName = teacher 
            ? `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email
            : "Unknown";

          const validObs = teacherObs.filter(o => o.totalMaxScore > 0);
          const avgScore = validObs.length > 0
            ? validObs.reduce((sum, o) => sum + (o.totalScore / o.totalMaxScore) * 100, 0) / validObs.length
            : 0;

          const obsHabits = await Promise.all(
            teacherObs.map(obs => storage.getObservationHabitsByObservation(obs.id))
          );
          const flatHabits = obsHabits.flat();
          
          const categoryIds = [...new Set(flatHabits.map(h => h.categoryId))];
          const categories = await Promise.all(categoryIds.map(id => storage.getCategory(id)));
          const categoryNameMap = new Map(categories.filter(Boolean).map(c => [c!.id, c!.name]));

          const categoryScores: Record<string, { observed: number; total: number }> = {};
          for (const habit of flatHabits) {
            const catName = categoryNameMap.get(habit.categoryId) || "Unknown";
            if (!categoryScores[catName]) {
              categoryScores[catName] = { observed: 0, total: 0 };
            }
            categoryScores[catName].total++;
            if (habit.observed) {
              categoryScores[catName].observed++;
            }
          }

          const categoryPerformance = Object.entries(categoryScores).map(([name, data]) => ({
            name,
            percentage: data.total > 0 ? (data.observed / data.total) * 100 : 0
          }));

          teacherPerformance.push({
            teacherId,
            teacherName,
            observationCount: teacherObs.length,
            averageScore: avgScore,
            categoryPerformance
          });
        }

        return teacherPerformance;
      };

      const periodATeachers = await getTeacherPerformance(periodAObservations);
      const periodBTeachers = await getTeacherPerformance(periodBObservations);

      const allTeacherIds = new Set([
        ...periodATeachers.map(t => t.teacherId),
        ...periodBTeachers.map(t => t.teacherId)
      ]);

      const teacherChanges = Array.from(allTeacherIds).map(teacherId => {
        const teacherA = periodATeachers.find(t => t.teacherId === teacherId);
        const teacherB = periodBTeachers.find(t => t.teacherId === teacherId);
        
        const scoreA = teacherA?.averageScore || 0;
        const scoreB = teacherB?.averageScore || 0;
        const scoreDelta = scoreB - scoreA;
        
        const allCats = new Set([
          ...(teacherA?.categoryPerformance.map(c => c.name) || []),
          ...(teacherB?.categoryPerformance.map(c => c.name) || [])
        ]);
        
        const catChanges = Array.from(allCats).map(catName => {
          const catA = teacherA?.categoryPerformance.find(c => c.name === catName);
          const catB = teacherB?.categoryPerformance.find(c => c.name === catName);
          const percentA = catA?.percentage || 0;
          const percentB = catB?.percentage || 0;
          const delta = percentB - percentA;
          return {
            categoryName: catName,
            percentageA: percentA,
            percentageB: percentB,
            delta,
            direction: delta > 1 ? "up" : delta < -1 ? "down" : "same" as "up" | "down" | "same"
          };
        }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

        const improvements = catChanges.filter(c => c.direction === "up").slice(0, 3);
        const declines = catChanges.filter(c => c.direction === "down").slice(0, 3);

        return {
          teacherId,
          teacherName: teacherA?.teacherName || teacherB?.teacherName || "Unknown",
          observationCountA: teacherA?.observationCount || 0,
          observationCountB: teacherB?.observationCount || 0,
          averageScoreA: scoreA,
          averageScoreB: scoreB,
          scoreDelta,
          direction: scoreDelta > 1 ? "up" : scoreDelta < -1 ? "down" : "same" as "up" | "down" | "same",
          topImprovements: improvements,
          topDeclines: declines,
          allCategoryChanges: catChanges
        };
      }).sort((a, b) => Math.abs(b.scoreDelta) - Math.abs(a.scoreDelta));

      // Calculate deltas - include habits/categories from BOTH periods (union)
      // Create a map of all unique habits from both periods
      const allHabitNames = new Set([
        ...periodAHabits.map(h => h.habitName),
        ...periodBHabits.map(h => h.habitName)
      ]);
      
      const habitChanges = Array.from(allHabitNames).map(habitName => {
        const habitA = periodAHabits.find(h => h.habitName === habitName);
        const habitB = periodBHabits.find(h => h.habitName === habitName);
        const percentageA = habitA?.percentage || 0;
        const percentageB = habitB?.percentage || 0;
        const change = percentageB - percentageA;
        return {
          habitName,
          categoryName: habitA?.categoryName || habitB?.categoryName || "Unknown",
          percentageChange: change,
          direction: change > 1 ? "up" : change < -1 ? "down" : "same" as "up" | "down" | "same"
        };
      });

      // Create a map of all unique categories from both periods
      const allCategoryNames = new Set([
        ...periodACategories.map(c => c.name),
        ...periodBCategories.map(c => c.name)
      ]);

      const categoryChanges = Array.from(allCategoryNames).map(name => {
        const catA = periodACategories.find(c => c.name === name);
        const catB = periodBCategories.find(c => c.name === name);
        const percentageA = catA?.percentage || 0;
        const percentageB = catB?.percentage || 0;
        const change = percentageB - percentageA;
        return {
          name,
          percentageChange: change,
          direction: change > 1 ? "up" : change < -1 ? "down" : "same" as "up" | "down" | "same"
        };
      });

      res.json({
        periodA: {
          startDate: periodAStart,
          endDate: periodAEnd,
          totalObservations: periodAObservations.length,
          averageScore: periodAAvgScore,
          habitPerformance: periodAHabits,
          categoryPerformance: periodACategories
        },
        periodB: {
          startDate: periodBStart,
          endDate: periodBEnd,
          totalObservations: periodBObservations.length,
          averageScore: periodBAvgScore,
          habitPerformance: periodBHabits,
          categoryPerformance: periodBCategories
        },
        deltas: {
          observationCount: periodBObservations.length - periodAObservations.length,
          averageScore: periodBAvgScore - periodAAvgScore,
          habitChanges,
          categoryChanges,
          teacherChanges
        }
      });
    } catch (error) {
      console.error("Error fetching observation comparison:", error);
      res.status(500).json({ message: "Failed to fetch comparison data" });
    }
  });

  // Dashboard stats endpoint
  app.get("/api/dashboard/stats", isAuthenticated, async (req: any, res) => {
    try {
      const schoolId = req.query.schoolId as string;
      const user = req.user;
      
      if (!schoolId) {
        return res.status(400).json({ message: "schoolId parameter is required" });
      }

      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Verify user has access to this school
      if (user.global_role !== "Creator") {
        const membership = await storage.getMembershipByUserAndSchool(user.id, schoolId);
        if (!membership) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this school" });
        }
      }

      // Get all observations for this school
      const schoolObservations = await storage.getObservationsBySchool(schoolId);

      // Calculate stats
      const totalObservations = schoolObservations.length;
      
      // Get unique teachers from observations
      const uniqueTeacherIds = new Set(schoolObservations.map(obs => obs.teacherId));
      const activeTeachers = uniqueTeacherIds.size;

      // Calculate average score
      const avgScore = totalObservations > 0
        ? (schoolObservations.reduce((sum, obs) => sum + obs.totalScore, 0) / 
           schoolObservations.reduce((sum, obs) => sum + obs.totalMaxScore, 0)) * 5
        : 0;

      // Calculate improvement (compare this month to last month)
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const thisMonthObs = schoolObservations.filter(obs => new Date(obs.date) >= thisMonthStart);
      const lastMonthObs = schoolObservations.filter(obs => {
        const obsDate = new Date(obs.date);
        return obsDate >= lastMonthStart && obsDate < thisMonthStart;
      });

      const thisMonthAvg = thisMonthObs.length > 0
        ? (thisMonthObs.reduce((sum, obs) => sum + obs.totalScore, 0) / 
           thisMonthObs.reduce((sum, obs) => sum + obs.totalMaxScore, 0)) * 5
        : 0;

      const lastMonthAvg = lastMonthObs.length > 0
        ? (lastMonthObs.reduce((sum, obs) => sum + obs.totalScore, 0) / 
           lastMonthObs.reduce((sum, obs) => sum + obs.totalMaxScore, 0)) * 5
        : 0;

      const improvement = lastMonthAvg > 0
        ? ((thisMonthAvg - lastMonthAvg) / lastMonthAvg) * 100
        : 0;

      res.json({
        totalObservations: thisMonthObs.length,
        activeTeachers,
        avgScore: parseFloat(avgScore.toFixed(1)),
        improvement: parseFloat(improvement.toFixed(0)),
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Get teachers for observation dropdown
  // Note: Anyone can observe anyone in their school. View permissions only control viewing observations.
  app.get("/api/teachers", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const schoolId = req.query.schoolId as string;

      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      // Verify the user has access to this school BEFORE fetching any data
      if (user.global_role !== "Creator") {
        const membership = await storage.getMembershipByUserAndSchool(user.id, schoolId);
        
        if (!membership) {
          return res.status(403).json({ 
            message: "Forbidden: You do not have access to this school's teachers" 
          });
        }
      }

      // Get users who are members of this school
      const schoolMemberships = await storage.getMembershipsBySchool(schoolId);
      
      // Fetch all users from the memberships
      const allUsers = await Promise.all(
        schoolMemberships.map(async m => {
          const userData = await storage.getUser(m.userId);
          return userData ? { ...userData, membershipRole: m.role } : null;
        })
      );
      
      // Filter to only valid users (all roles can be observed)
      const validUsers = allUsers.filter(u => u !== null);

      // All school members can observe anyone else in their school
      // Observation view permissions only control who can VIEW observations, not who can BE observed
      const sanitized = validUsers.map(sanitizeUser);
      res.json(sanitized);
    } catch (error) {
      console.error("Error fetching teachers for observation:", error);
      res.status(500).json({ message: "Failed to fetch teachers" });
    }
  });

  // Update teacher/user information (including date of birth)
  app.patch("/api/teachers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;
      const { name, email, role, profilePicture, groupId, dateOfBirth, schoolId } = req.body;

      // Check if this is the user updating themselves or if they have admin rights
      const isOwnProfile = user.id === id;
      
      if (!isOwnProfile && user.global_role !== "Creator") {
        // Get the caller's memberships
        const callerMemberships = await storage.getMembershipsByUser(user.id);
        
        // Check if caller is Admin/Leader in any school
        const isAdminOrLeader = callerMemberships.some(m => m.role === "Admin" || m.role === "Leader");
        if (!isAdminOrLeader) {
          return res.status(403).json({ message: "Forbidden: You can only update your own profile or need Admin/Leader privileges" });
        }
        
        // If schoolId provided, verify caller has Admin/Leader role in that school
        if (schoolId) {
          const callerMembershipInSchool = callerMemberships.find(m => m.schoolId === schoolId);
          if (!callerMembershipInSchool || (callerMembershipInSchool.role !== "Admin" && callerMembershipInSchool.role !== "Leader")) {
            return res.status(403).json({ message: "Forbidden: You need Admin/Leader role in this school" });
          }
          
          // Verify target user is in the same school
          const targetMemberships = await storage.getMembershipsByUser(id);
          const targetInSchool = targetMemberships.some(m => m.schoolId === schoolId);
          if (!targetInSchool) {
            return res.status(403).json({ message: "Forbidden: Target user is not in this school" });
          }
        }
      }

      // Parse name into first_name and last_name if provided
      let firstName: string | undefined;
      let lastName: string | undefined;
      if (name) {
        const nameParts = name.trim().split(/\s+/);
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(" ");
      }

      // Check if email is being changed and if it's already in use
      if (email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.id !== id) {
          return res.status(400).json({ message: "Email is already in use by another user" });
        }
      }

      // Update user
      const updatedUser = await storage.updateUser(id, {
        first_name: firstName !== undefined ? firstName : undefined,
        last_name: lastName !== undefined ? lastName : undefined,
        email: email !== undefined ? email : undefined,
        profile_image_url: profilePicture !== undefined ? profilePicture : undefined,
        date_of_birth: dateOfBirth || null,
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update membership role if provided
      if (role) {
        const memberships = await storage.getMembershipsByUser(id);
        for (const membership of memberships) {
          await storage.updateMembership(membership.id, { role });
        }
      }

      // Update teaching group if provided
      if (groupId) {
        const memberships = await storage.getMembershipsByUser(id);
        for (const membership of memberships) {
          await storage.updateMembership(membership.id, { departmentId: groupId });
        }
      }

      res.json(sanitizeUser(updatedUser));
    } catch (error) {
      console.error("Error updating teacher:", error);
      res.status(500).json({ message: "Failed to update teacher" });
    }
  });

  // Observation routes with granular permission-based filtering
  app.get("/api/observations", isAuthenticated, requireFeature("observations"), async (req: any, res) => {
    try {
      const user = req.user;
      const schoolId = req.query.schoolId as string;

      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      // Get all users for the school to build teacher name lookup
      const schoolMemberships = await storage.getMembershipsBySchool(schoolId);
      const schoolUsers = await Promise.all(schoolMemberships.map(m => storage.getUser(m.userId)));
      const userMap = new Map(schoolUsers.filter(Boolean).map(u => [u!.id, u!]));

      // Determine if user can see scores (only Creators, Admins, and Leaders can see scores)
      const membership = await storage.getMembershipByUserAndSchool(user.id, schoolId);
      const userRole = user.global_role === "Creator" ? "Creator" : (membership?.role || "Teacher");
      const canSeeScores = userRole === "Creator" || userRole === "Admin" || userRole === "Leader";

      // Helper to strip scores from observation
      const stripScores = (obs: any) => {
        const { totalScore, totalMaxScore, ...rest } = obs;
        return rest;
      };

      // Helper to add teacher name, categories, and habit names to observation
      const enrichObservation = async (obs: any) => {
        const teacher = userMap.get(obs.teacherId);
        const teacherName = teacher 
          ? `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email
          : "Unknown Teacher";
        
        const rubric = await storage.getRubric(obs.rubricId);
        if (!rubric) return { ...obs, teacherName, categories: [], habitNames: [] };
        
        const categories = await storage.getCategoriesByRubric(rubric.id);
        
        // Get observation habits for filtering - need to look up habit text from habits table
        const observationHabits = await storage.getObservationHabitsByObservation(obs.id);
        const observedHabits = observationHabits.filter(oh => oh.observed);
        const habitNames: string[] = [];
        for (const oh of observedHabits) {
          const habit = await storage.getHabit(oh.habitId);
          if (habit) {
            habitNames.push(habit.text);
          }
        }
        
        const enriched = {
          ...obs,
          teacherName,
          habitNames,
          categories: categories
            .filter(cat => cat.habits && cat.habits.length > 0)
            .map(cat => ({ categoryName: cat.name })),
        };

        // Strip scores if user is a Teacher (not Creator, Admin, or Leader)
        return canSeeScores ? enriched : stripScores(enriched);
      };

      // Creators can see all observations across all schools
      if (user.global_role === "Creator") {
        const observations = await storage.getObservationsBySchool(schoolId);
        const observationsWithDetails = await Promise.all(observations.map(enrichObservation));
        return res.json(observationsWithDetails);
      }

      if (!membership) {
        return res.status(403).json({ 
          message: "Forbidden: You do not have access to this school's observations" 
        });
      }

      const role = membership.role || "Teacher";

      // Admins can see all observations in their school
      if (role === "Admin") {
        const observations = await storage.getObservationsBySchool(schoolId);
        const observationsWithDetails = await Promise.all(observations.map(enrichObservation));
        return res.json(observationsWithDetails);
      }

      // Leaders and Teachers: See their own observations + observations for teachers they have explicit permission to view
      // Get the list of teachers this user can view
      const viewPermissions = await storage.getObservationViewPermissionsByViewer(user.id, schoolId);
      const viewableTeacherIds = viewPermissions.map(p => p.viewableTeacherId);

      // Always include the user's own observations
      const allowedTeacherIds = new Set([user.id, ...viewableTeacherIds]);

      // Fetch all observations for the school
      const allObservations = await storage.getObservationsBySchool(schoolId);
      
      // Filter to only observations for teachers this user has permission to view (including themselves)
      const filteredObservations = allObservations.filter(obs => 
        allowedTeacherIds.has(obs.teacherId)
      );

      const observationsWithDetails = await Promise.all(filteredObservations.map(enrichObservation));
      res.json(observationsWithDetails);
    } catch (error) {
      console.error("Error fetching observations:", error);
      res.status(500).json({ message: "Failed to fetch observations" });
    }
  });

  // Get a single observation with full details (categories and habits)
  app.get("/api/observations/:id", isAuthenticated, requireFeature("observations"), async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      const observation = await storage.getObservation(id);
      if (!observation) {
        return res.status(404).json({ message: "Observation not found" });
      }

      // Check access permissions and determine role
      let canSeeScores = user.global_role === "Creator";
      
      if (user.global_role !== "Creator") {
        const membership = await storage.getMembershipByUserAndSchool(user.id, observation.schoolId);
        
        if (!membership) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this school" });
        }

        // Check if user can view this observation
        const role = membership.role || "Teacher";
        
        // Determine if user can see scores (only Creators, Admins, and Leaders)
        canSeeScores = role === "Admin" || role === "Leader";
        
        if (role !== "Admin") {
          // Teachers and Leaders can only see their own observations or those they have permission for
          const viewPermissions = await storage.getObservationViewPermissionsByViewer(user.id, observation.schoolId);
          const viewableTeacherIds = viewPermissions.map(p => p.viewableTeacherId);
          const allowedTeacherIds = new Set([user.id, ...viewableTeacherIds]);

          if (!allowedTeacherIds.has(observation.teacherId)) {
            return res.status(403).json({ message: "Forbidden: You don't have permission to view this observation" });
          }
        }
      }

      // Fetch observation habits
      const observationHabits = await storage.getObservationHabitsByObservation(id);

      // Fetch rubric categories and habits
      const rubric = await storage.getRubric(observation.rubricId);
      if (!rubric) {
        return res.status(404).json({ message: "Rubric not found" });
      }

      const allCategories = await storage.getCategoriesByRubric(rubric.id);

      // Build categories with habit observation status - only include categories that were actually used in the observation
      const categories = allCategories
        .map(category => {
          // Only include this category if it has observation habits recorded
          const categoryHabits = observationHabits.filter(oh => oh.categoryId === category.id);
          
          // Skip categories with no recorded habits
          if (categoryHabits.length === 0) {
            return null;
          }

          const habits = category.habits.map(habit => {
            const habitObs = categoryHabits.find(oh => oh.habitId === habit.id);
            return {
              id: habit.id,
              text: habit.text,
              description: habit.description,
              observed: habitObs?.observed || false,
            };
          });

          const score = habits.filter(h => h.observed).length;
          const maxScore = habits.length;

          // Only include scores if user can see them
          if (canSeeScores) {
            return {
              id: category.id,
              name: category.name,
              habits,
              score,
              maxScore,
            };
          } else {
            return {
              id: category.id,
              name: category.name,
              habits,
            };
          }
        })
        .filter((cat): cat is NonNullable<typeof cat> => cat !== null && cat.habits.length > 0); // Only include categories that were used in the observation

      // Strip observation-level scores for Teachers
      if (canSeeScores) {
        res.json({
          ...observation,
          categories,
        });
      } else {
        const { totalScore, totalMaxScore, ...observationWithoutScores } = observation;
        res.json({
          ...observationWithoutScores,
          categories,
        });
      }
    } catch (error) {
      console.error("Error fetching observation details:", error);
      res.status(500).json({ message: "Failed to fetch observation details" });
    }
  });

  app.post("/api/observations", isAuthenticated, requireFeature("observations"), async (req: any, res) => {
    try {
      const user = req.user;
      
      // Remove observerId and habits from body and set them from authenticated user
      const { observerId: _, date, habits, ...bodyWithoutObserver } = req.body;
      const validated = insertObservationSchema.parse({
        ...bodyWithoutObserver,
        observerId: user.id, // Set observer to authenticated user
        date: date ? new Date(date) : new Date(), // Convert string to Date
      });
      
      // Verify user has access to the school
      if (user.global_role !== "Creator") {
        const userMemberships = await storage.getMembershipsByUser(user.id);
        const hasAccess = userMemberships.some(m => m.schoolId === validated.schoolId);
        
        if (!hasAccess) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this school" });
        }
      }
      
      const observation = await storage.createObservation(validated);
      
      // Save observation habits
      if (habits && Array.isArray(habits)) {
        for (const habit of habits) {
          await storage.createObservationHabit({
            observationId: observation.id,
            categoryId: habit.categoryId,
            habitId: habit.habitId,
            observed: habit.observed,
          });
        }
      }
      
      // Send email notification to the teacher being observed (fire-and-forget)
      void (async () => {
        try {
          // teacherId now references users.id directly  
          const teacher = await storage.getUser(validated.teacherId);
          const observer = await storage.getUser(validated.observerId);
          
          if (teacher?.email && observer) {
            const teacherName = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email;
            const observerName = `${observer.first_name || ''} ${observer.last_name || ''}`.trim() || observer.email;
            const observationDate = validated.date.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
            
            await emailService.sendObservationNotification({
              to: teacher.email,
              teacherName,
              observerName,
              observationDate,
              observationId: observation.id,
            });
          }
        } catch (error) {
          // Email errors are logged in emailService.safeSendEmail
        }
      })();
      
      res.status(201).json(observation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid observation data", errors: error.errors });
      }
      console.error("Error creating observation:", error);
      res.status(500).json({ message: "Failed to create observation" });
    }
  });

  // Observation View Permissions routes (Admin/Creator only)
  
  // Get all observation view permissions for a school
  app.get("/api/observation-view-permissions", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const schoolId = req.query.schoolId as string;

      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      // Only Admins and Creators can manage observation view permissions
      if (user.global_role !== "Creator") {
        const membership = await storage.getMembershipByUserAndSchool(user.id, schoolId);
        
        if (!membership || membership.role !== "Admin") {
          return res.status(403).json({ 
            message: "Forbidden: Only Admins and Creators can view observation permissions" 
          });
        }
      }

      const permissions = await storage.getObservationViewPermissionsBySchool(schoolId);
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching observation view permissions:", error);
      res.status(500).json({ message: "Failed to fetch observation view permissions" });
    }
  });

  // Create observation view permission
  app.post("/api/observation-view-permissions", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const { viewerId, viewableTeacherId, schoolId } = req.body;

      if (!viewerId || !viewableTeacherId || !schoolId) {
        return res.status(400).json({ message: "viewerId, viewableTeacherId, and schoolId are required" });
      }

      // Only Admins and Creators can manage observation view permissions
      if (user.global_role !== "Creator") {
        const membership = await storage.getMembershipByUserAndSchool(user.id, schoolId);
        
        if (!membership || membership.role !== "Admin") {
          return res.status(403).json({ 
            message: "Forbidden: Only Admins and Creators can manage observation permissions" 
          });
        }
      }

      const permission = await storage.createObservationViewPermission({
        viewerId,
        viewableTeacherId,
        schoolId,
      });

      res.status(201).json(permission);
    } catch (error) {
      console.error("Error creating observation view permission:", error);
      res.status(500).json({ message: "Failed to create observation view permission" });
    }
  });

  // Delete observation view permission
  app.delete("/api/observation-view-permissions", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const { viewerId, viewableTeacherId, schoolId } = req.body;

      if (!viewerId || !viewableTeacherId || !schoolId) {
        return res.status(400).json({ message: "viewerId, viewableTeacherId, and schoolId are required" });
      }

      // Only Admins and Creators can manage observation view permissions
      if (user.global_role !== "Creator") {
        const membership = await storage.getMembershipByUserAndSchool(user.id, schoolId);
        
        if (!membership || membership.role !== "Admin") {
          return res.status(403).json({ 
            message: "Forbidden: Only Admins and Creators can manage observation permissions" 
          });
        }
      }

      const deleted = await storage.deleteObservationViewPermissionByFields(viewerId, viewableTeacherId, schoolId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Permission not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting observation view permission:", error);
      res.status(500).json({ message: "Failed to delete observation view permission" });
    }
  });

  // Rubrics routes
  
  // Get all rubrics for a school
  app.get("/api/schools/:schoolId/rubrics", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const { schoolId } = req.params;

      // Verify user has access to this school
      if (user.global_role !== "Creator") {
        const membership = await storage.getMembershipByUserAndSchool(user.id, schoolId);
        if (!membership) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this school" });
        }
      }

      const rubrics = await storage.getRubricsBySchool(schoolId);
      res.json(rubrics);
    } catch (error) {
      console.error("Error fetching rubrics:", error);
      res.status(500).json({ message: "Failed to fetch rubrics" });
    }
  });

  // Create a rubric
  app.post("/api/schools/:schoolId/rubrics", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const { schoolId } = req.params;

      // Only Admin or Creator can create rubrics
      if (user.global_role !== "Creator") {
        const membership = await storage.getMembershipByUserAndSchool(user.id, schoolId);
        if (!membership || membership.role !== "Admin") {
          return res.status(403).json({ message: "Forbidden: Only Admins or Creators can create rubrics" });
        }
      }

      const validated = insertRubricSchema.parse({ ...req.body, schoolId });
      
      // If creating an active rubric, archive any currently active rubrics
      if (validated.status === "active") {
        const allRubrics = await storage.getRubricsBySchool(schoolId);
        for (const r of allRubrics) {
          if (r.status === "active") {
            await storage.updateRubric(r.id, { status: "archived" });
          }
        }
      }
      
      const rubric = await storage.createRubric(validated);
      res.status(201).json(rubric);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid rubric data", errors: error.errors });
      }
      console.error("Error creating rubric:", error);
      res.status(500).json({ message: "Failed to create rubric" });
    }
  });

  // Roll forward rubric to new academic year
  app.post("/api/schools/:schoolId/rubrics/roll-forward", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const { schoolId } = req.params;
      const { sourceRubricId, academicYear, activationDate } = req.body;

      // Only Admin or Creator can roll forward rubrics
      if (user.global_role !== "Creator") {
        const membership = await storage.getMembershipByUserAndSchool(user.id, schoolId);
        if (!membership || membership.role !== "Admin") {
          return res.status(403).json({ message: "Forbidden: Only Admins or Creators can roll forward rubrics" });
        }
      }

      // Validate required fields
      if (!sourceRubricId || !academicYear) {
        return res.status(400).json({ message: "sourceRubricId and academicYear are required" });
      }

      // Get source rubric
      const sourceRubric = await storage.getRubric(sourceRubricId);
      if (!sourceRubric) {
        return res.status(404).json({ message: "Source rubric not found" });
      }

      if (sourceRubric.schoolId !== schoolId) {
        return res.status(403).json({ message: "Source rubric does not belong to this school" });
      }

      // Determine status based on activation date
      const now = new Date();
      const activationDateObj = activationDate ? new Date(activationDate) : null;
      const status = !activationDateObj || activationDateObj <= now ? "active" : "scheduled";

      // If activating immediately, archive any currently active rubrics
      if (status === "active") {
        const allRubrics = await storage.getRubricsBySchool(schoolId);
        for (const r of allRubrics) {
          if (r.status === "active") {
            await storage.updateRubric(r.id, { status: "archived" });
          }
        }
      }

      // Create new rubric
      const newRubric = await storage.createRubric({
        schoolId,
        name: sourceRubric.name,
        academicYear,
        activationDate: activationDateObj,
        status,
      });

      // Get all categories for source rubric
      const sourceCategories = await storage.getCategoriesByRubric(sourceRubricId);

      // Copy categories and habits
      for (const sourceCategory of sourceCategories) {
        const newCategory = await storage.createCategory({
          rubricId: newRubric.id,
          name: sourceCategory.name,
          order: sourceCategory.order,
        });

        // Get habits for this category
        const sourceHabits = await storage.getHabitsByCategory(sourceCategory.id);
        
        // Copy each habit
        for (const sourceHabit of sourceHabits) {
          await storage.createHabit({
            categoryId: newCategory.id,
            text: sourceHabit.text,
            description: sourceHabit.description,
            order: sourceHabit.order,
          });
        }
      }

      res.status(201).json(newRubric);
    } catch (error) {
      console.error("Error rolling forward rubric:", error);
      res.status(500).json({ message: "Failed to roll forward rubric" });
    }
  });

  // Get rubrics pending activation for a school
  app.get("/api/schools/:schoolId/rubrics/pending-activation", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const { schoolId } = req.params;

      // Only Admin or Creator can check pending activations
      if (user.global_role !== "Creator") {
        const membership = await storage.getMembershipByUserAndSchool(user.id, schoolId);
        if (!membership || membership.role !== "Admin") {
          return res.status(403).json({ message: "Forbidden: Only Admins or Creators can check pending activations" });
        }
      }

      // Get all rubrics for the school
      const allRubrics = await storage.getRubricsBySchool(schoolId);
      
      // Filter for scheduled rubrics where activation date is today or in the past
      const now = new Date();
      const pendingRubrics = allRubrics.filter(rubric => 
        rubric.status === "scheduled" && 
        rubric.activationDate && 
        new Date(rubric.activationDate) <= now
      );

      res.json(pendingRubrics);
    } catch (error) {
      console.error("Error fetching pending activations:", error);
      res.status(500).json({ message: "Failed to fetch pending activations" });
    }
  });

  // Activate a scheduled rubric
  app.patch("/api/rubrics/:rubricId/activate", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const { rubricId } = req.params;

      // Get rubric to check school access
      const rubric = await storage.getRubric(rubricId);
      if (!rubric) {
        return res.status(404).json({ message: "Rubric not found" });
      }

      // Only Admin or Creator can activate rubrics
      if (user.global_role !== "Creator") {
        const membership = await storage.getMembershipByUserAndSchool(user.id, rubric.schoolId);
        if (!membership || membership.role !== "Admin") {
          return res.status(403).json({ message: "Forbidden: Only Admins or Creators can activate rubrics" });
        }
      }

      // Get all rubrics for this school
      const allRubrics = await storage.getRubricsBySchool(rubric.schoolId);

      // Archive any currently active rubrics
      for (const r of allRubrics) {
        if (r.id !== rubricId && r.status === "active") {
          await storage.updateRubric(r.id, { status: "archived" });
        }
      }

      // Activate this rubric
      const updatedRubric = await storage.updateRubric(rubricId, { status: "active" });

      res.json(updatedRubric);
    } catch (error) {
      console.error("Error activating rubric:", error);
      res.status(500).json({ message: "Failed to activate rubric" });
    }
  });

  // Get categories with habits for a rubric
  app.get("/api/rubrics/:rubricId/categories", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const { rubricId } = req.params;

      // Get rubric to check school access
      const rubric = await storage.getRubric(rubricId);
      if (!rubric) {
        return res.status(404).json({ message: "Rubric not found" });
      }

      // Verify user has access to this rubric's school
      if (user.global_role !== "Creator") {
        const membership = await storage.getMembershipByUserAndSchool(user.id, rubric.schoolId);
        if (!membership) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this school" });
        }
      }

      const categories = await storage.getCategoriesByRubric(rubricId);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // Create a category
  app.post("/api/rubrics/:rubricId/categories", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const { rubricId } = req.params;

      // Get rubric to check school access
      const rubric = await storage.getRubric(rubricId);
      if (!rubric) {
        return res.status(404).json({ message: "Rubric not found" });
      }

      // Only Admin or Creator can create categories
      if (user.global_role !== "Creator") {
        const membership = await storage.getMembershipByUserAndSchool(user.id, rubric.schoolId);
        if (!membership || membership.role !== "Admin") {
          return res.status(403).json({ message: "Forbidden: Only Admins or Creators can create categories" });
        }
      }

      // Get existing categories to calculate next order
      const existingCategories = await storage.getCategoriesByRubric(rubricId);
      const nextOrder = existingCategories.length;

      const validated = insertCategorySchema.parse({ ...req.body, rubricId, order: nextOrder });
      const category = await storage.createCategory(validated);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid category data", errors: error.errors });
      }
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  // Update a category
  app.put("/api/categories/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      // Get category to check access
      const category = await storage.getCategory(id);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      // Get rubric to check school access
      const rubric = await storage.getRubric(category.rubricId);
      if (!rubric) {
        return res.status(404).json({ message: "Rubric not found" });
      }

      // Only Admin or Creator can update categories
      if (user.global_role !== "Creator") {
        const membership = await storage.getMembershipByUserAndSchool(user.id, rubric.schoolId);
        if (!membership || membership.role !== "Admin") {
          return res.status(403).json({ message: "Forbidden: Only Admins or Creators can update categories" });
        }
      }

      const updated = await storage.updateCategory(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  // Delete a category
  app.delete("/api/categories/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      // Get category to check access
      const category = await storage.getCategory(id);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      // Get rubric to check school access
      const rubric = await storage.getRubric(category.rubricId);
      if (!rubric) {
        return res.status(404).json({ message: "Rubric not found" });
      }

      // Only Admin or Creator can delete categories
      if (user.global_role !== "Creator") {
        const membership = await storage.getMembershipByUserAndSchool(user.id, rubric.schoolId);
        if (!membership || membership.role !== "Admin") {
          return res.status(403).json({ message: "Forbidden: Only Admins or Creators can delete categories" });
        }
      }

      const deleted = await storage.deleteCategory(id);
      if (!deleted) {
        return res.status(404).json({ message: "Category not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // Create a habit
  app.post("/api/categories/:categoryId/habits", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const { categoryId } = req.params;

      // Get category to check access
      const category = await storage.getCategory(categoryId);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      // Get rubric to check school access
      const rubric = await storage.getRubric(category.rubricId);
      if (!rubric) {
        return res.status(404).json({ message: "Rubric not found" });
      }

      // Only Admin or Creator can create habits
      if (user.global_role !== "Creator") {
        const membership = await storage.getMembershipByUserAndSchool(user.id, rubric.schoolId);
        if (!membership || membership.role !== "Admin") {
          return res.status(403).json({ message: "Forbidden: Only Admins or Creators can create habits" });
        }
      }

      // Get existing habits to calculate next order
      const categoryWithHabits = await storage.getCategoriesByRubric(rubric.id);
      const currentCategory = categoryWithHabits.find(c => c.id === categoryId);
      const nextOrder = currentCategory?.habits.length || 0;

      // Use description for both text and description fields
      const { description } = req.body;
      const validated = insertHabitSchema.parse({ 
        categoryId, 
        text: description, 
        description, 
        order: nextOrder 
      });
      const habit = await storage.createHabit(validated);
      res.status(201).json(habit);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid habit data", errors: error.errors });
      }
      console.error("Error creating habit:", error);
      res.status(500).json({ message: "Failed to create habit" });
    }
  });

  // Update a habit
  app.put("/api/habits/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      // Get habit to check access
      const habit = await storage.getHabit(id);
      if (!habit) {
        return res.status(404).json({ message: "Habit not found" });
      }

      // Get category to check access
      const category = await storage.getCategory(habit.categoryId);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      // Get rubric to check school access
      const rubric = await storage.getRubric(category.rubricId);
      if (!rubric) {
        return res.status(404).json({ message: "Rubric not found" });
      }

      // Only Admin or Creator can update habits
      if (user.global_role !== "Creator") {
        const membership = await storage.getMembershipByUserAndSchool(user.id, rubric.schoolId);
        if (!membership || membership.role !== "Admin") {
          return res.status(403).json({ message: "Forbidden: Only Admins or Creators can update habits" });
        }
      }

      const updated = await storage.updateHabit(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating habit:", error);
      res.status(500).json({ message: "Failed to update habit" });
    }
  });

  // Delete a habit
  app.delete("/api/habits/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      // Get habit to check access
      const habit = await storage.getHabit(id);
      if (!habit) {
        return res.status(404).json({ message: "Habit not found" });
      }

      // Get category to check access
      const category = await storage.getCategory(habit.categoryId);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      // Get rubric to check school access
      const rubric = await storage.getRubric(category.rubricId);
      if (!rubric) {
        return res.status(404).json({ message: "Rubric not found" });
      }

      // Only Admin or Creator can delete habits
      if (user.global_role !== "Creator") {
        const membership = await storage.getMembershipByUserAndSchool(user.id, rubric.schoolId);
        if (!membership || membership.role !== "Admin") {
          return res.status(403).json({ message: "Forbidden: Only Admins or Creators can delete habits" });
        }
      }

      const deleted = await storage.deleteHabit(id);
      if (!deleted) {
        return res.status(404).json({ message: "Habit not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting habit:", error);
      res.status(500).json({ message: "Failed to delete habit" });
    }
  });

  // Object Storage routes - Referenced from blueprint:javascript_object_storage
  
  // Endpoint for serving uploaded profile pictures with ACL check
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
    const userId = req.user.id;
    const objectStorageService = new ObjectStorageService();
    
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      
      if (!canAccess) {
        return res.sendStatus(401);
      }
      
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Endpoint for getting presigned upload URL
  app.post("/api/objects/upload", isAuthenticated, async (req: any, res) => {
    const userId = req.user.id;
    
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
  });

  // Endpoint for setting ACL on uploaded object (doesn't update database)
  app.post("/api/objects/set-acl", isAuthenticated, async (req: any, res) => {
    const userId = req.user.id;
    
    if (!req.body.objectURL) {
      return res.status(400).json({ error: "objectURL is required" });
    }

    // Default to private visibility for security, allow explicit public setting
    const visibility = req.body.visibility === "public" ? "public" : "private";

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.objectURL,
        {
          owner: userId,
          visibility,
        },
      );

      res.status(200).json({
        objectPath: objectPath,
      });
    } catch (error) {
      console.error("Error setting object ACL:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Endpoint for updating current user's profile picture (sets ACL + updates database)
  app.put("/api/profile-pictures", isAuthenticated, async (req: any, res) => {
    const userId = req.user.id;
    
    if (!req.body.profilePictureURL) {
      return res.status(400).json({ error: "profilePictureURL is required" });
    }

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.profilePictureURL,
        {
          owner: userId,
          // Profile pictures are public so they can be viewed by other users
          visibility: "public",
        },
      );

      // Update the user's profile picture in the database
      const updatedUser = await storage.updateUser(userId, {
        profile_image_url: objectPath,
      });

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.status(200).json({
        objectPath: objectPath,
        user: updatedUser,
      });
    } catch (error) {
      console.error("Error setting profile picture:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Student routes - for behaviour management
  
  // Get all students for a school
  app.get("/api/schools/:schoolId/students", isAuthenticated, requireFeature("behaviour"), async (req: any, res) => {
    try {
      const user = req.user;
      const { schoolId } = req.params;
      const includeArchived = req.query.includeArchived === "true";

      // Verify user has access to this school
      // All users in behaviour-enabled schools can VIEW students (to raise on-calls)
      // Only users with canManageBehaviour can MANAGE students
      const membership = await storage.getMembershipByUserAndSchool(user.id, schoolId);
      if (!membership) {
        return res.status(403).json({ message: "Forbidden: You don't have access to this school" });
      }

      const students = await storage.getStudentsBySchool(schoolId, includeArchived);
      res.json(students);
    } catch (error) {
      console.error("Error fetching students:", error);
      res.status(500).json({ message: "Failed to fetch students" });
    }
  });

  // Create a student
  app.post("/api/schools/:schoolId/students", isAuthenticated, requireFeature("behaviour"), async (req: any, res) => {
    try {
      const user = req.user;
      const { schoolId } = req.params;

      // Verify user has behaviour permission (even Creators need this)
      const membership = await storage.getMembershipByUserAndSchool(user.id, schoolId);
      if (!membership || !membership.canManageBehaviour) {
        return res.status(403).json({ message: "Forbidden: You don't have behaviour management permission" });
      }

      const studentData = { ...req.body, schoolId };
      const student = await storage.createStudent(studentData);
      res.status(201).json(student);
    } catch (error) {
      console.error("Error creating student:", error);
      res.status(500).json({ message: "Failed to create student" });
    }
  });

  // Update a student
  app.patch("/api/students/:id", isAuthenticated, requireFeature("behaviour"), async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      // Get the student to verify school access
      const student = await storage.getStudent(id);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Verify user has behaviour permission for this school (even Creators need this)
      const membership = await storage.getMembershipByUserAndSchool(user.id, student.schoolId);
      if (!membership || !membership.canManageBehaviour) {
        return res.status(403).json({ message: "Forbidden: You don't have behaviour management permission" });
      }

      const updated = await storage.updateStudent(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating student:", error);
      res.status(500).json({ message: "Failed to update student" });
    }
  });

  // Toggle archive status for a student
  app.patch("/api/students/:id/archive", isAuthenticated, requireFeature("behaviour"), async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      // Get the student to verify school access
      const student = await storage.getStudent(id);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Verify user has behaviour permission for this school
      if (user.global_role !== "Creator") {
        const membership = await storage.getMembershipByUserAndSchool(user.id, student.schoolId);
        if (!membership || !membership.canManageBehaviour) {
          return res.status(403).json({ message: "Forbidden: You don't have behaviour management permission" });
        }
      }

      const updated = await storage.updateStudent(id, { isArchived: !student.isArchived });
      res.json(updated);
    } catch (error) {
      console.error("Error archiving student:", error);
      res.status(500).json({ message: "Failed to archive student" });
    }
  });

  // Import students from CSV
  app.post("/api/schools/:schoolId/students/import-csv", isAuthenticated, requireFeature("behaviour"), async (req: any, res) => {
    try {
      const user = req.user;
      const { schoolId } = req.params;
      const { csvData } = req.body;

      // Verify user has behaviour permission
      if (user.global_role !== "Creator") {
        const membership = await storage.getMembershipByUserAndSchool(user.id, schoolId);
        if (!membership || !membership.canManageBehaviour) {
          return res.status(403).json({ message: "Forbidden: You don't have behaviour management permission" });
        }
      }

      // Parse CSV data (expecting array of {name, upn?, send, pp})
      const results = {
        created: 0,
        updated: 0,
        errors: [] as string[]
      };

      for (const row of csvData) {
        try {
          const { name, upn, send, pp } = row;
          
          if (!name || name.trim() === "") {
            results.errors.push(`Skipped row with empty name`);
            continue;
          }

          let existing = null;
          
          // First, try to find by UPN if provided (primary duplicate detection)
          if (upn && upn.trim() !== "") {
            existing = await storage.getStudentByUpnAndSchool(upn.trim(), schoolId);
          }
          
          // If no match by UPN, fall back to name matching
          if (!existing) {
            existing = await storage.getStudentByNameAndSchool(name.trim(), schoolId);
          }
          
          if (existing) {
            // Update existing student
            await storage.updateStudent(existing.id, {
              name: name.trim(),
              upn: upn?.trim() || existing.upn, // Update UPN if provided, otherwise keep existing
              send: send === "TRUE" || send === true,
              pp: pp === "TRUE" || pp === true
            });
            results.updated++;
          } else {
            // Create new student
            await storage.createStudent({
              schoolId,
              name: name.trim(),
              upn: upn?.trim() || null,
              send: send === "TRUE" || send === true,
              pp: pp === "TRUE" || pp === true,
              isArchived: false
            });
            results.created++;
          }
        } catch (rowError: any) {
          results.errors.push(`Error processing row: ${rowError.message}`);
        }
      }

      res.json(results);
    } catch (error) {
      console.error("Error importing students:", error);
      res.status(500).json({ message: "Failed to import students" });
    }
  });

  // On-Call routes - for behaviour management
  
  // Get all on-calls for a school
  app.get("/api/schools/:schoolId/oncalls", isAuthenticated, requireFeature("behaviour"), async (req: any, res) => {
    try {
      const user = req.user;
      const { schoolId } = req.params;

      // Verify user has behaviour permission (even Creators need this)
      const membership = await storage.getMembershipByUserAndSchool(user.id, schoolId);
      if (!membership || !membership.canManageBehaviour) {
        return res.status(403).json({ message: "Forbidden: You don't have behaviour management permission" });
      }

      const oncalls = await storage.getOncallsBySchool(schoolId);
      res.json(oncalls);
    } catch (error) {
      console.error("Error fetching on-calls:", error);
      res.status(500).json({ message: "Failed to fetch on-calls" });
    }
  });

  // Get a single on-call
  app.get("/api/oncalls/:id", isAuthenticated, requireFeature("behaviour"), async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      const oncall = await storage.getOncall(id);
      if (!oncall) {
        return res.status(404).json({ message: "On-call not found" });
      }

      // Verify user has access to this school
      if (user.global_role !== "Creator") {
        const membership = await storage.getMembershipByUserAndSchool(user.id, oncall.schoolId);
        if (!membership) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this school" });
        }
      }

      res.json(oncall);
    } catch (error) {
      console.error("Error fetching on-call:", error);
      res.status(500).json({ message: "Failed to fetch on-call" });
    }
  });

  // Create an on-call (and send email notifications)
  app.post("/api/schools/:schoolId/oncalls", isAuthenticated, requireFeature("behaviour"), async (req: any, res) => {
    try {
      const user = req.user;
      const { schoolId } = req.params;

      // Verify user has access to this school
      if (user.global_role !== "Creator") {
        const membership = await storage.getMembershipByUserAndSchool(user.id, schoolId);
        if (!membership) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this school" });
        }
      }

      const oncallData = {
        ...req.body,
        schoolId,
        requestedById: user.id,
        status: "open"
      };

      const oncall = await storage.createOncall(oncallData);

      // Send email notifications to all users with behaviour permission in this school
      try {
        const memberships = await storage.getMembershipsBySchool(schoolId);
        const behaviourUsers = memberships.filter(m => m.canManageBehaviour);
        
        // Get user details for each membership
        const recipientEmails: string[] = [];
        for (const membership of behaviourUsers) {
          const recipientUser = await storage.getUser(membership.userId);
          if (recipientUser && recipientUser.email) {
            recipientEmails.push(recipientUser.email);
          }
        }

        if (recipientEmails.length > 0 && resend) {
          // Get student name if available
          let studentName = "Unknown Student";
          if (oncall.studentId) {
            const student = await storage.getStudent(oncall.studentId);
            if (student) {
              studentName = student.name;
            }
          }

          const school = await storage.getSchool(schoolId);
          const schoolName = school?.name || "School";

          // Get base URL for deep link
          const baseUrl = process.env.REPL_SLUG 
            ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
            : "http://localhost:5000";

          await resend.emails.send({
            from: "Anaxi <noreply@anaxi.app>",
            to: recipientEmails,
            subject: `On-Call raised: ${studentName} at ${oncall.location}`,
            html: `
              <h2>New On-Call Incident</h2>
              <p><strong>School:</strong> ${schoolName}</p>
              <p><strong>Student:</strong> ${studentName}</p>
              <p><strong>Location:</strong> ${oncall.location}</p>
              <p><strong>Description:</strong> ${oncall.description}</p>
              <p><strong>Requested by:</strong> ${user.first_name} ${user.last_name}</p>
              <p><strong>Time:</strong> ${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}</p>
              <p><a href="${baseUrl}/behaviour-management?oncall_id=${oncall.id}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Mark as Complete</a></p>
            `
          });
        }
      } catch (emailError) {
        console.error("Error sending on-call notification emails:", emailError);
        // Don't fail the request if email fails
      }

      res.status(201).json(oncall);
    } catch (error) {
      console.error("Error creating on-call:", error);
      res.status(500).json({ message: "Failed to create on-call" });
    }
  });

  // Complete an on-call
  app.patch("/api/oncalls/:id/complete", isAuthenticated, requireFeature("behaviour"), async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;
      const { completionNotes } = req.body;

      const oncall = await storage.getOncall(id);
      if (!oncall) {
        return res.status(404).json({ message: "On-call not found" });
      }

      // Verify user has behaviour permission for this school (even Creators need this)
      const membership = await storage.getMembershipByUserAndSchool(user.id, oncall.schoolId);
      if (!membership || !membership.canManageBehaviour) {
        return res.status(403).json({ message: "Forbidden: You don't have behaviour management permission" });
      }

      const updated = await storage.updateOncall(id, {
        status: "completed",
        completedById: user.id,
        completedAt: new Date(),
        completionNotes
      });

      res.json(updated);
    } catch (error) {
      console.error("Error completing on-call:", error);
      res.status(500).json({ message: "Failed to complete on-call" });
    }
  });

  // Analytics route for behaviour management
  app.get("/api/schools/:schoolId/oncalls/analytics", isAuthenticated, requireFeature("behaviour"), async (req: any, res) => {
    try {
      const user = req.user;
      const { schoolId } = req.params;
      const { startDate, endDate } = req.query;

      // Verify user has behaviour permission for this school (even Creators need this)
      const membership = await storage.getMembershipByUserAndSchool(user.id, schoolId);
      if (!membership || !membership.canManageBehaviour) {
        return res.status(403).json({ message: "Forbidden: You don't have behaviour management permission" });
      }

      // Get all oncalls for the school
      const allOncalls = await storage.getOncallsBySchool(schoolId);

      // Filter by date range if provided
      let filteredOncalls = allOncalls;
      if (startDate && endDate) {
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        filteredOncalls = allOncalls.filter(oncall => {
          const oncallDate = new Date(oncall.createdAt);
          return oncallDate >= start && oncallDate <= end;
        });
      }

      // Calculate analytics
      const byCompleter: Record<string, { name: string; count: number; userId: string }> = {};
      const byStudent: Record<string, { name: string; open: number; completed: number; studentId: string }> = {};
      const timeOfDay: Record<number, number> = {};
      const dayOfWeek: Record<string, number> = {
        'Monday': 0,
        'Tuesday': 0,
        'Wednesday': 0,
        'Thursday': 0,
        'Friday': 0,
        'Saturday': 0,
        'Sunday': 0
      };

      for (const oncall of filteredOncalls) {
        // By completer (only for completed oncalls)
        if (oncall.status === "completed" && oncall.completedBy) {
          const completerKey = oncall.completedById;
          if (!byCompleter[completerKey]) {
            byCompleter[completerKey] = {
              name: `${oncall.completedBy.first_name} ${oncall.completedBy.last_name}`,
              count: 0,
              userId: oncall.completedById
            };
          }
          byCompleter[completerKey].count++;
        }

        // By student - use joined data from getOncallsBySchool
        if (oncall.studentId && oncall.student) {
          const studentKey = oncall.studentId;
          if (!byStudent[studentKey]) {
            byStudent[studentKey] = {
              name: oncall.student.name,
              open: 0,
              completed: 0,
              studentId: oncall.studentId
            };
          }
          if (oncall.status === "open") {
            byStudent[studentKey].open++;
          } else {
            byStudent[studentKey].completed++;
          }
        }

        // Time of day - using Europe/London timezone with date-fns-tz
        const createdDate = new Date(oncall.createdAt);
        const londonDate = toZonedTime(createdDate, 'Europe/London');
        const hour = getHours(londonDate);
        if (!timeOfDay[hour]) {
          timeOfDay[hour] = 0;
        }
        timeOfDay[hour]++;

        // Day of week - using Europe/London timezone
        const dayIndex = getDay(londonDate);
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = dayNames[dayIndex];
        if (dayOfWeek.hasOwnProperty(dayName)) {
          dayOfWeek[dayName]++;
        }
      }

      // Convert to arrays for easier frontend consumption
      const completerArray = Object.values(byCompleter).sort((a, b) => b.count - a.count);
      const studentArray = Object.values(byStudent).sort((a, b) => (b.open + b.completed) - (a.open + a.completed));
      const timeOfDayArray = Object.entries(timeOfDay).map(([hour, count]) => ({
        hour: parseInt(hour),
        count
      })).sort((a, b) => a.hour - b.hour);
      const dayOfWeekArray = Object.entries(dayOfWeek).map(([day, count]) => ({
        day,
        count
      }));

      res.json({
        byCompleter: completerArray,
        byStudent: studentArray,
        timeOfDay: timeOfDayArray,
        dayOfWeek: dayOfWeekArray,
        totalOncalls: filteredOncalls.length,
        openOncalls: filteredOncalls.filter(o => o.status === "open").length,
        completedOncalls: filteredOncalls.filter(o => o.status === "completed").length,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Birthday endpoints - for Leaders, Admins, and Creators
  
  // Get upcoming staff birthdays for a school
  app.get("/api/schools/:schoolId/birthdays/staff", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const { schoolId } = req.params;
      const daysAhead = parseInt(req.query.daysAhead as string) || 30;

      // Verify user has Leader, Admin, or Creator role
      if (user.global_role !== "Creator") {
        const membership = await storage.getMembershipByUserAndSchool(user.id, schoolId);
        if (!membership) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this school" });
        }
        if (membership.role === "Teacher") {
          return res.status(403).json({ message: "Forbidden: Only Leaders, Admins, or Creators can view birthdays" });
        }
      }

      // Get all memberships for the school
      const memberships = await storage.getMembershipsBySchool(schoolId);
      
      // Get user details with birthdays
      // Normalize today to midnight for accurate date comparison
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const currentYear = today.getFullYear();
      const staffBirthdays: Array<{
        userId: string;
        firstName: string | null;
        lastName: string | null;
        email: string;
        dateOfBirth: string;
        upcomingBirthday: string;
        daysUntil: number;
      }> = [];

      for (const membership of memberships) {
        const memberUser = await storage.getUser(membership.userId);
        if (memberUser && memberUser.date_of_birth && !memberUser.archived) {
          const dob = new Date(memberUser.date_of_birth);
          
          // Calculate this year's birthday (at midnight)
          let nextBirthday = new Date(currentYear, dob.getMonth(), dob.getDate());
          
          // If birthday has already passed this year (strictly less than today), use next year
          if (nextBirthday.getTime() < today.getTime()) {
            nextBirthday = new Date(currentYear + 1, dob.getMonth(), dob.getDate());
          }
          
          // Calculate days until birthday (both dates at midnight, so use round)
          const msPerDay = 24 * 60 * 60 * 1000;
          const daysUntil = Math.round((nextBirthday.getTime() - today.getTime()) / msPerDay);
          
          if (daysUntil >= 0 && daysUntil <= daysAhead) {
            staffBirthdays.push({
              userId: memberUser.id,
              firstName: memberUser.first_name,
              lastName: memberUser.last_name,
              email: memberUser.email,
              dateOfBirth: memberUser.date_of_birth,
              upcomingBirthday: nextBirthday.toISOString().split('T')[0],
              daysUntil,
            });
          }
        }
      }

      // Sort by days until birthday
      staffBirthdays.sort((a, b) => a.daysUntil - b.daysUntil);

      res.json(staffBirthdays);
    } catch (error) {
      console.error("Error fetching staff birthdays:", error);
      res.status(500).json({ message: "Failed to fetch staff birthdays" });
    }
  });

  // Get upcoming student birthdays for a school
  app.get("/api/schools/:schoolId/birthdays/students", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const { schoolId } = req.params;
      const daysAhead = parseInt(req.query.daysAhead as string) || 30;

      // Verify user has Leader, Admin, or Creator role
      if (user.global_role !== "Creator") {
        const membership = await storage.getMembershipByUserAndSchool(user.id, schoolId);
        if (!membership) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this school" });
        }
        if (membership.role === "Teacher") {
          return res.status(403).json({ message: "Forbidden: Only Leaders, Admins, or Creators can view birthdays" });
        }
      }

      // Get all students for the school
      const students = await storage.getStudentsBySchool(schoolId, false);
      
      // Normalize today to midnight for accurate date comparison
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const currentYear = today.getFullYear();
      const studentBirthdays: Array<{
        studentId: string;
        name: string;
        dateOfBirth: string;
        upcomingBirthday: string;
        daysUntil: number;
      }> = [];

      for (const student of students) {
        if (student.dateOfBirth) {
          const dob = new Date(student.dateOfBirth);
          
          // Calculate this year's birthday (at midnight)
          let nextBirthday = new Date(currentYear, dob.getMonth(), dob.getDate());
          
          // If birthday has already passed this year (strictly less than today), use next year
          if (nextBirthday.getTime() < today.getTime()) {
            nextBirthday = new Date(currentYear + 1, dob.getMonth(), dob.getDate());
          }
          
          // Calculate days until birthday (both dates at midnight, so use round)
          const msPerDay = 24 * 60 * 60 * 1000;
          const daysUntil = Math.round((nextBirthday.getTime() - today.getTime()) / msPerDay);
          
          if (daysUntil >= 0 && daysUntil <= daysAhead) {
            studentBirthdays.push({
              studentId: student.id,
              name: student.name,
              dateOfBirth: student.dateOfBirth,
              upcomingBirthday: nextBirthday.toISOString().split('T')[0],
              daysUntil,
            });
          }
        }
      }

      // Sort by days until birthday
      studentBirthdays.sort((a, b) => a.daysUntil - b.daysUntil);

      res.json(studentBirthdays);
    } catch (error) {
      console.error("Error fetching student birthdays:", error);
      res.status(500).json({ message: "Failed to fetch student birthdays" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
