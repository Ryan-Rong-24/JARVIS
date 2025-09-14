import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
  isRead: boolean;
  hasAttachments: boolean;
  labels: string[];
}

export interface SendEmailData {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
}

/**
 * Gmail service for managing email operations
 */
export class GmailService {
  private oauth2Client: OAuth2Client;
  private gmail: any;
  private userTokens: Map<string, any> = new Map();
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    console.log('[Gmail Debug] Constructor called with:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasRedirectUri: !!redirectUri,
      redirectUri: redirectUri || 'not set'
    });

    if (!clientId || !clientSecret || !redirectUri) {
      console.warn('Gmail API credentials not configured. Email features will be limited.');
      console.warn('Missing:', {
        clientId: !clientId,
        clientSecret: !clientSecret,
        redirectUri: !redirectUri
      });
      return;
    }

    // Store credentials as instance variables
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;

    this.oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    console.log('[Gmail Debug] OAuth client initialized successfully');
  }

  /**
   * Check if Gmail is configured
   */
  isConfigured(): boolean {
    return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
  }

  /**
   * Set user credentials before making API calls
   */
  private setUserCredentials(userId: string): boolean {
    const tokens = this.userTokens.get(userId);
    if (!tokens || !this.oauth2Client) return false;

    this.oauth2Client.setCredentials(tokens);
    return true;
  }

  /**
   * Store user tokens (called from calendar service after OAuth)
   */
  storeUserTokens(userId: string, tokens: any): void {
    this.userTokens.set(userId, tokens);
    console.log(`[Gmail Debug] Stored tokens for user ${userId}`);
  }

  /**
   * Check if user has valid tokens
   */
  isUserAuthorized(userId: string): boolean {
    const tokens = this.userTokens.get(userId);
    return !!tokens && !!tokens.access_token;
  }

  /**
   * Get recent emails for a user
   */
  async getRecentEmails(userId: string, maxResults: number = 10): Promise<GmailMessage[]> {
    if (!this.isConfigured() || !this.setUserCredentials(userId)) {
      console.log(`[Gmail Debug] Not configured or user ${userId} not authorized`);
      return [];
    }

    try {
      console.log(`[Gmail Debug] Fetching recent emails for user ${userId}`);

      // Get message list
      const messageList = await this.gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: 'in:inbox', // Only inbox messages
      });

      if (!messageList.data.messages) {
        console.log('[Gmail Debug] No messages found');
        return [];
      }

      console.log(`[Gmail Debug] Found ${messageList.data.messages.length} messages`);

      // Get detailed message info
      const messages: GmailMessage[] = [];
      for (const msg of messageList.data.messages.slice(0, maxResults)) {
        try {
          const message = await this.gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'full'
          });

          const gmailMessage = this.parseGmailMessage(message.data);
          if (gmailMessage) {
            messages.push(gmailMessage);
          }
        } catch (error) {
          console.warn(`[Gmail Debug] Error fetching message ${msg.id}:`, error);
        }
      }

      console.log(`[Gmail Debug] Successfully parsed ${messages.length} messages`);
      return messages;

    } catch (error) {
      console.error('[Gmail Debug] Error fetching emails:', error);

      // Handle token refresh
      if (error.response?.status === 401) {
        console.log('[Gmail Debug] Access token expired, attempting to refresh...');
        const refreshed = await this.refreshUserToken(userId);
        if (refreshed) {
          return this.getRecentEmails(userId, maxResults);
        }
      }

      return [];
    }
  }

  /**
   * Get unread emails count
   */
  async getUnreadCount(userId: string): Promise<number> {
    if (!this.isConfigured() || !this.setUserCredentials(userId)) {
      return 0;
    }

    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: 'in:inbox is:unread',
        maxResults: 1
      });

      return response.data.resultSizeEstimate || 0;
    } catch (error) {
      console.error('[Gmail Debug] Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Send an email
   */
  async sendEmail(userId: string, emailData: SendEmailData): Promise<boolean> {
    if (!this.isConfigured() || !this.setUserCredentials(userId)) {
      return false;
    }

    try {
      console.log(`[Gmail Debug] Sending email for user ${userId}`);

      // Create email message
      const email = this.createEmailMessage(emailData);

      const response = await this.gmail.users.messages.send({
        userId: 'me',
        resource: {
          raw: email
        }
      });

      console.log(`[Gmail Debug] Email sent successfully, ID: ${response.data.id}`);
      return true;

    } catch (error) {
      console.error('[Gmail Debug] Error sending email:', error);

      // Handle token refresh
      if (error.response?.status === 401) {
        console.log('[Gmail Debug] Access token expired, attempting to refresh...');
        const refreshed = await this.refreshUserToken(userId);
        if (refreshed) {
          return this.sendEmail(userId, emailData);
        }
      }

      return false;
    }
  }

  /**
   * Parse Gmail message data
   */
  private parseGmailMessage(messageData: any): GmailMessage | null {
    try {
      const headers = messageData.payload.headers;
      const getHeader = (name: string) => headers.find((h: any) => h.name === name)?.value || '';

      // Extract body
      let body = '';
      if (messageData.payload.body.data) {
        body = Buffer.from(messageData.payload.body.data, 'base64').toString();
      } else if (messageData.payload.parts) {
        // For multipart messages, find text/plain part
        const textPart = messageData.payload.parts.find((part: any) =>
          part.mimeType === 'text/plain' && part.body.data
        );
        if (textPart) {
          body = Buffer.from(textPart.body.data, 'base64').toString();
        }
      }

      const isRead = !messageData.labelIds?.includes('UNREAD');
      const hasAttachments = messageData.payload.parts?.some((part: any) => part.filename) || false;

      return {
        id: messageData.id,
        threadId: messageData.threadId,
        snippet: messageData.snippet || '',
        subject: getHeader('Subject'),
        from: getHeader('From'),
        to: getHeader('To'),
        date: getHeader('Date'),
        body: body.substring(0, 1000), // Limit body length
        isRead,
        hasAttachments,
        labels: messageData.labelIds || []
      };
    } catch (error) {
      console.warn('[Gmail Debug] Error parsing message:', error);
      return null;
    }
  }

  /**
   * Create email message in RFC 2822 format
   */
  private createEmailMessage(emailData: SendEmailData): string {
    const lines = [
      `To: ${emailData.to.join(', ')}`,
      `Subject: ${emailData.subject}`,
    ];

    if (emailData.cc && emailData.cc.length > 0) {
      lines.push(`Cc: ${emailData.cc.join(', ')}`);
    }

    if (emailData.bcc && emailData.bcc.length > 0) {
      lines.push(`Bcc: ${emailData.bcc.join(', ')}`);
    }

    if (emailData.isHtml) {
      lines.push('Content-Type: text/html; charset=utf-8');
    } else {
      lines.push('Content-Type: text/plain; charset=utf-8');
    }

    lines.push('');
    lines.push(emailData.body);

    const email = lines.join('\r\n');
    return Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * Refresh user access token
   */
  private async refreshUserToken(userId: string): Promise<boolean> {
    if (!this.oauth2Client) return false;

    try {
      const tokens = this.userTokens.get(userId);
      if (!tokens || !tokens.refresh_token) return false;

      this.oauth2Client.setCredentials(tokens);
      const { credentials } = await this.oauth2Client.refreshAccessToken();

      // Update stored tokens
      this.userTokens.set(userId, credentials);
      this.oauth2Client.setCredentials(credentials);

      console.log(`[Gmail Debug] Refreshed access token for user ${userId}`);
      return true;
    } catch (error) {
      console.error('[Gmail Debug] Error refreshing access token:', error);
      return false;
    }
  }

  /**
   * Remove user authorization (logout)
   */
  async removeUserAuth(userId: string): Promise<void> {
    this.userTokens.delete(userId);
    console.log(`[Gmail Debug] Removed auth for user ${userId}`);
  }
}

// Export singleton instance
export const gmailService = new GmailService();