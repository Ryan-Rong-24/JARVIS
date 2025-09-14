import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  htmlLink: string;
  created: string;
  updated: string;
  status: string;
  attendees?: Array<{
    email: string;
    responseStatus: string;
    displayName?: string;
  }>;
}

export interface CreateEventData {
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time: string;
  attendees?: string[];
  timeZone?: string;
}

/**
 * Google Calendar service for managing calendar events
 */
export class GoogleCalendarService {
  private oauth2Client: OAuth2Client;
  private calendar: any;
  private userTokens: Map<string, any> = new Map();

  constructor() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.warn('Google Calendar API credentials not configured. Calendar features will be limited.');
      return;
    }

    this.oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Check if Google Calendar is configured
   */
  isConfigured(): boolean {
    return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
  }

  /**
   * Generate OAuth2 authentication URL
   */
  generateAuthUrl(userId: string): string | null {
    if (!this.oauth2Client) return null;

    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];

    const url = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: userId, // Pass userId as state parameter
      prompt: 'consent'
    });

    return url;
  }

  /**
   * Handle OAuth2 callback and store tokens
   */
  async handleAuthCallback(code: string, userId: string): Promise<boolean> {
    if (!this.oauth2Client) return false;

    try {
      const { tokens } = await this.oauth2Client.getAccessToken(code);
      this.userTokens.set(userId, tokens);
      this.oauth2Client.setCredentials(tokens);
      console.log(`Google Calendar authorized for user ${userId}`);
      return true;
    } catch (error) {
      console.error('Error during Google OAuth callback:', error);
      return false;
    }
  }

  /**
   * Check if user has valid tokens
   */
  isUserAuthorized(userId: string): boolean {
    const tokens = this.userTokens.get(userId);
    return !!tokens && !!tokens.access_token;
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
   * Get calendar events for a date range
   */
  async getEvents(userId: string, startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    if (!this.isConfigured() || !this.setUserCredentials(userId)) {
      return [];
    }

    try {
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 50
      });

      return response.data.items?.map((event: any) => ({
        id: event.id,
        summary: event.summary || 'No Title',
        description: event.description,
        location: event.location,
        start: {
          dateTime: event.start.dateTime || event.start.date,
          timeZone: event.start.timeZone
        },
        end: {
          dateTime: event.end.dateTime || event.end.date,
          timeZone: event.end.timeZone
        },
        htmlLink: event.htmlLink,
        created: event.created,
        updated: event.updated,
        status: event.status,
        attendees: event.attendees?.map((attendee: any) => ({
          email: attendee.email,
          responseStatus: attendee.responseStatus,
          displayName: attendee.displayName
        }))
      })) || [];

    } catch (error) {
      console.error('Error fetching calendar events:', error);

      // Handle token refresh
      if (error.response?.status === 401) {
        console.log('Access token expired, attempting to refresh...');
        const refreshed = await this.refreshUserToken(userId);
        if (refreshed) {
          return this.getEvents(userId, startDate, endDate);
        }
      }

      return [];
    }
  }

  /**
   * Create a new calendar event
   */
  async createEvent(userId: string, eventData: CreateEventData): Promise<CalendarEvent | null> {
    if (!this.isConfigured() || !this.setUserCredentials(userId)) {
      return null;
    }

    try {
      const startTime = new Date(eventData.start_time);
      const endTime = new Date(eventData.end_time);

      // If start and end times are the same, add 1 hour duration
      if (startTime.getTime() === endTime.getTime()) {
        endTime.setTime(startTime.getTime() + (60 * 60 * 1000));
      }

      const event = {
        summary: eventData.title,
        description: eventData.description || 'Created by MentraOS Calendar AI',
        location: eventData.location || '',
        start: {
          dateTime: startTime.toISOString(),
          timeZone: eventData.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: eventData.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        attendees: eventData.attendees?.map(email => ({ email })) || [],
        reminders: {
          useDefault: true
        }
      };

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        sendUpdates: 'all' // Send email notifications
      });

      const createdEvent = response.data;

      return {
        id: createdEvent.id,
        summary: createdEvent.summary,
        description: createdEvent.description,
        location: createdEvent.location,
        start: {
          dateTime: createdEvent.start.dateTime || createdEvent.start.date,
          timeZone: createdEvent.start.timeZone
        },
        end: {
          dateTime: createdEvent.end.dateTime || createdEvent.end.date,
          timeZone: createdEvent.end.timeZone
        },
        htmlLink: createdEvent.htmlLink,
        created: createdEvent.created,
        updated: createdEvent.updated,
        status: createdEvent.status,
        attendees: createdEvent.attendees?.map((attendee: any) => ({
          email: attendee.email,
          responseStatus: attendee.responseStatus,
          displayName: attendee.displayName
        }))
      };

    } catch (error) {
      console.error('Error creating calendar event:', error);

      // Handle token refresh
      if (error.response?.status === 401) {
        console.log('Access token expired, attempting to refresh...');
        const refreshed = await this.refreshUserToken(userId);
        if (refreshed) {
          return this.createEvent(userId, eventData);
        }
      }

      return null;
    }
  }

  /**
   * Get today's events for a user
   */
  async getTodaysEvents(userId: string): Promise<CalendarEvent[]> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    return this.getEvents(userId, startOfDay, endOfDay);
  }

  /**
   * Get upcoming events (next 7 days)
   */
  async getUpcomingEvents(userId: string, days: number = 7): Promise<CalendarEvent[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));

    return this.getEvents(userId, now, futureDate);
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

      console.log(`Refreshed access token for user ${userId}`);
      return true;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      return false;
    }
  }

  /**
   * Remove user authorization (logout)
   */
  async removeUserAuth(userId: string): Promise<void> {
    const tokens = this.userTokens.get(userId);
    if (tokens && this.oauth2Client) {
      try {
        await this.oauth2Client.revokeToken(tokens.access_token);
      } catch (error) {
        console.warn('Error revoking Google token:', error);
      }
    }
    this.userTokens.delete(userId);
  }

  /**
   * Get user's token info (for debugging)
   */
  getUserTokenInfo(userId: string): any {
    const tokens = this.userTokens.get(userId);
    if (!tokens) return null;

    return {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scope: tokens.scope
    };
  }
}

// Export singleton instance
export const googleCalendarService = new GoogleCalendarService();