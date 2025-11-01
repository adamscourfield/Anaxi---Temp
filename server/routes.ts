import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { DbStorage } from "./db-storage";
import { insertSchoolSchema, insertSchoolMembershipSchema, insertTeachingGroupSchema, insertConversationSchema, insertMeetingSchema, insertMeetingAttendeeSchema, insertMeetingActionSchema, insertObservationSchema } from "@shared/schema";
import { z } from "zod";
// Referenced from blueprint:javascript_object_storage
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { setupAuth, isAuthenticated, hashPassword } from "./auth";
import { emailService } from "./email";

const storage = new DbStorage();

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
      res.json(memberships);
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
        return res.json(memberships);
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
      res.json(memberships);
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
      res.json(filteredUsers);
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

      const { email, password, first_name, last_name, schoolIds, role } = req.body;

      // Validate required fields
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // Create user account
      const hashedPassword = await hashPassword(password);
      const newUser = await storage.createUser({
        email,
        password_hash: hashedPassword,
        first_name: first_name || null,
        last_name: last_name || null,
        global_role: null,
      });

      // Create school memberships if schoolIds provided
      if (schoolIds && Array.isArray(schoolIds) && schoolIds.length > 0) {
        for (const schoolId of schoolIds) {
          await storage.createMembership({
            userId: newUser.id,
            schoolId,
            role: role || "Teacher",
          });
        }
      }

      res.status(201).json(newUser);
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
          const { email, password, first_name, last_name, schoolIds, role } = teacherData;

          // Validate required fields
          if (!email || !password) {
            results.errors.push({
              email: email || "unknown",
              error: "Email and password are required",
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

          // Create user account
          const hashedPassword = await hashPassword(password);
          const newUser = await storage.createUser({
            email,
            password_hash: hashedPassword,
            first_name: first_name || null,
            last_name: last_name || null,
            global_role: null,
          });

          // Create school memberships
          if (schoolIds && Array.isArray(schoolIds) && schoolIds.length > 0) {
            for (const schoolId of schoolIds) {
              await storage.createMembership({
                userId: newUser.id,
                schoolId,
                role: role || "Teacher",
              });
            }
          }

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

      res.json(updatedUser);
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
      
      res.json({ message: "User archived successfully", user: updatedUser });
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
      
      res.json({ message: "User unarchived successfully", user: updatedUser });
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
  app.get("/api/meetings", isAuthenticated, async (req, res) => {
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
      res.json(meetings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch meetings" });
    }
  });

  app.get("/api/meetings/:id", isAuthenticated, async (req, res) => {
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

  app.post("/api/meetings", isAuthenticated, async (req, res) => {
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

  app.patch("/api/meetings/:id", isAuthenticated, async (req, res) => {
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

  app.delete("/api/meetings/:id", isAuthenticated, async (req, res) => {
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
  app.get("/api/meetings/:id/attendees", isAuthenticated, async (req, res) => {
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

  app.post("/api/meetings/:id/attendees", isAuthenticated, async (req, res) => {
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
      
      const validated = insertMeetingAttendeeSchema.parse({ ...req.body, meetingId: id });
      const attendee = await storage.createMeetingAttendee(validated);
      res.status(201).json(attendee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid attendee data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to add attendee" });
    }
  });

  app.delete("/api/meetings/:id/attendees/:attendeeId", isAuthenticated, async (req, res) => {
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
  app.get("/api/meetings/:id/actions", isAuthenticated, async (req, res) => {
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

  app.post("/api/meetings/:id/actions", isAuthenticated, async (req, res) => {
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

  app.patch("/api/meetings/:id/actions/:actionId", isAuthenticated, async (req, res) => {
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

  app.delete("/api/meetings/:id/actions/:actionId", isAuthenticated, async (req, res) => {
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

  // User lookup endpoint (for membership management)
  app.get("/api/users", isAuthenticated, async (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) {
        return res.status(400).json({ message: "Email parameter is required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
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

  // Observation routes with role-based filtering
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
        return res.json(observations);
      }

      // Verify the user has membership in the requested school
      const membership = await storage.getMembershipByUserAndSchool(user.id, schoolId);
      
      if (!membership) {
        return res.status(403).json({ 
          message: "Forbidden: You do not have access to this school's observations" 
        });
      }

      const role = membership.role || "Teacher";

      // Leaders and Admins can see all observations in their school
      if (role === "Leader" || role === "Admin") {
        const observations = await storage.getObservationsBySchool(schoolId);
        return res.json(observations);
      }

      // Teachers can only see their own observations
      // teacherId now references users.id directly
      const observations = await storage.getObservationsByTeacher(user.id);
      res.json(observations);
    } catch (error) {
      console.error("Error fetching observations:", error);
      res.status(500).json({ message: "Failed to fetch observations" });
    }
  });

  app.post("/api/observations", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Remove observerId from body and set it from authenticated user
      const { observerId: _, ...bodyWithoutObserver } = req.body;
      const validated = insertObservationSchema.parse({
        ...bodyWithoutObserver,
        observerId: user.id, // Set observer to authenticated user
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
      
      // Send email notification to the teacher being observed (fire-and-forget)
      void (async () => {
        try {
          // teacherId now references users.id directly  
          const teacher = await storage.getUser(validated.teacherId);
          const observer = await storage.getUser(validated.observerId);
          
          if (teacher?.email && observer) {
            const teacherName = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email;
            const observerName = `${observer.first_name || ''} ${observer.last_name || ''}`.trim() || observer.email;
            const observationDate = new Date(validated.date).toLocaleDateString('en-US', {
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
