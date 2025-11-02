import { Resend } from 'resend';

let connectionSettings: any;

// Helper function to sanitize HTML in user-provided content
function sanitizeHtml(text: string | undefined): string {
  if (!text) return '';
  
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return {apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email};
}

async function getUncachableResendClient() {
  const credentials = await getCredentials();
  return {
    client: new Resend(credentials.apiKey),
    fromEmail: credentials.fromEmail
  };
}

export interface EmailService {
  sendObservationNotification(params: {
    to: string;
    teacherName: string;
    observerName: string;
    observationDate: string;
    observationId: string;
  }): Promise<void>;

  sendFeedbackNotification(params: {
    to: string;
    teacherName: string;
    observerName: string;
    observationId: string;
  }): Promise<void>;

  sendMeetingInvitation(params: {
    to: string[];
    organizerName: string;
    meetingType: string;
    meetingSubject: string;
    meetingDate: string;
    meetingId: string;
  }): Promise<void>;

  sendConversationNotification(params: {
    to: string;
    staffMemberName: string;
    conversationSubject: string;
    rating: string;
    conversationId: string;
  }): Promise<void>;

  sendPasswordResetEmail(params: {
    to: string;
    userName: string;
    resetToken: string;
  }): Promise<void>;

  sendLeaveRequestApproval(params: {
    to: string;
    teacherName: string;
    approverName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    status: string;
    responseNotes?: string;
  }): Promise<void>;

  sendWelcomeEmail(params: {
    to: string;
    userName: string;
    schoolName: string;
    setupToken: string;
  }): Promise<void>;
}

// Helper to safely send emails without throwing errors
async function safeSendEmail<T>(
  emailOperation: () => Promise<T>,
  context: string
): Promise<void> {
  try {
    await emailOperation();
  } catch (error) {
    console.error(`[EMAIL] ${context} failed:`, error);
    // Never throw - email failures should not break core functionality
  }
}

