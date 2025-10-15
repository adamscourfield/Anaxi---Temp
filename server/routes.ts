import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { DbStorage } from "./db-storage";
import { insertTeacherSchema, insertTeachingGroupSchema, insertConversationSchema } from "@shared/schema";
import { z } from "zod";
// Referenced from blueprint:javascript_object_storage
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { setupAuth, isAuthenticated } from "./auth";

const storage = new DbStorage();

// Permission middleware
type Role = "Teacher" | "Leader" | "Admin";

async function requireRole(allowedRoles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get user from authenticated session (set by isAuthenticated middleware)
      const user = (req as any).user;
      
      if (!user) {
        return res.status(401).json({ message: "Unauthorized: No authenticated user" });
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

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const authId = req.user.claims.sub;
      const user = await storage.getUserByAuthId(authId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
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
      const authUserId = req.user.claims.sub;
      
      const authUser = await storage.getUserByAuthId(authUserId);
      if (!authUser) {
        return res.status(401).json({ message: "Unauthorized: User not found" });
      }

      const currentTeacher = await storage.getTeacherByUserId(authUserId);
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
