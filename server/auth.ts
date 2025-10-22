import bcrypt from "bcrypt";
import session from "express-session";
import connectPg from "connect-pg-simple";
import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { stytchAuth } from "./stytch";

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
      secure: process.env.NODE_ENV === 'production',
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

  // Note: Public registration has been removed. 
  // Schools must create teacher accounts through the admin interface.

  // Send magic link route
  app.post("/api/auth/magic-link", async (req, res) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);

      // Check if user exists in our system
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "No account found with this email. Please contact your school administrator." });
      }

      // Send magic link via Stytch
      await stytchAuth.sendMagicLink(email);

      res.json({ message: "Magic link sent! Check your email to log in." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid email address" });
      }
      console.error("[AUTH] Magic link error:", error);
      res.status(500).json({ message: "Failed to send magic link" });
    }
  });

  // Verify magic link and create session
  app.get("/auth/verify", async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== "string") {
        return res.redirect("/?error=invalid_token");
      }

      // Authenticate the magic link token with Stytch
      const stytchResult = await stytchAuth.authenticateMagicLink(token);

      // Find or update user in our database
      let user = await storage.getUserByEmail(stytchResult.email);
      
      if (!user) {
        // User doesn't exist in our system - shouldn't happen but handle gracefully
        return res.redirect("/?error=no_account");
      }

      // Update user's Stytch ID if not set
      if (!user.stytch_user_id) {
        await storage.updateUser(user.id, { stytch_user_id: stytchResult.user_id });
        user = await storage.getUser(user.id);
      }

      // Set session
      (req.session as any).userId = user!.id;
      (req.session as any).stytchSessionToken = stytchResult.session_token;

      // Redirect to app
      res.redirect("/");
    } catch (error) {
      console.error("[AUTH] Magic link verification error:", error);
      res.redirect("/?error=verification_failed");
    }
  });

  // Legacy password login route (keep for existing users)
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
        secure: process.env.NODE_ENV === 'production',
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

// Helper function to hash passwords (exported for admin use)
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}
