import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { DbStorage } from "./db-storage";
import { insertTeacherSchema, insertSchoolSchema, insertSchoolMembershipSchema, insertTeachingGroupSchema, insertConversationSchema } from "@shared/schema";
import { z } from "zod";
// Referenced from blueprint:javascript_object_storage
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { setupAuth, isAuthenticated, hashPassword } from "./auth";

const storage = new DbStorage();

// Permission middleware
type Role = "Teacher" | "Leader" | "Admin";
type GlobalRole = "Creator";

// Middleware to require Creator global role
async function requireCreator() {
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

async function requireRole(allowedRoles: Role[]) {
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

      const teacher = await storage.getTeacherByUserId(user.id);
      
      if (!teacher) {
        return res.status(401).json({ message: "Unauthorized: No teacher profile found" });
      }

      const userRole = (teacher.role || "Teacher") as Role;
      
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ 
          message: `Forbidden: ${userRole}s are not allowed to perform this action. Required role: ${allowedRoles.join(" or ")}` 
        });
      }

      // Attach user info to request for later use
      (req as any).currentUser = teacher;
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

  // School management routes (Creator only)
  app.get("/api/schools", isAuthenticated, await requireCreator(), async (req, res) => {
    try {
      const schools = await storage.getAllSchools();
      res.json(schools);
    } catch (error) {
      console.error("Error fetching schools:", error);
      res.status(500).json({ message: "Failed to fetch schools" });
    }
  });

  app.post("/api/schools", isAuthenticated, await requireCreator(), async (req, res) => {
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

  app.patch("/api/schools/:id", isAuthenticated, await requireCreator(), async (req, res) => {
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

  app.delete("/api/schools/:id", isAuthenticated, await requireCreator(), async (req, res) => {
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

  // Teachers routes
  app.get("/api/teachers", isAuthenticated, async (req, res) => {
    const schoolId = req.query.schoolId as string;
    if (!schoolId) {
      return res.status(400).json({ message: "School ID is required" });
    }
    
    const teachers = await storage.getTeachersBySchool(schoolId);
    res.json(teachers);
  });

  app.post("/api/teachers", await requireRole(["Admin"]), async (req, res) => {
    try {
      const validated = insertTeacherSchema.parse(req.body);
      const teacher = await storage.createTeacher(validated);
      res.status(201).json(teacher);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid teacher data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create teacher" });
    }
  });

  app.patch("/api/teachers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const authUser = req.user; // User is set by isAuthenticated middleware
      
      if (!authUser) {
        return res.status(401).json({ message: "Unauthorized: User not found" });
      }

      const currentTeacher = await storage.getTeacherByUserId(authUser.id);
      if (!currentTeacher) {
        return res.status(401).json({ message: "Unauthorized: No teacher profile found" });
      }

      const userRole = (currentTeacher.role || "Teacher") as Role;
      
      // Users can edit their own profile, or Admins can edit anyone
      if (currentTeacher.id !== id && userRole !== "Admin") {
        return res.status(403).json({ 
          message: "Forbidden: You can only edit your own profile" 
        });
      }
      
      const updates = req.body;
      
      // Prevent non-admins from changing their own role
      if (currentTeacher.id === id && userRole !== "Admin" && updates.role) {
        return res.status(403).json({ 
          message: "Forbidden: You cannot change your own role" 
        });
      }
      
      const updatedTeacher = await storage.updateTeacher(id, updates);
      if (!updatedTeacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }
      
      res.json(updatedTeacher);
    } catch (error) {
      console.error("Error updating teacher:", error);
      res.status(500).json({ message: "Failed to update teacher" });
    }
  });

  app.delete("/api/teachers/:id", await requireRole(["Admin"]), async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteTeacher(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Teacher not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete teacher" });
    }
  });

  // Admin password reset route
  app.post("/api/teachers/:id/reset-password", await requireRole(["Admin"]), async (req, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;

      if (!password || typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ 
          message: "Password must be at least 8 characters" 
        });
      }

      // Get the teacher to verify they exist
      const teacher = await storage.getTeacher(id);
      if (!teacher) {
        return res.status(404).json({ message: "Teacher not found" });
      }

      if (!teacher.userId) {
        return res.status(400).json({ message: "Teacher has no associated user account" });
      }

      // Hash the new password
      const password_hash = await hashPassword(password);

      // Update the user's password
      const updatedUser = await storage.updateUser(teacher.userId, { password_hash });
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update password" });
      }

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Failed to reset password" });
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

  app.post("/api/teaching-groups", await requireRole(["Admin"]), async (req, res) => {
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

  app.patch("/api/teaching-groups/:id", await requireRole(["Admin"]), async (req, res) => {
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

  app.delete("/api/teaching-groups/:id", await requireRole(["Admin"]), async (req, res) => {
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
      const validated = insertConversationSchema.parse(req.body);
      const conversation = await storage.createConversation(validated);
      res.status(201).json(conversation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid conversation data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create conversation" });
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
      // Get teacher profile to find their teacher ID
      const teacher = await storage.getTeacherByUserId(user.id);
      
      if (!teacher) {
        return res.status(401).json({ message: "No teacher profile found" });
      }

      const observations = await storage.getObservationsByTeacher(teacher.id);
      res.json(observations);
    } catch (error) {
      console.error("Error fetching observations:", error);
      res.status(500).json({ message: "Failed to fetch observations" });
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

      // Get the teacher profile for the authenticated user
      const teacher = await storage.getTeacherByUserId(userId);
      if (!teacher) {
        return res.status(404).json({ error: "Teacher profile not found" });
      }

      // Update the teacher's profile picture in the database
      const updatedTeacher = await storage.updateTeacher(teacher.id, {
        profilePicture: objectPath,
      });

      if (!updatedTeacher) {
        return res.status(404).json({ error: "Teacher not found" });
      }

      res.status(200).json({
        objectPath: objectPath,
        teacher: updatedTeacher,
      });
    } catch (error) {
      console.error("Error setting profile picture:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
