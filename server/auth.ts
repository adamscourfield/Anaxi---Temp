import bcrypt from "bcrypt";
import session from "express-session";
import connectPg from "connect-pg-simple";
import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { storage } from "./storage";

const SALT_ROUNDS = 10;

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: sessionTtl,
    },
  });
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Register route
  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = registerSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Hash password
      const password_hash = await bcrypt.hash(data.password, SALT_ROUNDS);

      // Create user
      const user = await storage.createUser({
        email: data.email,
        password_hash,
        first_name: data.first_name || null,
        last_name: data.last_name || null,
        profile_image_url: null,
      });

      // Set session
      (req.session as any).userId = user.id;
      
      // Return user without password
      const { password_hash: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("[AUTH] Registration error:", error);
      res.status(500).json({ message: "Failed to register" });
    }
  });

  // Login route
  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);

      // Find user
      const user = await storage.getUserByEmail(data.email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Verify password
      const validPassword = await bcrypt.compare(data.password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Set session
      (req.session as any).userId = user.id;

      // Return user without password
      const { password_hash: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("[AUTH] Login error:", error);
      res.status(500).json({ message: "Failed to login" });
    }
  });

  // Logout route
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("[AUTH] Logout error:", err);
        return res.status(500).json({ message: "Failed to logout" });
      }
      // Clear the session cookie with the same options used when setting it
      res.clearCookie('connect.sid', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      });
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get current user route
  app.get("/api/auth/user", async (req, res) => {
    const userId = (req.session as any).userId;
    
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Return user without password
      const { password_hash: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("[AUTH] Get user error:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });
}

// Middleware to protect routes
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const userId = (req.session as any).userId;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = await storage.getUser(userId);
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Attach user to request
  (req as any).user = user;
  next();
};
