import { AppServer, AppSession, AuthenticatedRequest, PhotoData } from '@mentra/sdk';
import { Request, Response } from 'express';
import * as ejs from 'ejs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { googleCalendarService, CreateEventData, CalendarEvent } from './services/googleCalendarService';
import { gmailService } from './services/gmailService';

/**
 * Interface representing a stored photo with metadata
 */
interface StoredPhoto {
  requestId: string;
  buffer: Buffer;
  timestamp: Date;
  userId: string;
  mimeType: string;
  filename: string;
  size: number;
  selected?: boolean;
  caption?: string;
  captionGenerated?: boolean;
}

/**
 * Interface representing a transcription entry with metadata
 */
interface TranscriptionEntry {
  id: string;
  text: string;
  timestamp: Date;
  userId: string;
  isActivationPhrase: boolean;
  selected?: boolean;
}

/**
 * Interface for Suno song generation request
 */
interface SongGenerationRequest {
  selectedPhotos: string[];
  selectedTranscriptions: string[];
  customPrompt?: string;
  tags?: string;
}

/**
 * Interface for stored generated songs
 */
interface GeneratedSong {
  id: string;
  clipId: string;
  title: string;
  status: string;
  audioUrl: string | null;
  imageUrl: string | null;
  createdAt: Date;
  completedAt: Date | null;
  userId: string;
  prompt: string;
  tags: string;
  selectedPhotosCount: number;
  selectedTranscriptionsCount: number;
  metadata: any;
  favorite?: boolean;
}

/**
 * Interface for Knot session creation request
 */
interface KnotSessionRequest {
  type: 'link';
  external_user_id: string;
  phone_number?: string;
  email?: string;
  processor_token?: string;
}

/**
 * Interface for Knot session creation response
 */
interface KnotSessionResponse {
  session: string;
}

/**
 * Interface for a shopping session
 */
interface ShoppingSession {
  id: string;
  sessionId: string;
  userId: string;
  timestamp: Date;
  status: 'active' | 'completed' | 'expired';
  merchantId: number;
  query?: string;
}

/**
 * Interface for user transaction data
 */
interface UserTransactionData {
  merchantId: number;
  merchantName: string;
  transactions: any[];
  syncedAt: Date;
}

const PACKAGE_NAME = process.env.PACKAGE_NAME ?? (() => { throw new Error('PACKAGE_NAME is not set in .env file'); })();
const MENTRAOS_API_KEY = process.env.MENTRAOS_API_KEY ?? (() => { throw new Error('MENTRAOS_API_KEY is not set in .env file'); })();
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY; // Optional - captions will be skipped if not provided
const KNOT_CLIENT_ID = process.env.KNOT_CLIENT_ID; // Optional - shopping features will be disabled if not provided
const KNOT_SECRET = process.env.KNOT_SECRET; // Optional - shopping features will be disabled if not provided
const KNOT_ENVIRONMENT = process.env.KNOT_ENVIRONMENT || 'development';
const PORT = parseInt(process.env.PORT || '3000');

// Initialize Anthropic client if API key is provided
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
}) : null;

/**
 * Voice activation phrases that trigger photo capture
 */
const PHOTO_ACTIVATION_PHRASES = [
  'take photo',
  'capture photo',
  'snap photo',
  'take picture',
  'capture picture',
  'snap picture',
  'camera',
  'photo'
];

/**
 * Voice activation phrases that trigger shopping
 */
const SHOPPING_ACTIVATION_PHRASES = [
  'buy',
  'purchase',
  'order',
  'shopping'
];

/**
 * Voice activation phrases that trigger calendar/meeting actions
 */
const CALENDAR_ACTIVATION_PHRASES = [
  'schedule',
  'meeting',
  'calendar',
  'appointment',
  'book',
  'plan',
  'create event',
  'add to calendar'
];

/**
 * Voice activation phrases that trigger email actions
 */
const EMAIL_ACTIVATION_PHRASES = [
  'email',
  'reply',
  'send email',
  'compose',
  'check email',
  'inbox',
  'message'
];

/**
 * Enhanced Photo Taker App with gallery, transcription history, and Suno integration
 * Extends AppServer to provide comprehensive photo and audio generation capabilities
 */
class ExampleMentraOSApp extends AppServer {
  // Photo gallery: userId -> array of photos
  private photoGalleries: Map<string, StoredPhoto[]> = new Map();
  // Transcription history: userId -> array of transcriptions
  private transcriptionHistory: Map<string, TranscriptionEntry[]> = new Map();
  // Generated songs gallery: userId -> array of songs
  private songGalleries: Map<string, GeneratedSong[]> = new Map();
  // Active song generations: clipId -> userId (for tracking ongoing generations)
  private activeGenerations: Map<string, string> = new Map();
  // Shopping sessions: userId -> array of shopping sessions
  private shoppingSessions: Map<string, ShoppingSession[]> = new Map();
  // User transactions: externalUserId -> transaction data
  private userTransactions: Map<string, UserTransactionData> = new Map();
  // Streaming state
  private isStreamingPhotos: Map<string, boolean> = new Map();
  private nextPhotoTime: Map<string, number> = new Map();

  constructor() {
    super({
      packageName: PACKAGE_NAME,
      apiKey: MENTRAOS_API_KEY,
      port: PORT,
    });
    this.setupWebviewRoutes();
  }


  /**
   * Handle new session creation, button press events, and voice transcription
   */
  protected async onSession(session: AppSession, sessionId: string, userId: string): Promise<void> {
    // this gets called whenever a user launches the app
    this.logger.info(`Session started for user ${userId}`);

    // set the initial state of the user
    this.isStreamingPhotos.set(userId, false);
    this.nextPhotoTime.set(userId, Date.now());

    // Set up voice activation for photo capture and transcription history
    const unsubscribeTranscription = session.events.onTranscription((data) => {
      // Only process final transcription results
      if (!data.isFinal) return;

      // Normalize the spoken text for comparison
      const spokenText = data.text.toLowerCase().trim();
      session.logger.debug(`Heard: "${spokenText}"`);

      // Check if any photo activation phrase is detected
      const photoActivationDetected = PHOTO_ACTIVATION_PHRASES.some(phrase =>
        spokenText.includes(phrase)
      );

      // Check if any shopping activation phrase is detected
      const shoppingActivationDetected = SHOPPING_ACTIVATION_PHRASES.some(phrase =>
        spokenText.includes(phrase)
      );

      // Check if any calendar activation phrase is detected
      const calendarActivationDetected = CALENDAR_ACTIVATION_PHRASES.some(phrase =>
        spokenText.includes(phrase)
      );

      // Check if any email activation phrase is detected
      const emailActivationDetected = EMAIL_ACTIVATION_PHRASES.some(phrase =>
        spokenText.includes(phrase)
      );

      const anyActivationDetected = photoActivationDetected || shoppingActivationDetected || calendarActivationDetected || emailActivationDetected;

      // Store transcription in history
      this.addTranscriptionToHistory(userId, data.text, anyActivationDetected);

      if (photoActivationDetected) {
        session.logger.info(`✨ Photo voice activation detected: "${spokenText}"`);

        // Show feedback to user
        session.layouts.showTextWall("📸 Taking photo...", { durationMs: 3000 });

        // Trigger photo capture
        this.takePhotoForUser(session, userId);
      } else if (shoppingActivationDetected) {
        session.logger.info(`🛒 Shopping voice activation detected: "${spokenText}"`);

        // Show feedback to user
        session.layouts.showTextWall("🛒 Starting shopping session...", { durationMs: 3000 });

        // Create shopping session and launch Knot interface
        this.handleShoppingRequest(session, userId, data.text);
      } else if (calendarActivationDetected) {
        session.logger.info(`📅 Calendar voice activation detected: "${spokenText}"`);

        // Show feedback to user
        session.layouts.showTextWall("📅 Processing calendar request...", { durationMs: 3000 });

        // Immediate audio feedback
        session.audio.speak("Processing your calendar request", {
          voice_settings: { stability: 0.8, speed: 1.1 }
        }).catch(error => session.logger.warn('Failed to play activation TTS:', error));

        // Send to calendar agent
        this.handleCalendarRequest(session, userId, data.text);
      } else if (emailActivationDetected) {
        session.logger.info(`📧 Email voice activation detected: "${spokenText}"`);

        // Show feedback to user
        session.layouts.showTextWall("📧 Processing email request...", { durationMs: 3000 });

        // Immediate audio feedback
        session.audio.speak("Processing your email request", {
          voice_settings: { stability: 0.8, speed: 1.1 }
        }).catch(error => session.logger.warn('Failed to play activation TTS:', error));

        // Send to email agent
        this.handleEmailRequest(session, userId, data.text);
      }
    });

    // Clean up transcription listener when session ends
    this.addCleanupHandler(unsubscribeTranscription);

    // this gets called whenever a user presses a button
    session.events.onButtonPress(async (button) => {
      this.logger.info(`Button pressed: ${button.buttonId}, type: ${button.pressType}`);

      if (button.pressType === 'long') {
        // the user held the button, so we toggle the streaming mode
        this.isStreamingPhotos.set(userId, !this.isStreamingPhotos.get(userId));
        this.logger.info(`Streaming photos for user ${userId} is now ${this.isStreamingPhotos.get(userId)}`);
        return;
      } else {
        session.layouts.showTextWall("Button pressed, about to take photo", {durationMs: 4000});
        // the user pressed the button, so we take a single photo
        await this.takePhotoForUser(session, userId);
      }
    });

    // repeatedly check if we are in streaming mode and if we are ready to take another photo
    setInterval(async () => {
      if (this.isStreamingPhotos.get(userId) && Date.now() > (this.nextPhotoTime.get(userId) ?? 0)) {
        try {
          // set the next photos for 30 seconds from now, as a fallback if this fails
          this.nextPhotoTime.set(userId, Date.now() + 30000);

          // actually take the photo
          await this.takePhotoForUser(session, userId);

          // set the next photo time to now, since we are ready to take another photo
          this.nextPhotoTime.set(userId, Date.now());
        } catch (error) {
          this.logger.error(`Error auto-taking photo: ${error}`);
        }
      }
    }, 1000);
  }

