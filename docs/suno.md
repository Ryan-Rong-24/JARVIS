# Suno HackMIT 2025 API Docs

Welcome to the Suno API for HackMIT 2025! This API allows you to programmatically generate high-quality music and covers using Suno's AI music models.

## Getting Started

### 1. Get Your API Key

One of your team members should have already received an email with your unique API token (by 11:15 AM on Saturday). If not, then please visit the **Suno booth at HackMIT** to receive your API token. This token is required for all API requests and is specifically configured for HackMIT participants.

### 1.2. 🎁 Free Suno Pro + Credits

**Exclusive HackMIT offer!** Redeem this code for **free Suno Pro for 1 month** (includes **2,500 credits**): `HACKMITSTUDENT1PRO`

Perfect for experimenting with Suno's full set of features during and after the hackathon!

### 1.5. Try the Starter App

Check out our **starter application** that demonstrates the song generation and polling workflow: https://github.com/suno-ai/hackmit-starter-app

This example app shows you exactly how to generate music, poll for results, and stream audio before generation is complete!

### 2. Base URL

All API endpoints are accessible at:

```
https://studio-api.prod.suno.com/api/v2/external/hackmit/
```

### 3. Authentication

All requests must include your API token in the Authorization header:

```
Authorization: Bearer YOUR_HACKMIT_TOKEN
```

Replace `YOUR_HACKMIT_TOKEN` with your API token (emailed to one of your team members, or provided at the Suno booth).

## Rate Limits

- **Music generation**: 60 songs per minute per user
- **Clip fetching**: 100 requests per minute per user

## Audio Format & Streaming

All generated audio is provided in **MP3 format** with high-quality encoding suitable for streaming and download.

### 🎵 Real-Time Streaming

**One of Suno's coolest features!** You don't have to wait for generation to complete:

1. **Submit generation** → Get back a clip ID
2. **Poll for status** (~30-60 seconds) → When `status` becomes `"streaming"`, `audio_url` is available
3. **Start playing immediately** → The song streams in real-time as it generates
4. **Keep listening** → Audio continues seamlessly until the full song is complete (~1-2 minutes total)

Perfect for quick feedback and testing during your hackathon demo! 🚀

## Suno API Features for HackMIT

### Features Available

- ✅ Music generation (simple and custom mode)
- ✅ Cover generation (remake songs in different styles)
- ✅ Real-time generation status updates

---

## API Endpoints

### 1. Generate Music

Generate new music using either simple prompts or custom lyrics.

**Endpoint:**

```
POST /generate
```

**Request Body:**

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `topic` | string | No | A description of the song for simple mode. Max 2500 characters. |
| `tags` | string | No | Musical style (genres, instruments, moods). Max 100 characters. |
| `prompt` | string | No | Custom lyrics for the song. Use for custom mode. |
| `make_instrumental` | boolean | No | Generate instrumental version without vocals. Default: false |
| `cover_clip_id` | string | No | UUID of existing clip to create a cover version |

### Simple Mode Example

Let Suno generate lyrics and style based on your description:

```json
{
  "topic": "An upbeat pop song about coding at HackMIT",
  "tags": "pop, electronic, upbeat, energetic"
}
```

### Custom Mode Example

Provide your own lyrics and style:

```json
{
  "prompt": "[Verse]\\nCoding through the night\\nAt HackMIT we unite\\nBuilding dreams in code\\n\\n[Chorus]\\nHack the world, make it bright\\nInnovation takes its flight",
  "tags": "pop rock, guitar, drums, inspiring"
}
```

### Cover Generation Example

Create a new version of an existing song:

```json
{
  "cover_clip_id": "abc-123-def-456",
  "tags": "jazz, piano, saxophone, smooth"
}
```

**Response:**
Returns a single clip object:

```json
{
  "id": "31f7d8f7-f29a-4931-9695-809236ec31c0",
  "request_id": "53884401-952e-42ca-b878-8ff519e77702",
  "created_at": "2025-09-12T22:40:23.627Z",
  "status": "submitted",
  "title": "",
  "metadata": {
    "tags": "pop, upbeat",
    "prompt": "",
    "gpt_description_prompt": "A test song for HackMIT song generation\\n\\npop, upbeat",
    "type": "gen"
  }
}
```

