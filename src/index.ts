import { AppServer, AppSession, ViewType, AuthenticatedRequest, PhotoData } from '@mentra/sdk';
import { Request, Response } from 'express';
import * as ejs from 'ejs';
import * as path from 'path';

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

const PACKAGE_NAME = process.env.PACKAGE_NAME ?? (() => { throw new Error('PACKAGE_NAME is not set in .env file'); })();
const MENTRAOS_API_KEY = process.env.MENTRAOS_API_KEY ?? (() => { throw new Error('MENTRAOS_API_KEY is not set in .env file'); })();
const PORT = parseInt(process.env.PORT || '3000');

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
 * Enhanced Photo Taker App with gallery, transcription history, and Suno integration
 * Extends AppServer to provide comprehensive photo and audio generation capabilities
 */
class ExampleMentraOSApp extends AppServer {
  // Photo gallery: userId -> array of photos
  private photoGalleries: Map<string, StoredPhoto[]> = new Map();
  // Transcription history: userId -> array of transcriptions
  private transcriptionHistory: Map<string, TranscriptionEntry[]> = new Map();
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

      // Check if any activation phrase is detected
      const activationDetected = PHOTO_ACTIVATION_PHRASES.some(phrase =>
        spokenText.includes(phrase)
      );

      // Store transcription in history
      this.addTranscriptionToHistory(userId, data.text, activationDetected);

      if (activationDetected) {
        session.logger.info(`✨ Voice activation detected: "${spokenText}"`);

        // Show feedback to user
        session.layouts.showTextWall("📸 Taking photo...", { durationMs: 3000 });

        // Trigger photo capture
        this.takePhotoForUser(session, userId);
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
      id: `transcription-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
      selected: false
    };

    const gallery = this.photoGalleries.get(userId)!;
    gallery.push(storedPhoto);

    // Keep only the last 50 photos per user
    if (gallery.length > 50) {
      gallery.shift();
    }

    this.logger.info(`Added photo to gallery for user ${userId}, total photos: ${gallery.length}`);
  }

  /**
   * Get the latest photo for a user (for backward compatibility)
   */
  private getLatestPhoto(userId: string): StoredPhoto | undefined {
    const gallery = this.photoGalleries.get(userId);
    return gallery && gallery.length > 0 ? gallery[gallery.length - 1] : undefined;
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
          selected: photo.selected || false
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
          songPrompt += customPrompt;
        } else {
          songPrompt += 'A song inspired by captured moments and conversations. ';
        }

        if (selectedPhotos.length > 0) {
          songPrompt += `Based on ${selectedPhotos.length} memorable photo${selectedPhotos.length > 1 ? 's' : ''}. `;
        }

        if (selectedTranscriptions.length > 0) {
          const transcriptionText = selectedTranscriptions
            .map(t => t.text)
            .join(' ')
            .slice(0, 500); // Limit length
          songPrompt += `Incorporating themes from: "${transcriptionText}". `;
        }

        // Make request to Suno API (using environment variable for API key)
        const sunoApiKey = process.env.SUNO_API_KEY;
        if (!sunoApiKey) {
          res.status(500).json({ error: 'Suno API key not configured' });
          return;
        }

        const response = await fetch(
          'https://studio-api.prod.suno.com/api/v2/external/hackmit/generate',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${sunoApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              topic: songPrompt.slice(0, 2500), // Suno limit
              tags: tags || 'ambient, atmospheric, reflective',
              make_instrumental: false,
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          this.logger.error('Suno API error:', errorText);
          res.status(500).json({ error: 'Failed to generate song' });
          return;
        }

        const result = await response.json();
        this.logger.info(`Song generation started for user ${userId}, clip ID: ${result.id}`);

        res.json({
          success: true,
          clipId: result.id,
          status: result.status,
          prompt: songPrompt.slice(0, 2500),
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
          res.status(500).json({ error: 'Failed to check song status' });
          return;
        }

        const clips = await response.json();
        const clip = clips[0];

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

    // Main webview route - displays the enhanced interface
    app.get('/webview', async (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;

      if (!userId) {
        res.status(401).send(`
          <html>
            <head><title>Photo Viewer - Not Authenticated</title></head>
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
  }
}



// Start the server
// DEV CONSOLE URL: https://console.mentra.glass/
// Get your webhook URL from ngrok (or whatever public URL you have)
const app = new ExampleMentraOSApp();

app.start().catch(console.error);