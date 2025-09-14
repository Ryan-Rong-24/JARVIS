# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an enhanced MentraOS application that combines camera functionality, voice transcription, AI photo captioning, AI music generation, and voice-controlled shopping. The app demonstrates how to:
- Take photos from smart glasses with voice activation
- Generate automatic captions for photos using Claude Vision API
- Maintain photo galleries and transcription history
- Generate contextual AI music using Suno API with photo captions and transcriptions
- Enable voice-controlled shopping through Knot's transaction_link integration
- Provide a rich web interface for content selection, music creation, and shopping
- **NEW**: Mobile-friendly dashboard interface with integrated calendar, email, and analytics

## Development Commands

- **Start the app in development mode**: `bun run dev` (includes hot reloading)
- **Start the app for production**: `bun run start`
- **Install dependencies**: `bun install`

Note: This project uses Bun as the runtime and package manager, not npm or Node.js directly.

## Environment Setup

The application requires a `.env` file with these variables:
- `PORT`: Server port (default 3000)
- `PACKAGE_NAME`: Unique app identifier matching MentraOS Developer Console
- `MENTRAOS_API_KEY`: API key from MentraOS Developer Console
- `SUNO_API_KEY`: API key from Suno for music generation (optional)
- `ANTHROPIC_API_KEY`: Claude API key for photo captioning (optional)
- `KNOT_CLIENT_ID`: Client ID from Knot for shopping integration (optional)
- `KNOT_SECRET`: Secret key from Knot for shopping integration (optional)
- `KNOT_ENVIRONMENT`: Knot environment (development or production, default: development)
- `GOOGLE_CLIENT_ID`: Google OAuth2 client ID for Gmail and calendar integration (optional)
- `GOOGLE_CLIENT_SECRET`: Google OAuth2 client secret for Gmail and calendar integration (optional)
- `GOOGLE_REDIRECT_URI`: OAuth2 redirect URI (default: http://localhost:3000/auth/google/callback)

Copy `.env.example` to `.env` and configure these values before running the app.

## Google OAuth Setup

To enable Gmail and Google Calendar integration, you need to set up Google OAuth2 credentials:

### 1. Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API and Google Calendar API:
   - Go to "APIs & Services" > "Library"
   - Search for and enable "Gmail API"
   - Search for and enable "Google Calendar API"

### 2. Create OAuth2 Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Configure the consent screen if prompted
4. Choose "Web application" as application type
5. Add authorized redirect URIs:
   - For development: `http://localhost:3000/auth/google/callback`
   - For production: `https://your-domain.com/auth/google/callback`
   - For ngrok: `https://your-ngrok-url.ngrok-free.app/auth/google/callback`

### 3. Configure Environment Variables
Copy the Client ID and Client Secret to your `.env` file:
```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

### 4. OAuth Scopes
The application requests these Google OAuth scopes:
- `https://www.googleapis.com/auth/calendar` - Read/write calendar access
- `https://www.googleapis.com/auth/calendar.events` - Calendar events management
- `https://www.googleapis.com/auth/gmail.readonly` - Read Gmail messages
- `https://www.googleapis.com/auth/gmail.send` - Send emails via Gmail
- `https://www.googleapis.com/auth/gmail.modify` - Modify Gmail messages (mark as read, etc.)

### 5. User Authorization Flow
1. Users access `/auth/google` to start OAuth flow
2. They grant permissions on Google's consent screen
3. Google redirects to `/auth/google/callback` with authorization code
4. App exchanges code for access/refresh tokens
5. Tokens are stored and shared between Gmail and Calendar services

## Architecture

### Core Components

- **ExampleMentraOSApp class** (`src/index.ts`): Enhanced application server extending `@mentra/sdk` AppServer
  - Handles MentraOS session lifecycle with photo capture and voice transcription
  - Manages photo galleries with automatic Claude Vision captioning
  - Stores transcription history per user
  - Integrates with Suno API for contextual AI music generation
  - Provides comprehensive REST API endpoints

- **Data Management**: In-memory storage system with Maps tracking:
  - `photoGalleries`: User photo collections (up to 50 photos per user)
  - `transcriptionHistory`: User speech history (up to 100 entries per user)
  - `songGalleries`: Generated song collections (up to 25 songs per user)
  - `activeGenerations`: Tracks ongoing Suno API generations
  - `isStreamingPhotos`: Streaming mode state per user
  - `nextPhotoTime`: Next photo capture time for streaming

- **Enhanced Web Interface** (`views/enhanced-interface.ejs`): Multi-tab interface featuring:
  - Photo gallery with selection capabilities
  - Transcription history with timestamps and activation indicators
  - Song gallery with playback, favorites, and management
  - Music studio for AI song generation
  - Real-time status updates and streaming audio support
  - Responsive design optimized for various screen sizes

- **NEW Dashboard Interface** (`views/dashboard-interface.ejs`): Modern mobile-first dashboard featuring:
  - Glassmorphism design with gradient backgrounds
  - Bottom navigation for mobile-friendly access
  - Integrated calendar AI with voice recording
  - Dashboard analytics and activity feed
  - Enhanced music studio with workflow progression
  - Shopping integration with voice commands
  - Real-time status updates and notifications
  - Fully responsive design optimized for mobile devices

### API Endpoints

**Core Interface:**
- `GET /webview`: **PRIMARY** Mobile-friendly dashboard with integrated components (requires MentraOS authentication)
- `GET /dashboard`: Alias for `/webview` - same mobile dashboard interface
- `GET /legacy`: Original multi-tab "Photo & Audio Studio" interface (requires MentraOS authentication)

**Photo Management:**
- `GET /api/latest-photo`: Returns metadata about the user's latest photo (backward compatibility)
  - Response: `{ requestId, timestamp, filename, mimeType, size, caption, captionGenerated }`
- `GET /api/gallery`: Returns complete photo gallery for user
  - Response: `{ photos: [{ requestId, timestamp, filename, size, mimeType, selected, caption, captionGenerated }] }`
- `GET /api/photo/:requestId`: Serves photo data by request ID
  - Returns: Binary image data with appropriate Content-Type header
- `POST /api/gallery/select`: Toggle photo selection status
  - Body: `{ requestId: string, selected: boolean }`
  - Response: `{ success: boolean, selected: boolean }`

**Transcription Management:**
- `GET /api/transcriptions`: Returns user's transcription history
  - Response: `{ transcriptions: [{ id, text, timestamp, isActivationPhrase, selected }] }`
- `POST /api/transcriptions/select`: Toggle transcription selection status
  - Body: `{ id: string, selected: boolean }`
  - Response: `{ success: boolean, selected: boolean }`

**Music Generation & Gallery:**
- `POST /api/generate-song`: Generate song using selected photos and transcriptions
  - Body: `{ customPrompt?: string, tags?: string }`
  - Response: `{ success: boolean, clipId?: string, message: string }`
- `GET /api/song-status/:clipId`: Check Suno generation status and get audio URL
  - Response: `{ status: string, audio_url?: string, video_url?: string, error?: string }`
- `GET /api/songs`: Get user's complete song gallery with metadata
  - Response: `{ songs: [{ id, clipId, title, status, audioUrl, videoUrl, timestamp, favorite, prompt, tags }] }`
- `POST /api/songs/favorite`: Toggle song favorite status
  - Body: `{ songId: string, favorite: boolean }`
  - Response: `{ success: boolean, favorite: boolean }`
- `DELETE /api/songs/:songId`: Delete a song from the gallery
  - Response: `{ success: boolean }`

**Shopping Integration:**
- `GET /shopping`: Knot SDK shopping interface (requires MentraOS authentication)
  - Query parameters: `sessionId`, `query` (the user's spoken request)
  - Returns: Knot shopping interface HTML

**Dashboard & Analytics:**
- `GET /api/analytics`: Dashboard analytics with user stats and activity metrics
  - Response: `{ totalPhotos, totalTranscriptions, totalSongs, recentActivity, storageUsed }`
- `GET /api/recent-activity`: Recent user activity feed for dashboard
  - Response: `{ activities: [{ type, description, timestamp, icon }] }`

**Gmail Integration:**
- `GET /api/emails`: Get user's Gmail messages
  - Response: `{ emails: [{ id, subject, from, snippet, date, isRead }], unreadCount, lastSync, authRequired?, authUrl? }`
- `GET /api/google-calendar-status`: Check Google OAuth connection status
  - Response: `{ connected: boolean, authUrl?: string, userEmail?: string }`

**Google Calendar Integration:**
- `GET /api/calendar-events`: Get user's calendar events
  - Query parameters: `startDate`, `endDate`, `maxResults`
  - Response: `{ events: [{ id, summary, start, end, description, location, htmlLink, status, attendees }], authRequired?, authUrl? }`
- `POST /api/create-calendar-event`: Create a new calendar event
  - Body: `{ title, description?, location?, start_time, end_time, attendees?, timeZone? }`
  - Response: `{ success: boolean, event?: CalendarEvent, error?: string }`

**Google OAuth Flow:**
- `GET /auth/google`: Initiate Google OAuth2 flow for Gmail and calendar access
  - Query parameters: `userId` (passed as state parameter)
  - Redirects to Google consent screen
- `GET /auth/google/callback`: Handle OAuth2 callback and store tokens
  - Query parameters: `code` (authorization code), `state` (userId)
  - Redirects to dashboard with success/error message
- `POST /api/disconnect-google-calendar`: Disconnect Google OAuth integration
  - Response: `{ success: boolean }`

**Voice Activation Processing:**
All voice commands are processed through the MentraOS SDK and trigger the appropriate handlers:
- Photo activation → `takePhotoForUser()`
- Shopping activation → Create Knot session and redirect to shopping interface
- Calendar activation → `handleCalendarRequest()` with local Google Calendar integration
- Email activation → `handleEmailRequest()` with local Gmail integration

### Interaction Model

**Button Controls:**
- **Short press**: Takes a single photo
- **Long press**: Toggles streaming mode (continuous photo capture)

**Voice Commands:**
- Say any activation phrase (e.g., "take photo") to capture a single photo
- Voice activation works in both normal and streaming modes

## Deployment

The project includes Porter deployment configuration (`porter.yaml`) for containerized deployment with:
- Docker build using `./docker/Dockerfile`
- Web service on port 80
- 1 CPU core, 1GB RAM allocation

## MentraOS Integration

This app integrates with MentraOS smart glasses platform:
- Uses `@mentra/sdk` for camera access, session management, and voice transcription
- Requires registration in MentraOS Developer Console
- Supports authenticated user sessions with photo capture and microphone permissions
- Designed for use with ngrok or similar tunneling for development

### Voice Activation

The app supports voice-activated functionality with these activation phrases:

**Photo Capture:**
- "take photo" / "take picture"
- "capture photo" / "capture picture"
- "snap photo" / "snap picture"
- "camera"
- "photo"

**Shopping (via Knot integration):**
- "buy"
- "purchase"
- "shop"
- "get me"
- "order"
- "find"
- "search for"
- "i want"
- "i need"
- "shopping"

**Calendar/Meetings (via dashboard integration):**
- "schedule"
- "meeting"
- "calendar"
- "appointment"
- "book"
- "plan"
- "create event"
- "add to calendar"

**Email Management (via dashboard integration):**
- "email"
- "reply"
- "send email"
- "compose"
- "check email"
- "inbox"
- "message"

**Important**: The MICROPHONE permission must be added to your app in the MentraOS Developer Console for voice activation to work.

### Voice Shopping with Knot

The app integrates with Knot's transaction_link product for voice-controlled shopping:
- Detects shopping activation phrases in user speech
- Creates new Knot sessions for each shopping request
- Launches interactive shopping interface with merchant authentication
- Supports merchant ID 45 for transaction linking
- Uses development environment with configured client credentials

When a user says a shopping phrase (e.g., "buy coffee"), the app:
1. Creates a new Knot session via API
2. Opens shopping webview with Knot SDK
3. Allows user to authenticate with merchants
4. Facilitates transaction linking for the requested product

### Voice Calendar & Email Management with TTS

The app provides integrated productivity features with local processing and full audio feedback:

**Calendar Management:**
- **Direct Google Calendar API integration** via OAuth2
- Handles natural language meeting requests locally
- Creates calendar events directly in user's Google Calendar
- Supports calendar checking and scheduling through voice commands
- **Audio feedback** via MentraOS TTS for all responses

**Email Management:**
- **Direct Gmail API integration** via OAuth2 (same OAuth flow as calendar)
- Real-time inbox checking and unread count
- Email summary with sender and subject information
- Local processing of email requests without external dependencies
- **Audio feedback** via MentraOS TTS for all responses

**Local Processing Benefits:**
- No external API dependencies for core functionality
- Direct integration with user's Google account
- Real-time access to user's actual Gmail and Calendar data
- Better privacy (data stays between user and Google)
- More reliable operation (no third-party service dependencies)

**Audio Experience Flow:**

When a user says a calendar phrase (e.g., "schedule meeting tomorrow"), the app:
1. **Immediate TTS**: "Processing your calendar request" (quick acknowledgment)
2. Processes natural language locally to extract meeting details
3. **Direct Google Calendar API**: Creates event in user's actual Google Calendar
4. **TTS Response**: Plays confirmation through glasses speakers (e.g., "Created meeting for tomorrow at 2 PM")
5. **Action TTS**: Audio confirmation for specific actions (e.g., "Meeting added to your calendar")
6. Shows visual confirmation on glasses display

When a user says an email phrase (e.g., "check my email"), the app:
1. **Immediate TTS**: "Processing your email request" (quick acknowledgment)
2. **Direct Gmail API**: Fetches real-time email data from user's Gmail account
3. Processes email context locally (unread count, recent senders, subjects)
4. **TTS Response**: Plays email summary through glasses speakers (e.g., "You have 3 unread emails. Latest from John: Project Update")
5. **Action TTS**: Audio confirmation for navigation requests
6. Shows email summary on glasses display

**TTS Configuration:**
- **Calendar responses**: Stability 0.7, Speed 0.9 (clear and professional)
- **Email responses**: Stability 0.6, Speed 0.85 (slightly more expressive)
- **Action confirmations**: Stability 0.8, Speed 0.9 (consistent and reliable)
- **Error messages**: Stability 0.8, Speed 0.95 (clear error communication)
- All TTS uses MentraOS audio system with optimized voice settings for smart glasses

## Suno Music Generation App

This repository also contains a separate Suno AI music generation web application in the `suno-hackmit-starter-app/` directory, designed for HackMIT 2025.

### Suno App Overview

A Next.js web application that integrates with Suno's AI music generation API to create songs from text descriptions.

### Suno App Development Commands

- **Development server**: `yarn dev` (runs on localhost:3000)
- **Build for production**: `yarn build`
- **Start production server**: `yarn start`
- **Install dependencies**: `yarn install`
- **Lint code**: `yarn lint`

### Suno App Environment Setup

Requires a `.env.local` file with:
- `SUNO_API_KEY`: API key from Suno HackMIT program

### Suno App Architecture

**Core Components:**

- **SunoService class** (`lib/suno-service.ts`): Service layer for API interactions
  - `generateSong()`: Initiates song generation
  - `checkStatus()`: Polls for generation progress
  - `pollForCompletion()`: Automated polling with retry logic
  - `generateAndWaitForCompletion()`: End-to-end generation workflow

- **API Routes** (`app/api/`):
  - `/api/generate-music`: Starts song generation via Suno HackMIT API
  - `/api/check-status`: Checks generation status and retrieves audio URLs

- **Frontend** (`app/page.tsx`): React interface with form inputs and audio playback

### Suno API Integration

**Base URL**: `https://studio-api.prod.suno.com/api/v2/external/hackmit/`

**Key Features:**
- Real-time streaming during generation (status: "streaming")
- Final MP3 download when complete (status: "complete")
- Support for both simple prompts and custom lyrics
- Automatic polling every 5 seconds until completion
- Rate limiting: 60 songs/minute per user

**Generation Workflow:**
1. Submit generation request → Get clip ID
2. Poll status every 5 seconds → Audio available when "streaming"
3. Continue until "complete" → Final MP3 ready for download

### Suno App Technical Stack

- **Framework**: Next.js 15.5.2 with React 19
- **UI**: Radix UI components with Tailwind CSS
- **Forms**: React Hook Form with Zod validation
- **Audio**: Built-in HTML5 audio controls
- **Deployment**: Ready for Vercel deployment

## Development Notes

- All data is stored in memory only - consider implementing persistent storage for production use
- Storage limits: 50 photos, 100 transcriptions, 25 songs per user (automatic cleanup)
- The streaming interval is set to check every 1 second with 30-second fallback timeouts
- All operations are user-scoped and require MentraOS authentication
- Voice transcription only processes final speech results, ignoring interim transcriptions
- Multiple activation phrases are supported for natural voice interaction
- Photo captions are generated asynchronously using Claude Vision API (Claude 3.5 Sonnet)
- Caption generation is optional - photos work without captions if no Anthropic API key
- Suno integration uses photo captions and transcriptions to create contextual song prompts
- The webview interface includes auto-refresh every 10 seconds for real-time updates
- Song generation uses individual polling every 5 seconds per active generation
- Streaming audio is available ~30-60 seconds after generation starts
- Song gallery supports favorites, deletion, and real-time status updates
- **Google Integration**: Gmail and Calendar services use OAuth2 tokens stored in memory (shared between services)
- **Gmail Features**: Real-time email checking, unread counts, local processing of email requests
- **Calendar Features**: Direct event creation in user's Google Calendar, local natural language processing
- OAuth tokens are automatically refreshed when expired using stored refresh tokens
- Google API rate limits apply (typically very generous for personal use)
- The separate Suno starter app operates independently and uses yarn instead of bun