💡 **Note:** Use the `id` to poll the `/clips` endpoint for streaming audio URL and generation progress.

### 2. Get Clips (Check Status & Get Audio URL)

Retrieve the status and results of your generated clips. **This is how you get the audio URL once generation is complete.**

**Endpoint:**

```
GET /clips
```

**Query Parameters:**

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `ids` | string | Yes | Comma-separated list of clip UUIDs (max 10) |

**Example Request:**

```
GET /clips?ids=abc-123,def-456,ghi-789
```

**Response (During Generation - Streaming Available!):**
Once status becomes `"streaming"`, the `audio_url` becomes available for **real-time streaming**:

```json
[
  {
    "id": "31f7d8f7-f29a-4931-9695-809236ec31c0",
    "request_id": "53884401-952e-42ca-b878-8ff519e77702",
    "status": "streaming",
    "title": "Test Hack",
    "audio_url": "<https://audiopipe.suno.ai/?item_id=31f7d8f7-f29a-4931-9695-809236ec31c0>",
    "image_url": "<https://cdn1.suno.ai/image_31f7d8f7-f29a-4931-9695-809236ec31c0.jpeg>",
    "created_at": "2025-09-12T22:40:23.627Z",
    "metadata": {
      "tags": "song generation pop upbeat. male vocals, pop",
      "prompt": "[Verse]\\nI wish I had a home\\nMade of starlight..."
    }
  
]
```

🎵 **Real-time Streaming**: You can start playing the audio immediately when `status` is `"streaming"`! The song will continue to generate and stream in real-time.

**Response (Generation Complete):**
Once `status` is `"complete"`, the `audio_url` will contain the downloadable MP3 link:

```json
[
  {
    "id": "31f7d8f7-f29a-4931-9695-809236ec31c0",
    "request_id": "53884401-952e-42ca-b878-8ff519e77702",
    "status": "complete",
    "title": "Test Hack",
    "audio_url": "<https://cdn1.suno.ai/31f7d8f7-f29a-4931-9695-809236ec31c0.mp3>",
    "image_url": "<https://cdn1.suno.ai/image_31f7d8f7-f29a-4931-9695-809236ec31c0.jpeg>",
    "image_large_url": "<https://cdn1.suno.ai/image_large_31f7d8f7-f29a-4931-9695-809236ec31c0.jpeg>",
    "created_at": "2025-09-12T22:40:23.627Z",
    "metadata": {
      "duration": 173.6,
      "tags": "song generation pop upbeat. male vocals, pop",
      "prompt": "[Verse]\\nI wish I had a home\\nMade of starlight...",
      "gpt_description_prompt": "A test song for HackMIT music generation\\n\\npop, upbeat",
      "type": "gen"
    }
  }
]
```

**🎵 Getting Your Audio**: Response is an **array** of clip objects.

- **During `"streaming"`**: `audio_url` provides real-time streaming (live generation)
- **During `"complete"`**: `audio_url` provides final downloadable MP3 via CDN
- **Bonus**: `title`, `image_url` (cover art for the song), and `metadata` are populated during streaming too!

---

## 🔍 Understanding Response Formats

**Generate Endpoint (`/generate`):**

- Returns: **Single clip object** `{ id, request_id, status, created_at, metadata, ... }`
- Purpose: Starts a new generation
- Contains: Basic info + metadata - use the clip ID to poll for audio URL

**Clips Endpoint (`/clips?ids=...`):**

- Returns: **Array of clip objects** `[{ id, status, audio_url, ... }, ...]`
- Purpose: Check status of existing clips
- Audio URL: Available for **streaming** when `status` is `"streaming"`, final MP3 when `"complete"`
- Access clips: Use `response[0]` to get the first clip

---

## Status Values

| Status | Description |
| --- | --- |
| `submitted` | Request received and queued |
| `queued` | Waiting for processing |
| `streaming` | Generation in progress - **audio_url** available for real-time streaming |
| `complete` | Generation finished - **audio_url** has final downloadable MP3 |
| `error` | Generation failed (check error_type and error_message) |

---

## Complete Workflow Example

Here's a complete example using cURL to generate a song and poll for results:

