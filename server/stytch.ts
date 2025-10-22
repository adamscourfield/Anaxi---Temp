import * as stytch from "stytch";

if (!process.env.STYTCH_PROJECT_ID || !process.env.STYTCH_SECRET) {
  throw new Error("Missing Stytch credentials. Please set STYTCH_PROJECT_ID and STYTCH_SECRET in environment variables.");
}

export const stytchClient = new stytch.Client({
  project_id: process.env.STYTCH_PROJECT_ID,
  secret: process.env.STYTCH_SECRET,
  env: process.env.NODE_ENV === "production" 
    ? stytch.envs.live 
    : stytch.envs.test,
});

export interface StytchAuthService {
  sendMagicLink(email: string): Promise<{ request_id: string }>;
  authenticateMagicLink(token: string): Promise<{
    user_id: string;
    email: string;
    session_token: string;
    session_jwt: string;
  }>;
  authenticateSession(sessionToken: string): Promise<{
    user_id: string;
    email: string;
  }>;
  revokeSession(sessionToken: string): Promise<void>;
}

// Helper to get the correct base URL for magic links
function getBaseUrl(): string {
  const replitDomain = process.env.REPLIT_DEV_DOMAIN;
  
  if (replitDomain) {
    // Ensure REPLIT_DEV_DOMAIN uses https (Stytch requires it)
    return replitDomain.startsWith('http://') 
      ? replitDomain.replace('http://', 'https://')
      : replitDomain.startsWith('https://')
        ? replitDomain
        : `https://${replitDomain}`;
  }
  
  // For local development, use http
  return 'http://localhost:5000';
}

export const stytchAuth: StytchAuthService = {
  async sendMagicLink(email: string) {
    const baseUrl = getBaseUrl();
    const verifyUrl = `${baseUrl}/auth/verify`;
    
    const response = await stytchClient.magicLinks.email.loginOrCreate({
      email,
      login_magic_link_url: verifyUrl,
      signup_magic_link_url: verifyUrl,
    });

    return {
      request_id: response.request_id,
    };
  },

  async authenticateMagicLink(token: string) {
    const response = await stytchClient.magicLinks.authenticate({
      token,
      session_duration_minutes: 60 * 24 * 7, // 7 days
    });

    return {
      user_id: response.user_id,
      email: response.user.emails[0]?.email || '',
      session_token: response.session_token,
      session_jwt: response.session_jwt,
    };
  },

  async authenticateSession(sessionToken: string) {
    const response = await stytchClient.sessions.authenticate({
      session_token: sessionToken,
    });

    return {
      user_id: response.user.user_id,
      email: response.user.emails[0]?.email || '',
    };
  },

  async revokeSession(sessionToken: string) {
    await stytchClient.sessions.revoke({
      session_token: sessionToken,
    });
  },
};
