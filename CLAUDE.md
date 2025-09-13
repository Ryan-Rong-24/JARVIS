# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an enhanced MentraOS application that combines camera functionality, voice transcription, and AI music generation. The app demonstrates how to:
- Take photos from smart glasses with voice activation
- Maintain photo galleries and transcription history
- Generate AI music using Suno API based on selected photos and transcriptions
- Provide a rich web interface for content selection and music creation

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

Copy `.env.example` to `.env` and configure these values before running the app.

## Architecture

### Core Components

- **ExampleMentraOSApp class** (`src/index.ts`): Enhanced application server extending `@mentra/sdk` AppServer
  - Handles MentraOS session lifecycle with photo capture and voice transcription
  - Manages photo galleries and transcription history per user
  - Integrates with Suno API for AI music generation
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

### API Endpoints

**Core Interface:**
- `GET /webview`: Enhanced multi-tab interface (requires MentraOS authentication)

**Photo Management:**
- `GET /api/latest-photo`: Returns metadata about the user's latest photo (backward compatibility)
- `GET /api/gallery`: Returns complete photo gallery for user
- `GET /api/photo/:requestId`: Serves photo data by request ID
- `POST /api/gallery/select`: Toggle photo selection status

**Transcription Management:**
- `GET /api/transcriptions`: Returns user's transcription history
- `POST /api/transcriptions/select`: Toggle transcription selection status

**Music Generation & Gallery:**
- `POST /api/generate-song`: Generate song using selected photos and transcriptions
- `GET /api/song-status/:clipId`: Check Suno generation status and get audio URL
- `GET /api/songs`: Get user's complete song gallery with metadata
- `POST /api/songs/favorite`: Toggle song favorite status
- `DELETE /api/songs/:songId`: Delete a song from the gallery

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

The app supports voice-activated photo capture with these activation phrases:
- "take photo" / "take picture"
- "capture photo" / "capture picture"
- "snap photo" / "snap picture"
- "camera"
- "photo"

**Important**: The MICROPHONE permission must be added to your app in the MentraOS Developer Console for voice activation to work.

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
- Suno integration requires a separate API key and builds prompts from selected content
- The webview interface includes auto-refresh every 10 seconds for real-time updates
- Song generation uses individual polling every 5 seconds per active generation
- Streaming audio is available ~30-60 seconds after generation starts
- Song gallery supports favorites, deletion, and real-time status updates
- The separate Suno starter app operates independently and uses yarn instead of bun