  protected async onStop(_sessionId: string, userId: string, reason: string): Promise<void> {
    // clean up the user's state
    this.isStreamingPhotos.set(userId, false);
    this.nextPhotoTime.delete(userId);
    this.logger.info(`Session stopped for user ${userId}, reason: ${reason}`);
  }

  /**
   * Take a photo for the specified user (used by both voice and button triggers)
   */
  private async takePhotoForUser(session: AppSession, userId: string): Promise<void> {
    try {
      const photo = await session.camera.requestPhoto();
      this.logger.info(`Photo taken for user ${userId}, timestamp: ${photo.timestamp}`);
      this.addPhotoToGallery(photo, userId);
    } catch (error) {
      this.logger.error(`Error taking photo: ${error}`);
      session.layouts.showTextWall("❌ Failed to take photo", { durationMs: 3000 });
    }
  }

  /**
   * Add a transcription entry to the user's history
   */
  private addTranscriptionToHistory(userId: string, text: string, isActivationPhrase: boolean): void {
    if (!this.transcriptionHistory.has(userId)) {
      this.transcriptionHistory.set(userId, []);
    }

    const entry: TranscriptionEntry = {
      id: `transcription-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      text,
      timestamp: new Date(),
      userId,
      isActivationPhrase,
      selected: false
    };

    const history = this.transcriptionHistory.get(userId)!;
    history.push(entry);

    // Keep only the last 100 transcriptions per user
    if (history.length > 100) {
      history.shift();
    }

    this.logger.debug(`Added transcription to history for user ${userId}: "${text}"`);
  }

  /**
   * Get recent emails for context in email processing
   */
  private async getRecentEmailsForContext(userId: string): Promise<any[]> {
    try {
      this.logger.debug(`Getting recent emails for context for user ${userId}`);

      if (!gmailService.isUserAuthorized(userId)) {
        this.logger.debug(`User ${userId} not authorized for Gmail access`);
        return [];
      }

      // Get recent emails from Gmail API
      const recentEmails = await gmailService.getRecentEmails(userId, 5);

      // Convert to context format for email processing
      const emailContext = recentEmails.map(email => ({
        id: email.id,
        subject: email.subject,
        from: email.from,
        snippet: email.snippet,
        date: email.date,
        isRead: email.isRead
      }));

      this.logger.debug(`Retrieved ${emailContext.length} emails for context`);
      return emailContext;
    } catch (error) {
      this.logger.warn('Failed to get recent emails for context:', error);
      return [];
    }
  }

  /**
   * Retry mechanism for API calls
   */
  private async retryApiCall<T>(
    apiCall: () => Promise<T>,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`API call attempt ${attempt}/${maxRetries} failed:`, error);

        if (attempt === maxRetries) {
          throw lastError;
        }

        // Exponential backoff
        const delay = retryDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Test voice activation patterns (for development/debugging)
   */
  public testVoiceActivation(): void {
    const testCases = [
      // Calendar tests
      { input: "schedule a meeting with john tomorrow", expected: { calendar: true, email: false, shopping: false, photo: false } },
      { input: "add appointment to calendar", expected: { calendar: true, email: false, shopping: false, photo: false } },
      { input: "create event for lunch", expected: { calendar: true, email: false, shopping: false, photo: false } },

      // Email tests
      { input: "check my inbox", expected: { calendar: false, email: true, shopping: false, photo: false } },
      { input: "reply to sarah's email", expected: { calendar: false, email: true, shopping: false, photo: false } },
      { input: "compose new email", expected: { calendar: false, email: true, shopping: false, photo: false } },

      // Shopping tests
      { input: "buy groceries", expected: { calendar: false, email: false, shopping: true, photo: false } },
      { input: "order coffee", expected: { calendar: false, email: false, shopping: true, photo: false } },

      // Photo tests
      { input: "take photo", expected: { calendar: false, email: false, shopping: false, photo: true } },
      { input: "snap picture", expected: { calendar: false, email: false, shopping: false, photo: true } },

      // Mixed/edge cases
      { input: "schedule photo shoot with meeting", expected: { calendar: true, email: false, shopping: false, photo: true } },
      { input: "hello world", expected: { calendar: false, email: false, shopping: false, photo: false } },
    ];

    console.log('🧪 Testing Voice Activation Patterns:');

    testCases.forEach((testCase, index) => {
      const spokenText = testCase.input.toLowerCase().trim();

      const photoActivated = PHOTO_ACTIVATION_PHRASES.some(phrase => spokenText.includes(phrase));
      const shoppingActivated = SHOPPING_ACTIVATION_PHRASES.some(phrase => spokenText.includes(phrase));
      const calendarActivated = CALENDAR_ACTIVATION_PHRASES.some(phrase => spokenText.includes(phrase));
      const emailActivated = EMAIL_ACTIVATION_PHRASES.some(phrase => spokenText.includes(phrase));

      const result = {
        calendar: calendarActivated,
        email: emailActivated,
        shopping: shoppingActivated,
        photo: photoActivated
      };

      const passed = JSON.stringify(result) === JSON.stringify(testCase.expected);
      const status = passed ? '✅' : '❌';

      console.log(`${status} Test ${index + 1}: "${testCase.input}"`);
      console.log(`   Expected: ${JSON.stringify(testCase.expected)}`);
      console.log(`   Got:      ${JSON.stringify(result)}`);
      if (!passed) {
        console.log(`   🔍 Failed test case detected`);
      }
    });
  }

  /**
   * Generate a caption for a photo using Claude Vision API
   */
  private async generatePhotoCaption(photoBuffer: Buffer, mimeType: string): Promise<string | null> {
    if (!anthropic) {
      this.logger.debug('Anthropic API key not configured, skipping caption generation');
      return null;
    }

    try {
      // Convert buffer to base64
      const base64Image = photoBuffer.toString('base64');

      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: [{
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: base64Image,
            },
          }, {
            type: 'text',
            text: 'Describe this image in 1-2 sentences, focusing on the main subject, setting, mood, and any notable details. Keep it concise and vivid for music generation.'
          }]
        }]
      });

      const caption = response.content[0].type === 'text' ? response.content[0].text : null;
      this.logger.info(`Generated caption: ${caption?.slice(0, 100)}...`);
      return caption;

    } catch (error) {
      this.logger.error('Failed to generate photo caption:', error);
      return null;
    }
  }

  /**
   * Create a new Knot shopping session
   */
  private async createKnotSession(userId: string): Promise<string | null> {
    if (!KNOT_CLIENT_ID || !KNOT_SECRET) {
      this.logger.warn('Knot credentials not configured, skipping shopping session creation');
      return null;
    }

    try {
      const auth = Buffer.from(`${KNOT_CLIENT_ID}:${KNOT_SECRET}`).toString('base64');

      const requestBody: KnotSessionRequest = {
        type: 'link',
        external_user_id: userId
      };

      const response = await fetch(`https://${KNOT_ENVIRONMENT}.knotapi.com/session/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Failed to create Knot session: ${response.status} ${errorText}`);
        return null;
      }

      const result: KnotSessionResponse = await response.json();
      this.logger.info(`Created Knot session: ${result.session}`);
      return result.session;

    } catch (error) {
      this.logger.error('Error creating Knot session:', error);
      return null;
    }
  }

  /**
   * Handle a shopping request triggered by voice activation
   */
  private async handleShoppingRequest(session: AppSession, userId: string, query: string): Promise<void> {
    try {
      // Create a new Knot session
      const sessionId = await this.createKnotSession(userId);

      if (!sessionId) {
        session.layouts.showTextWall("❌ Shopping not available. Please configure Knot credentials.", { durationMs: 5000 });
        return;
      }

      // Create a shopping session record
      const shoppingSession: ShoppingSession = {
        id: `shopping_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        sessionId,
        userId,
        timestamp: new Date(),
        status: 'active',
        merchantId: 45, // From the user's configuration
        query: query.trim()
      };

      // Store the shopping session
      if (!this.shoppingSessions.has(userId)) {
        this.shoppingSessions.set(userId, []);
      }
      this.shoppingSessions.get(userId)!.push(shoppingSession);

      session.logger.info(`Shopping request: ${query}`);
      session.layouts.showTextWall(`🛒 Shopping request: "${query}". Open the app's web interface to complete your purchase.`, { durationMs: 8000 });

    } catch (error) {
      this.logger.error('Error handling shopping request:', error);
      session.layouts.showTextWall("❌ Error starting shopping session", { durationMs: 3000 });
    }
  }


  /**
   * Handle successful cart sync
   */
  private async handleCartSuccess(externalUserId: string, cartData: any): Promise<void> {
    this.logger.info(`Cart contains ${cartData.cart?.products?.length || 0} products, total: ${cartData.cart?.price?.total || 'unknown'}`);

    // Store cart data for the user
    if (!this.userTransactions) {
      this.userTransactions = new Map();
    }
    this.userTransactions.set(externalUserId, {
      merchantId: 45, // Walmart
      merchantName: "Walmart",
      transactions: [cartData.cart], // Store cart as "transaction" for now
      syncedAt: new Date()
    });

    // Proceed to checkout
    await this.checkoutCart(externalUserId, 45);
  }

  /**
   * Checkout the cart
   */
  private async checkoutCart(externalUserId: string, merchantId: number): Promise<void> {
    if (!KNOT_CLIENT_ID || !KNOT_SECRET) {
      this.logger.error('Knot credentials not configured, cannot checkout');
      return;
    }

    try {
      const auth = Buffer.from(`${KNOT_CLIENT_ID}:${KNOT_SECRET}`).toString('base64');

      const response = await fetch(`https://${KNOT_ENVIRONMENT}.knotapi.com/shopping/checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          external_user_id: externalUserId,
          merchant_id: merchantId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Failed to checkout: ${response.status} ${errorText}`);
        return;
      }

      await response.json();
      this.logger.info(`Successfully initiated checkout for user ${externalUserId}`);

    } catch (error) {
      this.logger.error('Error during checkout:', error);
    }
  }

  /**
   * Handle successful checkout
   */
  private async handleCheckoutSuccess(externalUserId: string, checkoutData: any): Promise<void> {
    this.logger.info(`Checkout successful for user ${externalUserId}! Transaction IDs: ${checkoutData.transactions?.map((t: any) => t.id).join(', ')}`);

    // Update stored data with checkout results
    if (this.userTransactions.has(externalUserId)) {
      const existing = this.userTransactions.get(externalUserId)!;
      existing.transactions.push({
        type: 'checkout_success',
        checkoutData,
        completedAt: new Date()
      });
    }
  }

  /**
   * Handle calendar request triggered by voice activation
   */
  private async handleCalendarRequest(session: AppSession, userId: string, spokenText: string): Promise<void> {
    try {
      session.logger.info(`Processing calendar request: ${spokenText}`);

      const requestBody = {
        messages: [
          {
            role: 'user',
            content: spokenText
          }
        ]
      };

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const result = await this.retryApiCall(async () => {
        const response = await fetch('https://dashboard.globalstarxyz.com/calendar-agent-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`Calendar agent API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        return await response.json();
      });
      session.logger.info(`Calendar agent response: ${JSON.stringify(result)}`);

      // Validate response structure
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid response from calendar agent');
      }

      // Show response to user with fallback message
      const responseMessage = result.assistant_reply || result.response || 'Calendar request processed';
      session.layouts.showTextWall(`📅 ${responseMessage}`, { durationMs: 8000 });

      // Play audio response through glasses speakers using ElevenLabs TTS
      try {
        await session.audio.speak(responseMessage, {
          voice_settings: {
            stability: 0.7,        // Clear and consistent voice
            similarity_boost: 0.8, // Natural sounding
            style: 0.2,            // Slight expressiveness for calendar responses
            speed: 0.9             // Slightly slower for clarity
          }
        });
        session.logger.info('Calendar response played via TTS');
      } catch (ttsError) {
        session.logger.warn('Failed to play calendar response via TTS:', ttsError);
        // TTS failure shouldn't break the main functionality
      }

      // Process actions if any
      if (result.actions && Array.isArray(result.actions) && result.actions.length > 0) {
        session.logger.info(`Processing ${result.actions.length} calendar actions`);
        for (const action of result.actions) {
          await this.processCalendarAction(action, session, userId);
        }
      }

    } catch (error) {
      this.logger.error('Error handling calendar request:', error);

      // Provide specific error feedback to user
      let errorMessage = "❌ Calendar request failed";
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = "⏱️ Calendar request timed out. Please try again.";
        } else if (error.message.includes('fetch')) {
          errorMessage = "🌐 Unable to connect to calendar service. Check your internet connection.";
        } else if (error.message.includes('404')) {
          errorMessage = "🔍 Calendar service not found. Please contact support.";
        } else if (error.message.includes('500')) {
          errorMessage = "⚙️ Calendar service temporarily unavailable. Try again in a moment.";
        }
      }

      session.layouts.showTextWall(errorMessage, { durationMs: 5000 });

      // Play error message via TTS
      try {
        // Simplify error message for audio
        let audioErrorMessage = "Sorry, there was an issue with your calendar request.";
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            audioErrorMessage = "Calendar request timed out. Please try again.";
          } else if (error.message.includes('fetch')) {
            audioErrorMessage = "Unable to connect to calendar service.";
          }
        }

        await session.audio.speak(audioErrorMessage, {
          voice_settings: { stability: 0.8, speed: 0.95 }
        });
      } catch (ttsError) {
        session.logger.warn('Failed to play error TTS:', ttsError);
      }
    }
  }

  /**
   * Handle email request triggered by voice activation
   */
  private async handleEmailRequest(session: AppSession, userId: string, spokenText: string): Promise<void> {
    try {
      session.logger.info(`Processing email request: ${spokenText}`);

      // Check if user is authorized for Gmail access
      if (!gmailService.isUserAuthorized(userId)) {
        const authUrl = googleCalendarService.generateAuthUrl(userId);
        if (authUrl) {
          session.layouts.showTextWall("🔐 Please authorize Gmail access", { durationMs: 5000 });
          session.audio.speak("Please authorize Gmail access to use email features. Check your dashboard for the authorization link.", {
            voice_settings: { stability: 0.8, speed: 0.95 }
          });
          return;
        } else {
          throw new Error('Gmail not configured properly');
        }
      }

      // Get recent emails for context
      const contextEmails = await this.getRecentEmailsForContext(userId);
      session.logger.info(`Got ${contextEmails.length} emails for context`);

      // Process the email request locally based on common email actions
      const lowerText = spokenText.toLowerCase();
      let responseMessage = "";
      let actionPerformed = false;

      if (lowerText.includes('check') || lowerText.includes('inbox') || lowerText.includes('unread')) {
        // Check email summary
        const unreadCount = await gmailService.getUnreadCount(userId);
        const recentEmails = await gmailService.getRecentEmails(userId, 3);

        if (unreadCount === 0) {
          responseMessage = "You have no unread emails. Your inbox is all caught up!";
        } else {
          const emailSummary = recentEmails.slice(0, 2).map(email =>
            `${email.from}: ${email.subject}`
          ).join('. ');

          responseMessage = `You have ${unreadCount} unread email${unreadCount > 1 ? 's' : ''}. Recent messages: ${emailSummary}`;
        }
        actionPerformed = true;

      } else if (lowerText.includes('reply') || lowerText.includes('respond')) {
        // Reply functionality
        responseMessage = "To reply to emails, please use the dashboard interface or specify which email you'd like to reply to.";
        actionPerformed = true;

      } else if (lowerText.includes('send') || lowerText.includes('compose') || lowerText.includes('write')) {
        // Send/compose functionality
        responseMessage = "To compose and send emails, please use the dashboard interface where you can specify recipients and content.";
        actionPerformed = true;

      } else {
        // Generic email summary
        const unreadCount = await gmailService.getUnreadCount(userId);
        if (contextEmails.length > 0) {
          const latestEmail = contextEmails[0];
          responseMessage = `Latest email from ${latestEmail.from}: ${latestEmail.subject}. You have ${unreadCount} unread emails total.`;
        } else {
          responseMessage = `You have ${unreadCount} unread emails. Use the dashboard to manage your email.`;
        }
        actionPerformed = true;
      }

      if (actionPerformed) {
        // Show response to user
        session.layouts.showTextWall(`📧 ${responseMessage}`, { durationMs: 8000 });

        // Play audio response through glasses speakers
        try {
          await session.audio.speak(responseMessage, {
            voice_settings: { stability: 0.6, speed: 0.85 }
          });
          session.logger.info('Email response played via TTS');
        } catch (audioError) {
          session.logger.warn('Failed to play email response TTS:', audioError);
        }
      }

    } catch (error) {
      this.logger.error('Error handling email request:', error);

      // Provide specific error feedback to user
      let errorMessage = "❌ Email request failed";
      if (error instanceof Error) {
        if (error.message.includes('not authorized') || error.message.includes('Gmail not configured')) {
          errorMessage = "🔐 Gmail authorization required";
        } else if (error.message.includes('quota') || error.message.includes('rate limit')) {
          errorMessage = "⏱️ Gmail rate limit reached";
        }
      }

      // Display error on glasses
      session.layouts.showTextWall(errorMessage, { durationMs: 5000 });

      // Play error message via TTS
      try {
        let audioErrorMessage = "Sorry, there was an issue with your email request.";
        if (error instanceof Error) {
          if (error.message.includes('not authorized') || error.message.includes('Gmail not configured')) {
            audioErrorMessage = "Please authorize Gmail access first to use email features.";
          } else if (error.message.includes('quota') || error.message.includes('rate limit')) {
            audioErrorMessage = "Gmail rate limit reached. Please try again later.";
          }
        }

        await session.audio.speak(audioErrorMessage, {
          voice_settings: { stability: 0.8, speed: 0.95 }
        });
      } catch (ttsError) {
        session.logger.warn('Failed to play email error TTS:', ttsError);
      }
    }
  }

  /**
   * Process calendar actions from the dashboard API
   */
  private async processCalendarAction(action: any, session: AppSession, userId: string): Promise<void> {
    session.logger.info(`Processing calendar action: ${action.type} for user ${userId}`);

    try {
      switch (action.type) {
        case 'create_event':
          const title = action.data?.title || 'New Event';
          const actionMessage1 = `Creating calendar event: ${title}`;
          session.layouts.showTextWall(`📅 ${actionMessage1}`, { durationMs: 5000 });

          // Play audio confirmation
          try {
            await session.audio.speak(actionMessage1, {
              voice_settings: { stability: 0.8, speed: 0.9 }
            });
          } catch (error) {
            session.logger.warn('Failed to play action TTS:', error);
          }
          // Create actual Google Calendar event
          await this.createGoogleCalendarEvent(userId, action.data);
          break;

        case 'check_calendar':
          const actionMessage2 = "Checking your calendar now";
          session.layouts.showTextWall(`📅 ${actionMessage2}...`, { durationMs: 3000 });

          // Play audio confirmation
          try {
            await session.audio.speak(actionMessage2, {
              voice_settings: { stability: 0.8, speed: 0.9 }
            });
          } catch (error) {
            session.logger.warn('Failed to play action TTS:', error);
          }
          // Fetch actual Google Calendar events
          await this.fetchGoogleCalendarEvents(userId, action.data);
          break;

        case 'schedule_meeting':
          const meetingTitle = action.data?.title || 'Meeting';
          const attendees = action.data?.attendees || [];
          const actionMessage3 = `Scheduling meeting: ${meetingTitle} with ${attendees.length} attendees`;
          session.layouts.showTextWall(`📅 ${actionMessage3}`, { durationMs: 5000 });

          // Play audio confirmation
          try {
            await session.audio.speak(actionMessage3, {
              voice_settings: { stability: 0.8, speed: 0.9 }
            });
          } catch (error) {
            session.logger.warn('Failed to play action TTS:', error);
          }
          break;

        default:
          session.logger.warn(`Unknown calendar action type: ${action.type}`);
          const defaultMessage = "Calendar action completed";
          session.layouts.showTextWall("📅 Calendar action processed", { durationMs: 3000 });

          try {
            await session.audio.speak(defaultMessage, {
              voice_settings: { stability: 0.8, speed: 0.9 }
            });
          } catch (error) {
            session.logger.warn('Failed to play action TTS:', error);
          }
      }
    } catch (error) {
      session.logger.error(`Error processing calendar action ${action.type}:`, error);
      session.layouts.showTextWall("❌ Calendar action failed", { durationMs: 3000 });
    }
  }

  /**
   * Process email actions from the dashboard API
   */
  private async processEmailAction(action: any, session: AppSession, userId: string): Promise<void> {
    session.logger.info(`Processing email action: ${action.type} for user ${userId}`);

    try {
      switch (action.type) {
        case 'send_email':
          const recipient = action.data?.to || 'recipient';
          const emailMessage1 = `Sending email to ${recipient}`;
          session.layouts.showTextWall(`📧 ${emailMessage1}`, { durationMs: 5000 });

          // Play audio confirmation
          try {
            await session.audio.speak(emailMessage1, {
              voice_settings: { stability: 0.7, speed: 0.9 }
            });
          } catch (error) {
            session.logger.warn('Failed to play email action TTS:', error);
          }
          // TODO: In a full implementation, integrate with Gmail API
          // await this.sendGmailMessage(userId, action.data);
          break;

        case 'reply_email':
          const replySubject = action.data?.subject || 'previous email';
          const emailMessage2 = `Replying to ${replySubject}`;
          session.layouts.showTextWall(`📧 ${emailMessage2}`, { durationMs: 3000 });

          // Play audio confirmation
          try {
            await session.audio.speak(emailMessage2, {
              voice_settings: { stability: 0.7, speed: 0.9 }
            });
          } catch (error) {
            session.logger.warn('Failed to play email action TTS:', error);
          }
          // TODO: In a full implementation, send reply via Gmail API
          // await this.replyToGmailMessage(userId, action.data);
          break;

        case 'check_inbox':
          const emailMessage3 = "Checking your inbox now";
          session.layouts.showTextWall(`📧 ${emailMessage3}...`, { durationMs: 3000 });

          // Play audio confirmation
          try {
            await session.audio.speak(emailMessage3, {
              voice_settings: { stability: 0.7, speed: 0.9 }
            });
          } catch (error) {
            session.logger.warn('Failed to play email action TTS:', error);
          }
          // TODO: In a full implementation, fetch emails from Gmail
          // const emails = await this.fetchGmailMessages(userId, action.data);
          break;

        case 'compose_email':
          const emailMessage4 = "Composing new email";
          session.layouts.showTextWall(`📧 ${emailMessage4}...`, { durationMs: 3000 });

          // Play audio confirmation
          try {
            await session.audio.speak(emailMessage4, {
              voice_settings: { stability: 0.7, speed: 0.9 }
            });
          } catch (error) {
            session.logger.warn('Failed to play email action TTS:', error);
          }
          // TODO: Draft new email composition
          break;

        default:
          session.logger.warn(`Unknown email action type: ${action.type}`);
          const defaultEmailMessage = "Email action completed";
          session.layouts.showTextWall("📧 Email action processed", { durationMs: 3000 });

          try {
            await session.audio.speak(defaultEmailMessage, {
              voice_settings: { stability: 0.7, speed: 0.9 }
            });
          } catch (error) {
            session.logger.warn('Failed to play email action TTS:', error);
          }
      }
    } catch (error) {
      session.logger.error(`Error processing email action ${action.type}:`, error);
      session.layouts.showTextWall("❌ Email action failed", { durationMs: 3000 });
    }
  }

  /**
   * Add a photo to the user's gallery
   */
  private addPhotoToGallery(photo: PhotoData, userId: string): void {
    if (!this.photoGalleries.has(userId)) {
      this.photoGalleries.set(userId, []);
    }

    const storedPhoto: StoredPhoto = {
      requestId: photo.requestId,
      buffer: photo.buffer,
      timestamp: photo.timestamp,
      userId,
      mimeType: photo.mimeType,
      filename: photo.filename,
      size: photo.size,
      selected: false,
      caption: undefined,
      captionGenerated: false
    };

    const gallery = this.photoGalleries.get(userId)!;
    gallery.push(storedPhoto);

    // Keep only the last 50 photos per user
    if (gallery.length > 50) {
      gallery.shift();
    }

    this.logger.info(`Added photo to gallery for user ${userId}, total photos: ${gallery.length}`);

    // Generate caption asynchronously (don't block photo storage)
    this.generateCaptionAsync(storedPhoto);
  }

  /**
   * Generate caption asynchronously and update photo in gallery
   */
  private async generateCaptionAsync(storedPhoto: StoredPhoto): Promise<void> {
    try {
      const caption = await this.generatePhotoCaption(storedPhoto.buffer, storedPhoto.mimeType);
      storedPhoto.caption = caption || undefined;
      storedPhoto.captionGenerated = true;

      this.logger.debug(`Caption generated for photo ${storedPhoto.requestId}: ${caption?.slice(0, 50)}...`);
    } catch (error) {
      this.logger.error(`Failed to generate caption for photo ${storedPhoto.requestId}:`, error);
      storedPhoto.captionGenerated = true; // Mark as attempted even if failed
    }
  }

  /**
   * Get the latest photo for a user (for backward compatibility)
   */
  private getLatestPhoto(userId: string): StoredPhoto | undefined {
    const gallery = this.photoGalleries.get(userId);
    return gallery && gallery.length > 0 ? gallery[gallery.length - 1] : undefined;
  }

  /**
   * Add a generated song to the user's gallery
   */
  private addSongToGallery(userId: string, clipId: string, prompt: string, tags: string, selectedPhotosCount: number, selectedTranscriptionsCount: number): GeneratedSong {
    if (!this.songGalleries.has(userId)) {
      this.songGalleries.set(userId, []);
    }

    const song: GeneratedSong = {
      id: `song-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      clipId,
      title: '', // Will be updated when available
      status: 'submitted',
      audioUrl: null,
      imageUrl: null,
      createdAt: new Date(),
      completedAt: null,
      userId,
      prompt,
      tags,
      selectedPhotosCount,
      selectedTranscriptionsCount,
      metadata: {},
      favorite: false
    };

    const gallery = this.songGalleries.get(userId)!;
    gallery.push(song);

    // Keep only the last 25 songs per user
    if (gallery.length > 25) {
      gallery.shift();
    }

    // Track active generation
    this.activeGenerations.set(clipId, userId);

    this.logger.info(`Added song to gallery for user ${userId}, clipId: ${clipId}`);
    return song;
  }

  /**
   * Update song status and metadata
   */
  private updateSongInGallery(clipId: string, status: string, title?: string, audioUrl?: string, imageUrl?: string, metadata?: any): void {
    const userId = this.activeGenerations.get(clipId);
    if (!userId) return;

    const gallery = this.songGalleries.get(userId);
    if (!gallery) return;

    const song = gallery.find(s => s.clipId === clipId);
    if (!song) return;

    song.status = status;
    if (title) song.title = title;
    if (audioUrl) song.audioUrl = audioUrl;
    if (imageUrl) song.imageUrl = imageUrl;
    if (metadata) song.metadata = metadata;

    if (status === 'complete') {
      song.completedAt = new Date();
      this.activeGenerations.delete(clipId); // Clean up tracking
    }

    this.logger.debug(`Updated song ${song.id} for user ${userId}, status: ${status}`);
  }

  /**
   * Get user's song gallery
   */
  private getSongGallery(userId: string): GeneratedSong[] {
    return this.songGalleries.get(userId) || [];
  }

  /**
   * Create Google Calendar event
   */
  private async createGoogleCalendarEvent(userId: string, eventData: any): Promise<void> {
    try {
      this.logger.info(`[Calendar Auth Debug] Attempting to create event for user: ${userId}`);
      
      if (!googleCalendarService.isConfigured()) {
        this.logger.warn('Google Calendar not configured, skipping event creation');
        return;
      }

      if (!googleCalendarService.isUserAuthorized(userId)) {
        this.logger.warn(`User ${userId} not authorized with Google Calendar`);
        this.logger.info(`[Calendar Auth Debug] Available authorized users: ${JSON.stringify(Array.from(googleCalendarService.getAuthorizedUsers()))}`);
        this.logger.info(`[Calendar Auth Debug] Google Calendar service configured: ${googleCalendarService.isConfigured()}`);
        return;
      }

      const createData: CreateEventData = {
        title: eventData.title || eventData.summary || 'New Event',
        description: eventData.description || 'Created by MentraOS Calendar AI',
        location: eventData.location || '',
        start_time: eventData.start_time || eventData.startTime || new Date().toISOString(),
        end_time: eventData.end_time || eventData.endTime || new Date(Date.now() + 3600000).toISOString(),
        attendees: eventData.attendees || [],
        timeZone: eventData.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
      };

      const createdEvent = await googleCalendarService.createEvent(userId, createData);

      if (createdEvent) {
        this.logger.info(`Created Google Calendar event: ${createdEvent.id} - ${createdEvent.summary}`);
      } else {
        this.logger.error('Failed to create Google Calendar event');
      }

    } catch (error) {
      this.logger.error('Error creating Google Calendar event:', error);
    }
  }

  /**
   * Fetch Google Calendar events
   */
  private async fetchGoogleCalendarEvents(userId: string, dateRange?: any): Promise<void> {
    try {
      this.logger.info(`[Calendar Auth Debug] Attempting to fetch events for user: ${userId}`);
      
      if (!googleCalendarService.isConfigured()) {
        this.logger.warn('Google Calendar not configured, skipping event fetch');
        return;
      }

      if (!googleCalendarService.isUserAuthorized(userId)) {
        this.logger.warn(`User ${userId} not authorized with Google Calendar`);
        this.logger.info(`[Calendar Auth Debug] Available authorized users: ${JSON.stringify(Array.from(googleCalendarService.getAuthorizedUsers()))}`);
        this.logger.info(`[Calendar Auth Debug] Google Calendar service configured: ${googleCalendarService.isConfigured()}`);
        return;
      }

      let events;
      if (dateRange && dateRange.start_date && dateRange.end_date) {
        const startDate = new Date(dateRange.start_date);
        const endDate = new Date(dateRange.end_date);
        events = await googleCalendarService.getEvents(userId, startDate, endDate);
      } else {
        // Default to today's events
        events = await googleCalendarService.getTodaysEvents(userId);
      }

      this.logger.info(`Fetched ${events.length} calendar events for user ${userId}`);

      // Store events for API access (optional - you might want to cache these)
      // You could add a calendarEvents Map similar to other data structures

    } catch (error) {
      this.logger.error('Error fetching Google Calendar events:', error);
    }
  }

  /**
   * Get recent activity for a user (for dashboard)
   */
  private getRecentActivityForUser(userId: string): Array<{type: string, timestamp: number, description: string, data?: any}> {
    const activities: Array<{type: string, timestamp: number, description: string, data?: any}> = [];

    // Add recent photos
    const recentPhotos = (this.photoGalleries.get(userId) || []).slice(-5);
    recentPhotos.forEach(photo => {
      activities.push({
        type: 'photo',
        timestamp: photo.timestamp.getTime(),
        description: `Photo captured${photo.caption ? ': ' + photo.caption.slice(0, 50) + '...' : ''}`,
        data: { requestId: photo.requestId, caption: photo.caption }
      });
    });

    // Add recent transcriptions
    const recentTranscriptions = (this.transcriptionHistory.get(userId) || []).slice(-5);
    recentTranscriptions.forEach(transcription => {
      activities.push({
        type: 'transcription',
        timestamp: transcription.timestamp.getTime(),
        description: `${transcription.isActivationPhrase ? 'Voice command' : 'Voice note'}: "${transcription.text.slice(0, 50)}${transcription.text.length > 50 ? '...' : ''}"`,
        data: { id: transcription.id, isActivationPhrase: transcription.isActivationPhrase }
      });
    });

    // Add recent songs
    const recentSongs = (this.songGalleries.get(userId) || []).slice(-3);
    recentSongs.forEach(song => {
      activities.push({
        type: 'song',
        timestamp: song.createdAt.getTime(),
        description: `Song ${song.status === 'complete' ? 'completed' : song.status === 'streaming' ? 'streaming' : 'started'}: "${song.title || 'Untitled'}"`,
        data: { id: song.id, status: song.status, clipId: song.clipId }
      });
    });

    // Sort by timestamp, newest first, and return last 10
    return activities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
  }



  /**
 * Set up webview routes for photo display functionality
 */
  private setupWebviewRoutes(): void {
    const app = this.getExpressApp();

    // API endpoint to get the latest photo for the authenticated user (backward compatibility)
    app.get('/api/latest-photo', (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;

      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const photo = this.getLatestPhoto(userId);
      if (!photo) {
        res.status(404).json({ error: 'No photo available' });
        return;
      }

      res.json({
        requestId: photo.requestId,
        timestamp: photo.timestamp.getTime(),
        hasPhoto: true
      });
    });

    // API endpoint to get the photo gallery for the authenticated user
    app.get('/api/gallery', (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;

      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const gallery = this.photoGalleries.get(userId) || [];

      res.json({
        photos: gallery.map(photo => ({
          requestId: photo.requestId,
          timestamp: photo.timestamp.getTime(),
          filename: photo.filename,
          size: photo.size,
          mimeType: photo.mimeType,
          selected: photo.selected || false,
          caption: photo.caption,
          captionGenerated: photo.captionGenerated || false
        }))
      });
    });

    // API endpoint to get transcription history for the authenticated user
    app.get('/api/transcriptions', (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;

      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const history = this.transcriptionHistory.get(userId) || [];

      res.json({
        transcriptions: history.map(entry => ({
          id: entry.id,
          text: entry.text,
          timestamp: entry.timestamp.getTime(),
          isActivationPhrase: entry.isActivationPhrase,
          selected: entry.selected || false
        }))
      });
    });

    // API endpoint to get photo data
    app.get('/api/photo/:requestId', (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;
      const requestId = req.params.requestId;

      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const gallery = this.photoGalleries.get(userId) || [];
      const photo = gallery.find(p => p.requestId === requestId);

      if (!photo) {
        res.status(404).json({ error: 'Photo not found' });
        return;
      }

      res.set({
        'Content-Type': photo.mimeType,
        'Cache-Control': 'no-cache'
      });
      res.send(photo.buffer);
    });

    // API endpoint to toggle photo selection
    app.post('/api/gallery/select', (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;
      const { requestId, selected } = req.body;

      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const gallery = this.photoGalleries.get(userId) || [];
      const photo = gallery.find(p => p.requestId === requestId);

      if (!photo) {
        res.status(404).json({ error: 'Photo not found' });
        return;
      }

      photo.selected = selected;
      res.json({ success: true, selected: photo.selected });
    });

    // API endpoint to toggle transcription selection
    app.post('/api/transcriptions/select', (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;
      const { id, selected } = req.body;

      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const history = this.transcriptionHistory.get(userId) || [];
      const entry = history.find(t => t.id === id);

      if (!entry) {
        res.status(404).json({ error: 'Transcription not found' });
        return;
      }

      entry.selected = selected;
      res.json({ success: true, selected: entry.selected });
    });

    // API endpoint to generate song using Suno API
    app.post('/api/generate-song', async (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;
      const { customPrompt, tags } = req.body;

      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      try {
        // Get selected photos and transcriptions
        const gallery = this.photoGalleries.get(userId) || [];
        const history = this.transcriptionHistory.get(userId) || [];

        const selectedPhotos = gallery.filter(p => p.selected);
        const selectedTranscriptions = history.filter(t => t.selected);

        // Build song prompt from selected content
        let songPrompt = '';

        if (customPrompt) {
          songPrompt += customPrompt + ' ';
        } else {
          songPrompt += 'A song inspired by captured moments and conversations. ';
        }

        // Add photo captions to the prompt (with length limits)
        if (selectedPhotos.length > 0) {
          const photoCaptions = selectedPhotos
            .filter(p => p.caption)
            .map(p => p.caption?.slice(0, 100)) // Limit each caption to 100 chars
            .join('. ')
            .slice(0, 400); // Limit total photo captions to 400 chars

          if (photoCaptions) {
            songPrompt += `Visual inspiration from ${selectedPhotos.length} photo${selectedPhotos.length > 1 ? 's' : ''}: ${photoCaptions}. `;
          } else {
            songPrompt += `Based on ${selectedPhotos.length} memorable photo${selectedPhotos.length > 1 ? 's' : ''}. `;
          }
        }

        // Add transcription content
        if (selectedTranscriptions.length > 0) {
          const transcriptionText = selectedTranscriptions
            .map(t => t.text)
            .join(' ')
            .slice(0, 500); // Limit length
          songPrompt += `Incorporating themes from spoken words: "${transcriptionText}". `;
        }

        // Make request to Suno API (using environment variable for API key)
        const sunoApiKey = process.env.SUNO_API_KEY;
        if (!sunoApiKey) {
          res.status(500).json({ error: 'Suno API key not configured' });
          return;
        }

        // Ensure prompt doesn't exceed Suno's limits
        const finalPrompt = songPrompt.slice(0, 2400); // Leave some buffer under 2500 limit

        const requestBody = {
          topic: finalPrompt,
          tags: tags || 'ambient, atmospheric, reflective',
          make_instrumental: false,
        };

        this.logger.info('Sending Suno API request:', {
          url: 'https://studio-api.prod.suno.com/api/v2/external/hackmit/generate',
          promptLength: finalPrompt.length,
          selectedPhotos: selectedPhotos.length,
          selectedTranscriptions: selectedTranscriptions.length,
          body: requestBody,
          apiKeyPrefix: sunoApiKey.slice(0, 8) + '...'
        });

        const response = await fetch(
          'https://studio-api.prod.suno.com/api/v2/external/hackmit/generate',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${sunoApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          this.logger.error('Suno API generation error:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          });
          res.status(500).json({
            error: 'Failed to generate song',
            details: `HTTP ${response.status}: ${errorText}`
          });
          return;
        }

        const result = await response.json();
        this.logger.info(`Song generation started for user ${userId}, clip ID: ${result.id}`);

        // Save to song gallery
        const song = this.addSongToGallery(
          userId,
          result.id,
          finalPrompt,
          tags || 'ambient, atmospheric, reflective',
          selectedPhotos.length,
          selectedTranscriptions.length
        );

        res.json({
          success: true,
          clipId: result.id,
          songId: song.id,
          status: result.status,
          prompt: finalPrompt,
          promptLength: finalPrompt.length,
          selectedPhotos: selectedPhotos.length,
          selectedTranscriptions: selectedTranscriptions.length
        });

      } catch (error) {
        this.logger.error('Song generation error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // API endpoint to check Suno song generation status
    app.get('/api/song-status/:clipId', async (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;
      const clipId = req.params.clipId;

      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      try {
        const sunoApiKey = process.env.SUNO_API_KEY;
        if (!sunoApiKey) {
          res.status(500).json({ error: 'Suno API key not configured' });
          return;
        }

        const response = await fetch(
          `https://studio-api.prod.suno.com/api/v2/external/hackmit/clips?ids=${clipId}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${sunoApiKey}`,
            },
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          this.logger.error('Suno API status check error:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          });
          res.status(500).json({
            error: 'Failed to check song status',
            details: `HTTP ${response.status}: ${errorText}`
          });
          return;
        }

        const clips = await response.json();
        const clip = clips[0];

        // Update song in gallery
        this.updateSongInGallery(
          clipId,
          clip.status,
          clip.title,
          clip.audio_url,
          clip.image_url,
          clip.metadata
        );

        res.json({
          id: clip.id,
          status: clip.status,
          title: clip.title,
          audio_url: clip.audio_url,
          image_url: clip.image_url,
          created_at: clip.created_at,
          metadata: clip.metadata
        });

      } catch (error) {
        this.logger.error('Song status check error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // API endpoint to get user's song gallery
    app.get('/api/songs', (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;

      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const songs = this.getSongGallery(userId);

      res.json({
        songs: songs.map(song => ({
          id: song.id,
          clipId: song.clipId,
          title: song.title || 'Untitled',
          status: song.status,
          audioUrl: song.audioUrl,
          imageUrl: song.imageUrl,
          createdAt: song.createdAt.getTime(),
          completedAt: song.completedAt ? song.completedAt.getTime() : null,
          prompt: song.prompt,
          tags: song.tags,
          selectedPhotosCount: song.selectedPhotosCount,
          selectedTranscriptionsCount: song.selectedTranscriptionsCount,
          favorite: song.favorite || false,
          metadata: song.metadata
        }))
      });
    });

    // API endpoint to toggle song favorite status
    app.post('/api/songs/favorite', (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;
      const { songId, favorite } = req.body;

      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const songs = this.getSongGallery(userId);
      const song = songs.find(s => s.id === songId);

      if (!song) {
        res.status(404).json({ error: 'Song not found' });
        return;
      }

      song.favorite = favorite;
      res.json({ success: true, favorite: song.favorite });
    });

    // API endpoint to delete a song
    app.delete('/api/songs/:songId', (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;
      const songId = req.params.songId;

      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const songs = this.getSongGallery(userId);
      const songIndex = songs.findIndex(s => s.id === songId);

      if (songIndex === -1) {
        res.status(404).json({ error: 'Song not found' });
        return;
      }

      const song = songs[songIndex];

      // Remove from active generations if still generating
      if (this.activeGenerations.has(song.clipId)) {
        this.activeGenerations.delete(song.clipId);
      }

      // Remove from gallery
      songs.splice(songIndex, 1);

      res.json({ success: true });
    });

    // Main webview route - now displays the dashboard as the primary interface
    app.get('/webview', async (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;

      if (!userId) {
        res.status(401).send(`
          <html>
            <head><title>MentraOS Dashboard - Not Authenticated</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #0f0f1a; color: white;">
              <h1>Please open this page from the MentraOS app</h1>
            </body>
          </html>
        `);
        return;
      }

      const templatePath = path.join(process.cwd(), 'views', 'dashboard-interface.ejs');
      const html = await ejs.renderFile(templatePath, {});
      res.send(html);
    });

    // Legacy interface route - displays the original enhanced interface
    app.get('/legacy', async (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;

      if (!userId) {
        res.status(401).send(`
          <html>
            <head><title>Photo & Audio Studio - Not Authenticated</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>Please open this page from the MentraOS app</h1>
            </body>
          </html>
        `);
        return;
      }

      const templatePath = path.join(process.cwd(), 'views', 'enhanced-interface.ejs');
      const html = await ejs.renderFile(templatePath, {});
      res.send(html);
    });

    // Dashboard route - alias for /webview for backward compatibility
    app.get('/dashboard', async (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;

      if (!userId) {
        res.status(401).send(`
          <html>
            <head><title>MentraOS Dashboard - Not Authenticated</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #0f0f1a; color: white;">
              <h1>Please open this page from the MentraOS app</h1>
            </body>
          </html>
        `);
        return;
      }

      const templatePath = path.join(process.cwd(), 'views', 'dashboard-interface.ejs');
      const html = await ejs.renderFile(templatePath, {});
      res.send(html);
    });

    // Shopping webview route - displays the Knot SDK interface
    app.get('/shopping', async (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;
      const { sessionId, query } = req.query;

      if (!userId) {
        res.status(401).send(`
          <html>
            <head><title>Shopping - Not Authenticated</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>Please open this page from the MentraOS app</h1>
            </body>
          </html>
        `);
        return;
      }

      // Handle manual shopping requests from the web interface
      let actualSessionId = sessionId;
      if (sessionId === 'manual') {
        if (!KNOT_CLIENT_ID) {
          res.send(`
            <html>
              <head>
                <title>Shopping - Not Available</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1>🛒 Shopping Not Available</h1>
                <p>Knot integration is not configured. Please add KNOT_CLIENT_ID and KNOT_SECRET to your .env file.</p>
              </body>
            </html>
          `);
          return;
        }

        // Create a new session for manual requests
        this.logger.info(`Creating Knot session with CLIENT_ID: ${KNOT_CLIENT_ID ? 'SET' : 'NOT SET'}`);
        actualSessionId = await this.createKnotSession(userId || 'manual_user');
        if (!actualSessionId) {
          res.send(`
            <html>
              <head>
                <title>Shopping - Error</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1>🛒 Shopping Error</h1>
                <p>Failed to create shopping session. Please check your Knot credentials.</p>
              </body>
            </html>
          `);
          return;
        }
      }

      // Debug logging
      this.logger.info(`Shopping route - KNOT_CLIENT_ID: ${KNOT_CLIENT_ID}`);
      this.logger.info(`Shopping route - KNOT_SECRET: ${KNOT_SECRET ? 'SET' : 'NOT SET'}`);
      this.logger.info(`Shopping route - actualSessionId: ${actualSessionId}`);

      if (!KNOT_CLIENT_ID || !actualSessionId) {
        res.send(`
          <html>
            <head>
              <title>Shopping - Not Available</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>🛒 Shopping Not Available</h1>
              <p>Knot integration is not configured.</p>
              <p>CLIENT_ID: ${KNOT_CLIENT_ID || 'NOT SET'}</p>
              <p>SESSION_ID: ${actualSessionId || 'NOT SET'}</p>
            </body>
          </html>
        `);
        return;
      }

      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Shopping</title>
          <script src="https://unpkg.com/knotapi-js@next"></script>
          <style>
            body {
              margin: 0;
              padding: 20px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
              background-color: #f5f5f5;
            }
            .container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              border-radius: 12px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.1);
              padding: 30px;
            }
            h1 {
              color: #333;
              margin-bottom: 10px;
            }
            .query {
              background: #e3f2fd;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 20px;
              font-style: italic;
              border-left: 4px solid #2196f3;
            }
            #knot-container {
              min-height: 600px;
              border: 1px solid #ddd;
              border-radius: 8px;
              background: white;
            }
            .loading {
              text-align: center;
              padding: 50px;
              color: #666;
            }
            .error {
              background: #ffebee;
              color: #c62828;
              padding: 20px;
              border-radius: 8px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🛒 Shopping with Voice</h1>

            ${query ? `<div class="query">You said: "${query}"</div>` : ''}

            <div id="knot-container">
              <div class="loading">
                <p>🔄 Loading shopping interface...</p>
              </div>
            </div>

            <div id="error-container"></div>
          </div>

          <script>
            console.log('Shopping page loaded');
            console.log('window.KnotapiJS:', window.KnotapiJS);

            if (!window.KnotapiJS) {
              document.getElementById('error-container').innerHTML =
                '<div class="error"><h3>⚠️ SDK Loading Error</h3><p>Knot SDK failed to load from CDN</p></div>';
              throw new Error('Knot SDK not loaded');
            }

            const KnotapiJS = window.KnotapiJS.default || window.KnotapiJS;
            console.log('KnotapiJS:', KnotapiJS);

            if (!KnotapiJS) {
              document.getElementById('error-container').innerHTML =
                '<div class="error"><h3>⚠️ SDK Error</h3><p>KnotapiJS constructor not found</p></div>';
              throw new Error('KnotapiJS constructor not found');
            }

            const knotapi = new KnotapiJS();
            console.log('Knot API instance created:', knotapi);

            try {
              console.log('Knot Configuration:');
              console.log('sessionId:', "${actualSessionId}");
              console.log('clientId:', "${KNOT_CLIENT_ID}");
              console.log('environment:', "${KNOT_ENVIRONMENT}");

              // Initialize Knot SDK
              knotapi.open({
                sessionId: "${actualSessionId}",
                clientId: "${KNOT_CLIENT_ID}",
                environment: "${KNOT_ENVIRONMENT}",
                product: "link",
                merchantIds: [45],
                entryPoint: "voice_shopping",
                useCategories: true,
                useSearch: true,

                onSuccess: (product, details) => {
                  console.log("Shopping success:", product, details);
                  document.getElementById('knot-container').innerHTML =
                    '<div style="text-align: center; padding: 50px; color: green;">' +
                      '<h2>✅ Authentication Successful!</h2>' +
                      '<p>You are now connected to the merchant.</p>' +
                      '<p>In a real shopping app, you would now be able to:</p>' +
                      '<ul style="text-align: left; max-width: 300px; margin: 20px auto;">' +
                        '<li>Browse products</li>' +
                        '<li>Add items to cart</li>' +
                        '<li>Complete checkout</li>' +
                      '</ul>' +
                    '</div>';
                },

                onError: (product, errorCode, errorDescription) => {
                  console.error("Shopping error details:");
                  console.error("Product:", product);
                  console.error("Error Code:", errorCode);
                  console.error("Error Description:", errorDescription);
                  document.getElementById('error-container').innerHTML =
                    '<div class="error"><h3>⚠️ Error</h3><p><strong>Code:</strong> ' + errorCode + '</p><p><strong>Message:</strong> ' + errorDescription + '</p></div>';
                },

                onEvent: (product, event, merchant, merchantId, payload, taskId) => {
                  console.log("Shopping event:", product, event, merchant, merchantId, payload, taskId);

                  // Update UI based on events
                  if (event === 'MERCHANT_CLICKED') {
                    document.getElementById('knot-container').innerHTML =
                      '<div class="loading"><p>🏪 Connecting to ' + merchant + '...</p></div>';
                  } else if (event === 'LOGIN_STARTED') {
                    document.getElementById('knot-container').innerHTML =
                      '<div class="loading"><p>🔐 Logging in...</p></div>';
                  } else if (event === 'AUTHENTICATED') {
                    document.getElementById('knot-container').innerHTML =
                      '<div class="loading"><p>✅ Successfully authenticated!</p></div>';
                  }
                },

                onExit: (product) => {
                  console.log("Shopping exit:", product);
                  window.close();
                }
              });

            } catch (error) {
              console.error('Failed to initialize Knot SDK:', error);
              document.getElementById('knot-container').innerHTML =
                '<div class="error"><h3>⚠️ Initialization Error</h3><p>Failed to load the shopping interface.</p><p>Error: ' + error.message + '</p></div>';
              document.getElementById('error-container').innerHTML =
                '<div class="error"><h3>⚠️ Detailed Error</h3><p>' + error.toString() + '</p></div>';
            }

            // Function to poll for transaction data
            function pollForTransactions() {
              let attempts = 0;
              const maxAttempts = 12; // Poll for up to 60 seconds

              const pollInterval = setInterval(async () => {
                attempts++;

                try {
                  const response = await fetch('/api/transactions');
                  const data = await response.json();

                  if (data.transactions && data.transactions.length > 0) {
                    displayTransactions(data);
                    clearInterval(pollInterval);
                  } else if (attempts >= maxAttempts) {
                    document.getElementById('knot-container').innerHTML =
                      '<div class="error"><h3>⚠️ No Transactions Found</h3><p>Transaction sync may have failed or no transactions are available.</p></div>';
                    clearInterval(pollInterval);
                  }
                } catch (error) {
                  console.error('Error polling for transactions:', error);
                  if (attempts >= maxAttempts) {
                    clearInterval(pollInterval);
                  }
                }
              }, 5000); // Poll every 5 seconds
            }

            // Function to display shopping results
            function displayTransactions(data) {
              if (!data.transactions || data.transactions.length === 0) {
                document.getElementById('knot-container').innerHTML =
                  '<div style="text-align: center; padding: 50px; color: orange;">' +
                    '<h2>🛒 Shopping in Progress</h2>' +
                    '<p>Your shopping session is active. Waiting for cart and checkout data...</p>' +
                  '</div>';
                return;
              }

              const cartHtml = data.transactions.map(item => {
                if (item.products) {
                  // Cart display
                  return '<div style="background: #e8f5e8; padding: 15px; margin: 10px 0; border-radius: 8px; color: #333;">' +
                    '<h4>🛒 Shopping Cart</h4>' +
                    '<p><strong>Products:</strong> ' + item.products.length + '</p>' +
                    '<p><strong>Total:</strong> $' + (item.price?.total || '0.00') + ' ' + (item.price?.currency || 'USD') + '</p>' +
                    '<p><strong>Subtotal:</strong> $' + (item.price?.sub_total || '0.00') + '</p>' +
                    '</div>';
                } else if (item.type === 'checkout_success') {
                  // Checkout success display
                  return '<div style="background: #d4edda; padding: 15px; margin: 10px 0; border-radius: 8px; color: #333;">' +
                    '<h4>✅ Checkout Complete!</h4>' +
                    '<p><strong>Order placed successfully</strong></p>' +
                    '<p><strong>Completed:</strong> ' + new Date(item.completedAt).toLocaleString() + '</p>' +
                    '</div>';
                }
                return '<div style="background: #f0f0f0; padding: 15px; margin: 10px 0; border-radius: 8px; color: #333;">' +
                  '<p>Shopping data: ' + JSON.stringify(item).slice(0, 100) + '...</p>' +
                  '</div>';
              }).join('');

              document.getElementById('knot-container').innerHTML =
                '<div style="padding: 20px;">' +
                  '<h2 style="color: #4CAF50;">🛒 Shopping Results</h2>' +
                  '<p>Shopping with ' + data.merchantName + '</p>' +
                  '<div style="max-height: 400px; overflow-y: auto;">' + cartHtml + '</div>' +
                '</div>';
            }
          </script>
        </body>
        </html>
      `;

      res.send(html);
    });

    // API endpoint to get user transactions
    app.get('/api/transactions', async (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      try {
        // Look up transactions for this user
        const transactionData = this.userTransactions.get(userId);

        if (!transactionData) {
          res.json({
            transactions: [],
            merchantName: null,
            syncedAt: null
          });
          return;
        }

        res.json({
          transactions: transactionData.transactions,
          merchantName: transactionData.merchantName,
          merchantId: transactionData.merchantId,
          syncedAt: transactionData.syncedAt
        });

      } catch (error) {
        this.logger.error('Error retrieving transactions:', error);
        res.status(500).json({ error: 'Failed to retrieve transactions' });
      }
    });

    // API endpoint for dashboard analytics
    app.get('/api/analytics', async (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      try {
        const userPhotos = this.photoGalleries.get(userId) || [];
        const userTranscriptions = this.transcriptionHistory.get(userId) || [];
        const userSongs = this.songGalleries.get(userId) || [];

        // Calculate analytics
        const analytics = {
          totalPhotos: userPhotos.length,
          totalTranscriptions: userTranscriptions.length,
          totalSongs: userSongs.length,
          selectedPhotos: userPhotos.filter(p => p.selected).length,
          selectedTranscriptions: userTranscriptions.filter(t => t.selected).length,
          favoriteSongs: userSongs.filter(s => s.favorite).length,
          completedSongs: userSongs.filter(s => s.status === 'complete').length,
          activationPhrases: userTranscriptions.filter(t => t.isActivationPhrase).length,
          recentActivity: this.getRecentActivityForUser(userId),
          photosWithCaptions: userPhotos.filter(p => p.caption && p.captionGenerated).length,
          streamingSongs: userSongs.filter(s => s.status === 'streaming').length,
          queuedSongs: userSongs.filter(s => s.status === 'submitted' || s.status === 'queued').length
        };

        res.json(analytics);
      } catch (error) {
        this.logger.error('Error getting analytics:', error);
        res.status(500).json({ error: 'Failed to get analytics' });
      }
    });

    // API endpoint for dashboard recent activity
    app.get('/api/recent-activity', async (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      try {
        const recentActivity = this.getRecentActivityForUser(userId);
        res.json({ activities: recentActivity });
      } catch (error) {
        this.logger.error('Error getting recent activity:', error);
        res.status(500).json({ error: 'Failed to get recent activity' });
      }
    });

    // API endpoint for email management (placeholder for integration)
    app.get('/api/emails', async (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      try {
        if (!gmailService.isUserAuthorized(userId)) {
          res.json({
            emails: [],
            unreadCount: 0,
            lastSync: new Date().toISOString(),
            authRequired: true,
            authUrl: googleCalendarService.generateAuthUrl(userId)
          });
          return;
        }

        // Get recent emails from Gmail API
        const emails = await gmailService.getRecentEmails(userId, 10);
        const unreadCount = await gmailService.getUnreadCount(userId);

        res.json({
          emails: emails.map(email => ({
            id: email.id,
            subject: email.subject,
            from: email.from,
            snippet: email.snippet,
            date: email.date,
            isRead: email.isRead
          })),
          unreadCount: unreadCount,
          lastSync: new Date().toISOString(),
          authRequired: false
        });
      } catch (error) {
        this.logger.error('Error getting emails:', error);
        res.status(500).json({ error: 'Failed to get emails' });
      }
    });

    // API endpoint for calendar events (integrates with Google Calendar)
    app.get('/api/calendar-events', async (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      try {
        let events: CalendarEvent[] = [];

        if (googleCalendarService.isConfigured() && googleCalendarService.isUserAuthorized(userId)) {
          // Get real Google Calendar events
          const { startDate, endDate, days } = req.query;

          if (startDate && endDate) {
            events = await googleCalendarService.getEvents(userId, new Date(startDate), new Date(endDate));
          } else if (days) {
            events = await googleCalendarService.getUpcomingEvents(userId, parseInt(days));
          } else {
            // Default to today's events
            events = await googleCalendarService.getTodaysEvents(userId);
          }
        } else {
          // Return mock data if not configured or authorized
          this.logger.warn(`Calendar events requested but not configured/authorized for user ${userId}`);
          events = [
            {
              id: 'mock-event1',
              summary: 'Team Meeting (Demo)',
              start: { 
                dateTime: new Date().toISOString(),
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone 
              },
              end: { 
                dateTime: new Date(Date.now() + 3600000).toISOString(),
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
              },
              description: 'Demo event - Connect Google Calendar to see real events',
              location: 'Conference Room A',
              htmlLink: '#',
              created: new Date().toISOString(),
              updated: new Date().toISOString(),
              status: 'confirmed'
            }
          ];
        }

        const formattedEvents = events.map(event => ({
          id: event.id,
          title: event.summary,
          start: event.start.dateTime,
          end: event.end.dateTime,
          description: event.description,
          location: event.location,
          htmlLink: event.htmlLink,
          status: event.status,
          attendees: event.attendees
        }));

        res.json({
          events: formattedEvents,
          isConnected: googleCalendarService.isUserAuthorized(userId),
          authUrl: googleCalendarService.generateAuthUrl(userId)
        });
      } catch (error) {
        this.logger.error('Error getting calendar events:', error);
        res.status(500).json({ error: 'Failed to get calendar events' });
      }
    });

    // Google OAuth authentication routes
    app.get('/auth/google', async (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const authUrl = googleCalendarService.generateAuthUrl(userId);
      if (authUrl) {
        res.redirect(authUrl);
      } else {
        res.status(500).json({ error: 'Google Calendar not configured' });
      }
    });

    // Public Google OAuth authentication route (doesn't require prior auth)
    app.get('/auth/google/start', async (req: any, res: any) => {
      // Get userId from query parameter or use email as default
      const userId = req.query.userId || 'ryanrong24@gmail.com';
      
      this.logger.info(`[OAuth Start Debug] Starting Google auth for user: ${userId}`);
      
      if (!googleCalendarService.isConfigured()) {
        this.logger.error('[OAuth Start Debug] Google Calendar not configured');
        res.status(500).json({ error: 'Google Calendar not configured' });
        return;
      }

      const authUrl = googleCalendarService.generateAuthUrl(userId);
      if (authUrl) {
        this.logger.info(`[OAuth Start Debug] Generated auth URL for user ${userId}`);
        this.logger.info(`[OAuth Start Debug] Redirecting to: ${authUrl.substring(0, 100)}...`);
        res.redirect(authUrl);
      } else {
        this.logger.error('[OAuth Start Debug] Failed to generate auth URL');
        res.status(500).json({ error: 'Failed to generate authentication URL' });
      }
    });

    app.get('/auth/google/callback', async (req: any, res: any) => {
      const { code, state: userId } = req.query;
      
      this.logger.info(`[OAuth Callback Debug] Received callback - code: ${code ? 'present' : 'missing'}, userId: ${userId || 'missing'}`);
      this.logger.info(`[OAuth Callback Debug] Full query params:`, JSON.stringify(req.query, null, 2));

      if (!code || !userId) {
        this.logger.error(`[OAuth Callback Debug] Missing required parameters - code: ${!!code}, userId: ${!!userId}`);
        res.status(400).send('Missing authorization code or user ID');
        return;
      }

      try {
        this.logger.info(`[OAuth Callback Debug] Attempting to handle auth callback for user: ${userId}`);
        const success = await googleCalendarService.handleAuthCallback(code, userId);

        if (success) {
          // Redirect back to dashboard with success message
          res.redirect('/dashboard?calendar_auth=success');
        } else {
          res.redirect('/dashboard?calendar_auth=error');
        }
      } catch (error) {
        this.logger.error('Google OAuth callback error:', error);
        res.redirect('/dashboard?calendar_auth=error');
      }
    });

    // API endpoint to disconnect Google Calendar
    app.post('/api/disconnect-google-calendar', async (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      try {
        await googleCalendarService.removeUserAuth(userId);
        res.json({ success: true, message: 'Google Calendar disconnected' });
      } catch (error) {
        this.logger.error('Error disconnecting Google Calendar:', error);
        res.status(500).json({ error: 'Failed to disconnect Google Calendar' });
      }
    });

    // API endpoint to get Google Calendar connection status
    app.get('/api/google-calendar-status', async (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      try {
        const isConnected = googleCalendarService.isUserAuthorized(userId);
        const authUrl = googleCalendarService.generateAuthUrl(userId);
        const tokenInfo = googleCalendarService.getUserTokenInfo(userId);

        res.json({
          isConfigured: googleCalendarService.isConfigured(),
          isConnected,
          authUrl,
          tokenInfo: tokenInfo ? {
            hasAccessToken: tokenInfo.hasAccessToken,
            hasRefreshToken: tokenInfo.hasRefreshToken,
            expiryDate: tokenInfo.expiryDate,
            scope: tokenInfo.scope
          } : null
        });
      } catch (error) {
        this.logger.error('Error getting Google Calendar status:', error);
        res.status(500).json({ error: 'Failed to get calendar status' });
      }
    });

    // Knot webhook endpoint for receiving transaction events
    app.post('/webhooks/knot', async (req: any, res: any) => {
      try {
        const webhook = req.body;
        this.logger.info('Received Knot webhook:', JSON.stringify(webhook, null, 2));

        switch (webhook.event) {
          case 'AUTHENTICATED':
            this.logger.info(`User ${webhook.external_user_id} authenticated to merchant ${webhook.merchant.name} (ID: ${webhook.merchant.id})`);
            // Store authentication success - don't auto-add products
            if (!this.userTransactions) {
              this.userTransactions = new Map();
            }
            this.userTransactions.set(webhook.external_user_id, {
              merchantId: webhook.merchant.id,
              merchantName: webhook.merchant.name,
              transactions: [{
                type: 'authenticated',
                merchant: webhook.merchant,
                timestamp: new Date()
              }],
              syncedAt: new Date()
            });
            break;

          case 'SYNC_CART_SUCCEEDED':
            this.logger.info(`Cart sync succeeded for user ${webhook.external_user_id}`);
            await this.handleCartSuccess(webhook.external_user_id, webhook.data);
            break;

          case 'CHECKOUT_SUCCEEDED':
            this.logger.info(`Checkout succeeded for user ${webhook.external_user_id}`);
            await this.handleCheckoutSuccess(webhook.external_user_id, webhook.data);
            break;

          case 'SYNC_CART_FAILED':
            this.logger.info(`Cart sync failed for user ${webhook.external_user_id}`);
            break;

          case 'CHECKOUT_FAILED':
            this.logger.info(`Checkout failed for user ${webhook.external_user_id}`);
            break;

          case 'ACCOUNT_LOGIN_REQUIRED':
            this.logger.info(`Account login required for user ${webhook.external_user_id}`);
            break;

          default:
            this.logger.info(`Unknown webhook event: ${webhook.event}`);
        }

        res.status(200).json({ received: true });
      } catch (error) {
        this.logger.error('Error processing Knot webhook:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
      }
    });
  }
}



// Start the server
// DEV CONSOLE URL: https://console.mentra.glass/
// Get your webhook URL from ngrok (or whatever public URL you have)
const app = new ExampleMentraOSApp();

app.start().catch(console.error);