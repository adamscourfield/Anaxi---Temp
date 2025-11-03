import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import { DbStorage } from "./db-storage";
import { db } from "./db";
import { sql, desc } from "drizzle-orm";
import { insertSchoolSchema, insertSchoolMembershipSchema, insertTeachingGroupSchema, insertDepartmentSchema, insertConversationSchema, insertMeetingSchema, insertMeetingAttendeeSchema, insertMeetingActionSchema, insertLeaveRequestSchema, insertObservationSchema, insertRubricSchema, insertCategorySchema, insertHabitSchema, meetingActions } from "@shared/schema";
import { z } from "zod";
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
      // Determine schoolId from query params, body, or existing leave request/meeting
      let schoolId: string | undefined;
      
      // Try to get schoolId from query params first
      schoolId = req.query.schoolId as string;
      
      // If not in query, try request body
      if (!schoolId && req.body && req.body.schoolId) {
        schoolId = req.body.schoolId;
      }
      
      // If still not found and this is a PATCH/DELETE on an existing resource, get it from the resource
      if (!schoolId && (req.method === 'PATCH' || req.method === 'DELETE' || req.method === 'GET') && req.params.id) {
        // For leave requests
        if (req.path.includes('/leave-requests/')) {
          const leaveRequest = await storage.getLeaveRequest(req.params.id);
          if (leaveRequest) {
            schoolId = leaveRequest.schoolId;
          }
        }
        // For meetings
        else if (req.path.includes('/meetings/')) {
          const meeting = await storage.getMeeting(req.params.id);
          if (meeting) {
            schoolId = meeting.schoolId;
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

      const updated = await storage.updateMembership(id, req.body);
      res.json(updated);
    } catch (error) {
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

      const { name, first_name, last_name, email, profile_image_url } = req.body;

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
      
      res.json(meeting);
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
      res.json(attendees);
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
      
      console.log("Creating attendee for meeting:", id);
      console.log("Request body:", req.body);
      
      const validated = insertMeetingAttendeeSchema.parse({ ...req.body, meetingId: id });
      console.log("Validated attendee data:", validated);
      
      const attendee = await storage.createMeetingAttendee(validated);
      res.status(201).json(attendee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Zod validation error:", error.errors);
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
      res.json(actions);
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
      const leaveRequestData = {
        ...requestData,
        membershipId: membership.id,
        status: "pending",
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
      
      res.json(leaveRequests);
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
      
      // Verify user has permission to update
      let userMembership;
      if (user.global_role !== "Creator") {
        const userMemberships = await storage.getMembershipsByUser(user.id);
        userMembership = userMemberships.find(m => m.schoolId === requestMembership.schoolId);
        
        if (!userMembership) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this school" });
        }
        
        // Only users with approve permission can approve/deny
        if (!userMembership.canApproveLeaveRequests) {
          return res.status(403).json({ message: "Forbidden: You don't have permission to approve or deny leave requests" });
        }
      }
      
      // If status is being changed to approved or denied, set approvedBy
      const finalUpdates = { ...updates };
      if (updates.status && (updates.status.includes("approved") || updates.status === "denied")) {
        // If approvedBy not provided in updates, determine it from the authenticated user
        if (!updates.approvedBy) {
          if (userMembership) {
            finalUpdates.approvedBy = userMembership.id;
          } else if (user.global_role === "Creator") {
            // For creators without membership in this school, leave approvedBy null
            // The frontend will handle this appropriately when displaying
            finalUpdates.approvedBy = null;
          }
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

      // Calculate observation trend by day of week (last 7 days)
      const now = new Date();
      const last7Days = [];
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dayName = dayNames[date.getDay()];
        const count = schoolObservations.filter(obs => {
          const obsDate = new Date(obs.date);
          return obsDate.toDateString() === date.toDateString();
        }).length;
        
        last7Days.push({ label: dayName, value: count });
      }

      // Calculate top performers (teachers with highest avg scores)
      const teacherScores: Record<string, { totalScore: number; totalMaxScore: number; count: number; name: string }> = {};
      
      for (const obs of schoolObservations) {
        if (!teacherScores[obs.teacherId]) {
          teacherScores[obs.teacherId] = {
            totalScore: 0,
            totalMaxScore: 0,
            count: 0,
            name: obs.teacher?.name || "Unknown"
          };
        }
        teacherScores[obs.teacherId].totalScore += obs.totalScore;
        teacherScores[obs.teacherId].totalMaxScore += obs.totalMaxScore;
        teacherScores[obs.teacherId].count += 1;
      }

      const topPerformers = Object.entries(teacherScores)
        .map(([teacherId, data]) => ({
          label: data.name,
          value: (data.totalScore / data.totalMaxScore) * 5,
          maxValue: 5
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      // Calculate category performance (avg scores by category)
      const categoryScores: Record<string, { totalScore: number; totalMaxScore: number; count: number }> = {};
      
      for (const obs of schoolObservations) {
        for (const cat of obs.categories || []) {
          if (!categoryScores[cat.categoryName]) {
            categoryScores[cat.categoryName] = {
              totalScore: 0,
              totalMaxScore: 0,
              count: 0
            };
          }
          categoryScores[cat.categoryName].totalScore += cat.score;
          categoryScores[cat.categoryName].totalMaxScore += cat.maxScore;
          categoryScores[cat.categoryName].count += 1;
        }
      }

      const categoryPerformance = Object.entries(categoryScores).map(([name, data]) => ({
        name,
        avgScore: data.totalScore / data.count,
        maxScore: data.totalMaxScore / data.count,
        trend: "stable" as const,
        trendValue: 0
      }));

      res.json({
        observationTrend: last7Days,
        topPerformers,
        categoryPerformance
      });
    } catch (error) {
      console.error("Error fetching dashboard analytics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard analytics" });
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

  // Observation routes with granular permission-based filtering
  app.get("/api/observations", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const schoolId = req.query.schoolId as string;

      if (!schoolId) {
        return res.status(400).json({ message: "School ID is required" });
      }

      // Creators can see all observations across all schools
      if (user.global_role === "Creator") {
        const observations = await storage.getObservationsBySchool(schoolId);
        
        // Add category names to each observation
        const observationsWithCategories = await Promise.all(
          observations.map(async (obs) => {
            const rubric = await storage.getRubric(obs.rubricId);
            if (!rubric) return { ...obs, categories: [] };
            
            const categories = await storage.getCategoriesByRubric(rubric.id);
            return {
              ...obs,
              categories: categories
                .filter(cat => cat.habits && cat.habits.length > 0)
                .map(cat => ({ categoryName: cat.name })),
            };
          })
        );
        
        return res.json(observationsWithCategories);
      }

      // Verify the user has membership in the requested school
      const membership = await storage.getMembershipByUserAndSchool(user.id, schoolId);
      
      if (!membership) {
        return res.status(403).json({ 
          message: "Forbidden: You do not have access to this school's observations" 
        });
      }

      const role = membership.role || "Teacher";

      // Admins can see all observations in their school
      if (role === "Admin") {
        const observations = await storage.getObservationsBySchool(schoolId);
        
        // Add category names to each observation
        const observationsWithCategories = await Promise.all(
          observations.map(async (obs) => {
            const rubric = await storage.getRubric(obs.rubricId);
            if (!rubric) return { ...obs, categories: [] };
            
            const categories = await storage.getCategoriesByRubric(rubric.id);
            return {
              ...obs,
              categories: categories
                .filter(cat => cat.habits && cat.habits.length > 0)
                .map(cat => ({ categoryName: cat.name })),
            };
          })
        );
        
        return res.json(observationsWithCategories);
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

      // Add category names to each observation
      const observationsWithCategories = await Promise.all(
        filteredObservations.map(async (obs) => {
          const rubric = await storage.getRubric(obs.rubricId);
          if (!rubric) return { ...obs, categories: [] };
          
          const categories = await storage.getCategoriesByRubric(rubric.id);
          return {
            ...obs,
            categories: categories
              .filter(cat => cat.habits && cat.habits.length > 0)
              .map(cat => ({ categoryName: cat.name })),
          };
        })
      );

      res.json(observationsWithCategories);
    } catch (error) {
      console.error("Error fetching observations:", error);
      res.status(500).json({ message: "Failed to fetch observations" });
    }
  });

  // Get a single observation with full details (categories and habits)
  app.get("/api/observations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const { id } = req.params;

      const observation = await storage.getObservation(id);
      if (!observation) {
        return res.status(404).json({ message: "Observation not found" });
      }

      // Check access permissions
      if (user.global_role !== "Creator") {
        const membership = await storage.getMembershipByUserAndSchool(user.id, observation.schoolId);
        
        if (!membership) {
          return res.status(403).json({ message: "Forbidden: You don't have access to this school" });
        }

        // Check if user can view this observation
        const role = membership.role || "Teacher";
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

          return {
            id: category.id,
            name: category.name,
            habits,
            score,
            maxScore,
          };
        })
        .filter((cat): cat is NonNullable<typeof cat> => cat !== null && cat.habits.length > 0); // Only include categories that were used in the observation

      res.json({
        ...observation,
        categories,
      });
    } catch (error) {
      console.error("Error fetching observation details:", error);
      res.status(500).json({ message: "Failed to fetch observation details" });
    }
  });

  app.post("/api/observations", isAuthenticated, async (req: any, res) => {
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
    const userId = req.user.claims.sub;
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
    const userId = req.user.claims.sub;
    
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
  });

  // Endpoint for setting ACL on uploaded object (doesn't update database)
  app.post("/api/objects/set-acl", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    
    if (!req.body.objectURL) {
      return res.status(400).json({ error: "objectURL is required" });
    }

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.objectURL,
        {
          owner: userId,
          // Profile pictures are public so they can be viewed by other users
          visibility: "public",
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
    const userId = req.user.claims.sub;
    
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

  const httpServer = createServer(app);

  return httpServer;
}