### Step 1: Generate a Song

```bash
curl '<https://studio-api.prod.suno.com/api/v2/external/hackmit/generate>' \\
  -H 'Authorization: Bearer YOUR_HACKMIT_TOKEN' \\
  -H 'Content-Type: application/json' \\
  --data-raw '{
    "topic": "A rock anthem about hackathon innovation",
    "tags": "rock, electric guitar, powerful drums, anthem"
  }'
```

**Response:**

```json
{
  "id": "e4ed728b-7033-4d7c-87c2-a0b635791c53",
  "request_id": "a9e6129f-2117-457c-933e-e2c710d2906b",
  "status": "submitted",
  "title": "",
  "created_at": "2025-09-12T18:30:00.000Z",
  "metadata": {
    "tags": "rock, electric guitar, powerful drums, anthem",
    "gpt_description_prompt": "A rock anthem about hackathon innovation",
    "type": "gen"
  }
}
```

### Step 2: Poll for Results

**Wait 5-10 seconds**, then check the status. Keep polling until `status` becomes `"complete"`:

```bash
curl '<https://studio-api.prod.suno.com/api/v2/external/hackmit/clips?ids=e4ed728b-7033-4d7c-87c2-a0b635791c53>' \\
  -H 'Authorization: Bearer YOUR_HACKMIT_TOKEN'
```

**Response (when polling shows streaming or complete):**

```json
[
  {
    "id": "e4ed728b-7033-4d7c-87c2-a0b635791c53",
    "request_id": "a9e6129f-2117-457c-933e-e2c710d2906b",
    "status": "complete",
    "title": "Innovation Anthem",
    "audio_url": "<https://cdn1.suno.ai/e4ed728b-7033-4d7c-87c2-a0b635791c53.mp3>",
    "image_url": "<https://cdn1.suno.ai/image_e4ed728b-7033-4d7c-87c2-a0b635791c53.jpeg>",
    "created_at": "2025-09-12T18:30:00.000Z",
    "metadata": {
      "duration": 180.5,
      "tags": "rock, electric guitar, powerful drums, anthem",
      "prompt": "[Verse]\\nBuild the future with our code...",
      "gpt_description_prompt": "A rock anthem about hackathon innovation",
      "type": "gen"
    }
  }
]
```

🎵 **Start Listening**: When `status` is `"streaming"`, the `audio_url` will be `https://audiopipe.suno.ai/?item_id=...` for real-time streaming. When `"complete"`, it becomes the final CDN MP3 URL!

### Step 3: Stream or Download

**Stream immediately** when `status` is `"streaming"`, or **download the final MP3** when `status` is `"complete"`:

```bash
curl '<https://cdn1.suno.ai/e4ed728b-7033-4d7c-87c2-a0b635791c53.mp3>' \\
  --output my_hackmit_song.mp3
```

**💡 Pro Tip**: The `audio_url` works in web players and mobile apps! During `"streaming"` it provides real-time playback, and during `"complete"` it's the final downloadable MP3.

---

## Error Handling

### Common Error Responses

**401 Unauthorized:**

```json
{
  "detail": "Authentication required."
}
```

**403 Forbidden:**

```json
{
  "detail": "Access denied. Not a HackMIT participant."
}
```

**429 Rate Limited (Generation):**

```json
{
  "detail": "HackMIT generation rate limit exceeded. Please wait before generating another song."
}
```

**400 Bad Request:**

```json
{
  "detail": "Topic too long. Please keep it under 2500 characters."
}
```

### Generation Errors

If a clip fails to generate, check the `metadata.error_type` and `metadata.error_message` fields in the response.

---

## Best Practices

1. **Polling**: Check clip status every 5-10 seconds - streaming starts in ~30-60 seconds, complete in ~1-2 minutes!
2. **Rate Limiting**: You can generate up to 60 songs per minute
3. **Error Handling**: Always check status codes and error messages
4. **Topic Length**: Keep topics under 2500 characters for best results
5. **Tags**: Use descriptive genres, instruments, and moods rather than artist names

---

## Need Help?

Visit the **Suno booth at HackMIT** for:

- API key troubleshooting
- Live demo and examples
- Technical support

### **Happy hacking!** 🎵