export const emailService: EmailService = {
  async sendObservationNotification({ to, teacherName, observerName, observationDate, observationId }) {
    await safeSendEmail(async () => {
      const { client, fromEmail } = await getUncachableResendClient();
      const appUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
        : 'http://localhost:5000';

      await client.emails.send({
        from: fromEmail,
        to,
        subject: `New Observation: ${sanitizeHtml(observerName)} observed you`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">New Observation Completed</h2>
            <p>Hi ${sanitizeHtml(teacherName)},</p>
            <p>${sanitizeHtml(observerName)} has completed an observation of your teaching on ${observationDate}.</p>
            <p>You can view the observation details and feedback by clicking the link below:</p>
            <a href="${appUrl}/observations/${observationId}" 
               style="display: inline-block; padding: 12px 24px; background-color: #FF6B6B; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              View Observation
            </a>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              This is an automated message from Anaxi, your professional teacher observation platform.
            </p>
          </div>
        `,
      });
    }, 'Observation notification');
  },

  async sendFeedbackNotification({ to, teacherName, observerName, observationId }) {
    await safeSendEmail(async () => {
      const { client, fromEmail } = await getUncachableResendClient();
      const appUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
        : 'http://localhost:5000';

      await client.emails.send({
        from: fromEmail,
        to,
        subject: `New Feedback: ${sanitizeHtml(observerName)} has provided feedback`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">New Feedback Available</h2>
            <p>Hi ${sanitizeHtml(teacherName)},</p>
            <p>${sanitizeHtml(observerName)} has provided feedback on your recent observation.</p>
            <p>You can view the detailed feedback by clicking the link below:</p>
            <a href="${appUrl}/observations/${observationId}" 
               style="display: inline-block; padding: 12px 24px; background-color: #FF6B6B; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              View Feedback
            </a>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              This is an automated message from Anaxi, your professional teacher observation platform.
            </p>
          </div>
        `,
      });
    }, 'Feedback notification');
  },

  async sendMeetingInvitation({ to, organizerName, meetingType, meetingSubject, meetingDate, meetingId }) {
    await safeSendEmail(async () => {
      const { client, fromEmail } = await getUncachableResendClient();
      const appUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
        : 'http://localhost:5000';

      await client.emails.send({
        from: fromEmail,
        to,
        subject: `Meeting Invitation: ${sanitizeHtml(meetingSubject)}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">You've been invited to a meeting</h2>
            <p>${sanitizeHtml(organizerName)} has invited you to a ${meetingType} meeting.</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Subject:</strong> ${sanitizeHtml(meetingSubject)}</p>
              <p style="margin: 5px 0;"><strong>Type:</strong> ${meetingType}</p>
              <p style="margin: 5px 0;"><strong>Date:</strong> ${meetingDate}</p>
            </div>
            <a href="${appUrl}/meetings/${meetingId}" 
               style="display: inline-block; padding: 12px 24px; background-color: #FF6B6B; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              View Meeting Details
            </a>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              This is an automated message from Anaxi, your professional teacher observation platform.
            </p>
          </div>
        `,
      });
    }, 'Meeting invitation');
  },

  async sendConversationNotification({ to, staffMemberName, conversationSubject, rating, conversationId }) {
    await safeSendEmail(async () => {
      const { client, fromEmail } = await getUncachableResendClient();
      const appUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
        : 'http://localhost:5000';

      const ratingColors: Record<string, string> = {
        'Best Practice': '#10b981',
        'Neutral': '#6b7280',
        'Concern': '#ef4444',
      };

      await client.emails.send({
        from: fromEmail,
        to,
        subject: `New Conversation: ${sanitizeHtml(conversationSubject)}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">New Conversation Recorded</h2>
            <p>Hi ${sanitizeHtml(staffMemberName)},</p>
            <p>A conversation has been recorded regarding: <strong>${sanitizeHtml(conversationSubject)}</strong></p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 5px 0;">
                <strong>Rating:</strong> 
                <span style="color: ${ratingColors[rating] || '#6b7280'}; font-weight: bold;">${rating}</span>
              </p>
            </div>
            <a href="${appUrl}/conversations/${conversationId}" 
               style="display: inline-block; padding: 12px 24px; background-color: #FF6B6B; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              View Conversation
            </a>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              This is an automated message from Anaxi, your professional teacher observation platform.
            </p>
          </div>
        `,
      });
    }, 'Conversation notification');
  },

  async sendPasswordResetEmail({ to, userName, resetToken }) {
    await safeSendEmail(async () => {
      const { client, fromEmail } = await getUncachableResendClient();
      const appUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
        : 'http://localhost:5000';

      await client.emails.send({
        from: fromEmail,
        to,
        subject: 'Reset Your Password - Anaxi',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p>Hi ${sanitizeHtml(userName)},</p>
            <p>We received a request to reset your password for your Anaxi account.</p>
            <p>Click the button below to reset your password. This link will expire in 1 hour.</p>
            <a href="${appUrl}/reset-password?token=${resetToken}" 
               style="display: inline-block; padding: 12px 24px; background-color: #FF6B6B; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              Reset Password
            </a>
            <p style="color: #666; font-size: 14px;">
              If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
            </p>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              This is an automated message from Anaxi, your professional teacher observation platform.
            </p>
          </div>
        `,
      });
    }, 'Password reset email');
  },

  async sendLeaveRequestApproval({ to, teacherName, approverName, leaveType, startDate, endDate, status, responseNotes }) {
    await safeSendEmail(async () => {
      const { client, fromEmail } = await getUncachableResendClient();
      const appUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
        : 'http://localhost:5000';

      const statusText = status === 'approved_with_pay' 
        ? 'Approved with Pay' 
        : status === 'approved_without_pay' 
        ? 'Approved without Pay' 
        : 'Denied';
      
      const statusColor = status.startsWith('approved') ? '#10B981' : '#EF4444';
      
      const leaveTypeText = leaveType
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      await client.emails.send({
        from: fromEmail,
        to,
        subject: `Leave Request ${statusText} - Anaxi`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Leave Request Update</h2>
            <p>Hi ${sanitizeHtml(teacherName)},</p>
            <p>Your leave request has been <strong style="color: ${statusColor};">${statusText}</strong> by ${sanitizeHtml(approverName)}.</p>
            
            <div style="background-color: #F9FAFB; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Leave Type:</strong> ${leaveTypeText}</p>
              <p style="margin: 5px 0;"><strong>Dates:</strong> ${startDate} to ${endDate}</p>
              <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: ${statusColor};">${statusText}</span></p>
              ${responseNotes ? `<p style="margin: 15px 0 5px 0;"><strong>Response Notes:</strong></p><p style="margin: 5px 0; color: #666;">${sanitizeHtml(responseNotes)}</p>` : ''}
            </div>

            <a href="${appUrl}/leave-requests" 
               style="display: inline-block; padding: 12px 24px; background-color: #FF6B6B; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              View Leave Requests
            </a>

            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              This is an automated message from Anaxi, your professional teacher observation platform.
            </p>
          </div>
        `,
      });
    }, 'Leave request approval notification');
  },

  async sendWelcomeEmail({ to, userName, schoolName, setupToken }) {
    await safeSendEmail(async () => {
      const { client, fromEmail } = await getUncachableResendClient();
      const appUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
        : 'http://localhost:5000';

      const setupLink = `${appUrl}/set-password?token=${setupToken}`;

      await client.emails.send({
        from: fromEmail,
        to,
        subject: `Welcome to Anaxi - Set Your Password`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Welcome to Anaxi!</h2>
            <p>Hi ${sanitizeHtml(userName)},</p>
            <p>Your account has been created for <strong>${sanitizeHtml(schoolName)}</strong> on Anaxi, the professional teacher observation platform.</p>
            
            <div style="background-color: #F9FAFB; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Email:</strong> ${to}</p>
              <p style="margin: 10px 0;">To get started, please set your password by clicking the button below:</p>
            </div>

            <a href="${setupLink}" 
               style="display: inline-block; padding: 12px 24px; background-color: #FF6B6B; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              Set Your Password
            </a>

            <p style="color: #666; font-size: 14px;">This link will expire in 7 days for security reasons.</p>

            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              This is an automated message from Anaxi, your professional teacher observation platform.
            </p>
          </div>
        `,
      });
    }, 'Welcome email');
  },
};
