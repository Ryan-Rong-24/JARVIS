# Enhanced MentraOS Smart Assistant (HackMIT 2025)

An advanced MentraOS application that combines camera functionality, voice transcription, AI photo captioning, music generation, Gmail integration, and Google Calendar management. Experience the future of smart glasses with comprehensive voice-controlled productivity features.

## Features

- 📷 **Voice-activated photo capture** with Claude AI captioning
- 🎵 **AI music generation** using Suno API with contextual prompts
- 📧 **Gmail integration** with real-time inbox checking via voice
- 📅 **Google Calendar management** with voice-controlled event creation
- 🛒 **Voice shopping** through Knot transaction linking
- 🎙️ **Smart voice recognition** with multiple activation phrases
- 📱 **Mobile-friendly dashboard** with glassmorphism design
- 🔊 **Audio feedback** for all interactions through smart glasses

## Quick Start

### 1. Install MentraOS on your phone
MentraOS install links: [mentra.glass/install](https://mentra.glass/install)

### 2. Set up ngrok (Easiest way to get started)
```bash
brew install ngrok
# Make an ngrok account and create a static URL at https://dashboard.ngrok.com/
```

### 3. Register your App with MentraOS
1. Navigate to [console.mentra.glass](https://console.mentra.glass/)
2. Click "Sign In" and log in with your MentraOS account
3. Click "Create App"
4. Set a unique package name like `com.yourName.yourAppName`
5. For "Public URL", enter your ngrok static URL
6. **Important**: Add the **microphone permission** in the edit app screen

### 4. Install and Run
```bash
# Install Bun runtime
curl -fsSL https://bun.sh/install | bash

# Clone and setup
git clone https://github.com/your-repo/RAN-Mentra-Photo
cd RAN-Mentra-Photo
bun install

# Configure environment variables
cp .env.example .env
# Edit .env with your configuration (see Environment Setup below)

# Start development server
bun run dev

# Expose to internet with ngrok
ngrok http --url=<YOUR_NGROK_URL_HERE> 3000
```

## Environment Setup

Create a `.env` file with the following variables:

```env
# Required
PORT=3000
PACKAGE_NAME=com.yourName.yourAppName
MENTRAOS_API_KEY=your_api_key_from_console

# Optional Features
SUNO_API_KEY=your_suno_api_key                    # For AI music generation
ANTHROPIC_API_KEY=your_claude_api_key             # For photo captioning
KNOT_CLIENT_ID=your_knot_client_id               # For voice shopping
KNOT_SECRET=your_knot_secret                     # For voice shopping
KNOT_ENVIRONMENT=production                      # or development

# Google Integration (Gmail + Calendar)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-ngrok-url.ngrok-free.app/auth/google/callback
```

## Google OAuth Setup

To enable Gmail and Google Calendar integration:

### 1. Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable APIs:
   - Go to "APIs & Services" > "Library"
   - Search for and enable "Gmail API"
   - Search for and enable "Google Calendar API"

### 2. Create OAuth2 Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Configure consent screen if prompted
4. Choose "Web application" as application type
5. Add authorized redirect URIs:
   - Development: `http://localhost:3000/auth/google/callback`
   - Production: `https://your-domain.com/auth/google/callback`
   - Ngrok: `https://your-ngrok-url.ngrok-free.app/auth/google/callback`

### 3. OAuth Scopes
The application requests these permissions:
- `https://www.googleapis.com/auth/calendar` - Calendar read/write
- `https://www.googleapis.com/auth/calendar.events` - Event management
- `https://www.googleapis.com/auth/gmail.readonly` - Read Gmail messages
- `https://www.googleapis.com/auth/gmail.send` - Send emails via Gmail
- `https://www.googleapis.com/auth/gmail.modify` - Mark emails as read

## Voice Commands

### Photo Capture
- "take photo" / "take picture"
- "capture photo" / "snap photo"
- "camera" / "photo"

### Email Management
- "check my email" / "check inbox"
- "read my messages" / "email"
- "compose email" / "send email"

### Calendar Management
- "schedule meeting" / "create event"
- "add to calendar" / "book appointment"
- "check calendar" / "meeting"

### Shopping
- "buy" / "purchase" / "order"
- "shop for" / "find" / "get me"
- "shopping" / "i want" / "i need"

## API Endpoints

### Core Interface
- `GET /webview` - Primary mobile dashboard (requires MentraOS auth)
- `GET /dashboard` - Alias for webview
- `GET /legacy` - Original multi-tab interface

### Photo Management
- `GET /api/gallery` - Get user's photo collection
- `GET /api/photo/:requestId` - Serve photo data
- `POST /api/gallery/select` - Toggle photo selection

### Gmail Integration
- `GET /api/emails` - Get Gmail messages and unread count
  ```json
  {
    "emails": [{"id", "subject", "from", "snippet", "date", "isRead"}],
    "unreadCount": 5,
    "authRequired": false,
    "lastSync": "2025-01-01T00:00:00.000Z"
  }
  ```

### Google Calendar Integration
- `GET /api/calendar-events` - Get calendar events
  ```json
  {
    "events": [{"id", "summary", "start", "end", "description", "location"}],
    "authRequired": false
  }
  ```

### Google OAuth Flow
- `GET /auth/google` - Start OAuth flow
- `GET /auth/google/callback` - Handle OAuth callback
- `GET /api/google-calendar-status` - Check connection status

### Music Generation (Suno Integration)
- `POST /api/generate-song` - Create AI music from photos/transcriptions
- `GET /api/songs` - Get user's song gallery
- `GET /api/song-status/:clipId` - Check generation status

### Analytics & Data
- `GET /api/analytics` - Dashboard analytics
- `GET /api/recent-activity` - User activity feed
- `GET /api/transcriptions` - Voice transcription history

## Architecture

### Core Components
- **ExampleMentraOSApp** (`src/index.ts`) - Main application server
- **GoogleCalendarService** (`src/services/googleCalendarService.ts`) - Calendar API integration
- **GmailService** (`src/services/gmailService.ts`) - Gmail API integration
- **Dashboard Interface** (`views/dashboard-interface.ejs`) - Mobile-optimized UI

### Data Storage
In-memory storage with automatic cleanup:
- 50 photos per user (with AI captions)
- 100 transcription entries per user
- 25 generated songs per user
- OAuth tokens (with automatic refresh)

### Voice Processing Flow
1. MentraOS captures voice through glasses microphone
2. Transcription processed by MentraOS SDK
3. Activation phrases detected locally
4. Appropriate handler called (photo, email, calendar, shopping)
5. Action performed with audio/visual feedback

## Privacy & Security

- **Local Processing**: Email and calendar requests processed locally, no external AI APIs
- **Direct Google Integration**: Data flows directly between user and Google services
- **OAuth2 Security**: Industry-standard authentication with token refresh
- **Memory Storage**: No persistent storage of sensitive data
- **MentraOS Authentication**: All endpoints require valid MentraOS session

## Development Commands

```bash
bun run dev     # Development server with hot reload
bun run start   # Production server
bun install     # Install dependencies
```

## Deployment

The project includes Porter deployment configuration (`porter.yaml`) for containerized deployment:
- Docker build using `./docker/Dockerfile`
- Web service on port 80
- 1 CPU core, 1GB RAM allocation

## Troubleshooting

### Gmail/Calendar Not Working
1. Verify Google Cloud APIs are enabled
2. Check OAuth redirect URI matches your ngrok URL
3. Ensure `.env` has correct Google credentials
4. Complete OAuth flow via `/auth/google`

### Voice Commands Not Recognized
1. Verify microphone permission in MentraOS Console
2. Check activation phrases match exactly
3. Ensure MentraOS app is properly connected

### Photo Capture Issues
1. Verify camera permission in MentraOS Console
2. Check ngrok tunnel is active and accessible
3. Ensure package name matches MentraOS Console

## Next Steps

- Check out [docs.mentra.glass](https://docs.mentra.glass/camera) for MentraOS documentation
- Explore the mobile dashboard at `/webview` after setup
- Try voice commands: "take photo", "check my email", "schedule meeting"
- Customize activation phrases in `src/index.ts`

## Contributing

This project demonstrates advanced MentraOS integration patterns including:
- Multi-service OAuth2 token sharing
- Real-time voice command processing
- AI-powered content generation
- Mobile-optimized smart glasses interfaces

Built for HackMIT 2025 showcasing the future of ambient computing through smart glasses.