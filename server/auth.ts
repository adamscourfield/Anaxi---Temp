import bcrypt from "bcrypt";
import session from "express-session";
import connectPg from "connect-pg-simple";
import type { Express, RequestHandler } from "express";
import { z } from "zod";
import crypto from "crypto";
import { storage } from "./storage";
import { stytchAuth } from "./stytch";
import { emailService } from "./email";

const SALT_ROUNDS = 10;

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

      // Check if user is archived
      if (user.archived) {
        return res.redirect("/?error=account_archived");
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

  // Password login route
  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);

      // Find user
      const user = await storage.getUserByEmail(data.email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check if user has a password
      if (!user.password_hash) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Verify password
      const validPassword = await bcrypt.compare(data.password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check if user is archived
      if (user.archived) {
        return res.status(403).json({ message: "This account has been archived and can no longer log in" });
      }

      // Set session
      (req.session as any).userId = user.id;

      // Return sanitized user data
      res.json(sanitizeUser(user));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("[AUTH] Login error:", error);
      res.status(500).json({ message: "Failed to login" });
    }
  });

  // Forgot password route - send reset email
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);

      // Find user
      const user = await storage.getUserByEmail(email);
      
      // Always return success even if user doesn't exist (security best practice)
      if (!user) {
        return res.json({ message: "If an account exists with this email, you will receive a password reset link." });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // Save reset token to database
      await storage.updateUser(user.id, {
        reset_token: resetToken,
        reset_token_expires: resetTokenExpires,
      });

      // Send password reset email (fire-and-forget)
      void (async () => {
        try {
          await emailService.sendPasswordResetEmail({
            to: user.email,
            userName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'there',
            resetToken,
          });
        } catch (error) {
          console.error('[AUTH] Failed to send password reset email:', error);
        }
      })();

      res.json({ message: "If an account exists with this email, you will receive a password reset link." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid email address" });
      }
      console.error("[AUTH] Forgot password error:", error);
      res.status(500).json({ message: "Failed to process password reset request" });
    }
  });

  // Reset password route - confirm with token
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = z.object({
        token: z.string(),
        password: z.string().min(8),
      }).parse(req.body);

      // Find user by reset token
      const user = await storage.getUserByResetToken(token);
      
      if (!user || !user.reset_token_expires) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      // Check if token is expired
      if (new Date() > user.reset_token_expires) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      // Hash new password
      const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

      // Update user password and clear reset token
      await storage.updateUser(user.id, {
        password_hash,
        reset_token: null,
        reset_token_expires: null,
      });

      res.json({ message: "Password reset successfully. You can now log in with your new password." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("[AUTH] Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Set password for new users - confirm with setup token
  app.post("/api/auth/setup-password", async (req, res) => {
    try {
      const { token, password } = z.object({
        token: z.string(),
        password: z.string().min(8),
      }).parse(req.body);

      // Find user by setup token
      const user = await storage.getUserByPasswordSetupToken(token);
      
      if (!user || !user.password_setup_token_expires) {
        return res.status(400).json({ message: "Invalid or expired setup token" });
      }

      // Check if token is expired
      if (new Date() > user.password_setup_token_expires) {
        return res.status(400).json({ message: "Invalid or expired setup token" });
      }

      // Hash new password
      const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

      // Update user password and clear setup token
      await storage.updateUser(user.id, {
        password_hash,
        password_setup_token: null,
        password_setup_token_expires: null,
      });

      res.json({ message: "Password set successfully. You can now log in with your new password." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("[AUTH] Setup password error:", error);
      res.status(500).json({ message: "Failed to setup password" });
    }
  });

  // Verify password setup token (for pre-checking if token is valid)
  app.post("/api/auth/verify-setup-token", async (req, res) => {
    try {
      const { token } = z.object({
        token: z.string(),
      }).parse(req.body);

      // Find user by setup token
      const user = await storage.getUserByPasswordSetupToken(token);
      
      if (!user || !user.password_setup_token_expires) {
        return res.status(400).json({ message: "Invalid or expired setup token", valid: false });
      }

      // Check if token is expired
      if (new Date() > user.password_setup_token_expires) {
        return res.status(400).json({ message: "Invalid or expired setup token", valid: false });
      }

      res.json({ 
        valid: true, 
        email: user.email,
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || null
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", valid: false });
      }
      console.error("[AUTH] Verify setup token error:", error);
      res.status(500).json({ message: "Failed to verify token", valid: false });
    }
  });

  // Logout route
  app.post("/api/auth/logout", async (req, res) => {
    const stytchSessionToken = (req.session as any).stytchSessionToken;
    
    // Revoke Stytch session if it exists
    if (stytchSessionToken) {
      try {
        await stytchAuth.revokeSession(stytchSessionToken);
      } catch (error) {
        console.error("[AUTH] Failed to revoke Stytch session:", error);
        // Continue with logout even if Stytch revocation fails
      }
    }
    
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

      // Return sanitized user data
      res.json(sanitizeUser(user));
    } catch (error) {
      console.error("[AUTH] Get user error:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });
}

// Middleware to protect routes
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const userId = (req.session as any).userId;
  const stytchSessionToken = (req.session as any).stytchSessionToken;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // If user has a Stytch session, validate it
  if (stytchSessionToken) {
    try {
      await stytchAuth.authenticateSession(stytchSessionToken);
    } catch (error) {
      console.error("[AUTH] Stytch session validation failed:", error);
      // Stytch session is invalid/expired - destroy local session
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Session expired. Please log in again." });
    }
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
