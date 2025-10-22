import { Resend } from 'resend';

let connectionSettings: any;

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
      const appUrl = process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000';

      await client.emails.send({
        from: fromEmail,
        to,
        subject: `New Observation: ${observerName} observed you`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">New Observation Completed</h2>
            <p>Hi ${teacherName},</p>
            <p>${observerName} has completed an observation of your teaching on ${observationDate}.</p>
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
      const appUrl = process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000';

      await client.emails.send({
        from: fromEmail,
        to,
        subject: `New Feedback: ${observerName} has provided feedback`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">New Feedback Available</h2>
            <p>Hi ${teacherName},</p>
            <p>${observerName} has provided feedback on your recent observation.</p>
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
      const appUrl = process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000';

      await client.emails.send({
        from: fromEmail,
        to,
        subject: `Meeting Invitation: ${meetingSubject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">You've been invited to a meeting</h2>
            <p>${organizerName} has invited you to a ${meetingType} meeting.</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Subject:</strong> ${meetingSubject}</p>
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
      const appUrl = process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000';

      const ratingColors: Record<string, string> = {
        'Best Practice': '#10b981',
        'Neutral': '#6b7280',
        'Concern': '#ef4444',
      };

      await client.emails.send({
        from: fromEmail,
        to,
        subject: `New Conversation: ${conversationSubject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">New Conversation Recorded</h2>
            <p>Hi ${staffMemberName},</p>
            <p>A conversation has been recorded regarding: <strong>${conversationSubject}</strong></p>
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
};
