# Deno Live Transcription Starter

Get started with Deepgram's Live Speech-to-Text API using Deno, TypeScript, and WebSockets.

## Features

- 🦕 **Native Deno**: Built with Deno's native HTTP/WebSocket server
- 🎤 **Real-Time Transcription**: Stream audio for live transcription
- 🔄 **Bidirectional Proxy**: WebSocket connection between client and Deepgram
- 🚀 **Hot Reload**: Automatic server restart in development mode
- 📦 **Zero Config**: No build step needed for backend code
- 🔒 **Type Safe**: Full TypeScript support with strict mode

## Quick Start

### Prerequisites

- [Deno](https://deno.land/) v2.0 or higher
- [Node.js](https://nodejs.org/) v24+ (for frontend tooling)
- [pnpm](https://pnpm.io/) v10+ (managed via corepack)
- A Deepgram API key ([get one free](https://console.deepgram.com/signup))

### Installation

```bash
# Clone and initialize
git clone <repository-url>
cd deno-live-transcription
make init

# Configure environment
cp .env.example .env
# Edit .env and add your DEEPGRAM_API_KEY
```

### Development

```bash
# Start development servers (backend + frontend with hot reload)
make dev

# Open your browser to http://localhost:8080
```

### Production

```bash
# Build frontend and start production server
make build
make start
```

## Available Commands

```bash
make help              # Show all available commands
make init              # Initialize submodules and dependencies
make dev               # Start development servers
make start             # Start production server
make build             # Build frontend for production
make clean             # Remove build artifacts
make update            # Update frontend submodule
make status            # Show git and submodule status
```

## Project Structure

```
deno-live-transcription/
├── server.ts              # Main Deno server with WebSocket (TypeScript)
├── deno.json              # Deno configuration and tasks
├── deno.lock              # Dependency lock file
├── .env.example           # Environment template
├── deepgram.toml          # Project metadata
├── Makefile               # Development commands
├── frontend/              # Frontend submodule (HTML/JS)
│   ├── index.html
│   ├── src/
│   └── ...
└── README.md
```

## WebSocket API

### WS /listen

Establish a WebSocket connection for live transcription.

**Query Parameters:**
```typescript
{
  model?: string          // default: "nova-2"
  encoding?: string       // default: "linear16"
  sample_rate?: number    // default: 16000
  channels?: number       // default: 1
  punctuate?: boolean     // default: true
  interim_results?: boolean // default: true
}
```

**Client → Server (Audio Data):**
- Send binary audio data chunks
- Audio should match the encoding and sample_rate parameters

**Server → Client (Transcription Results):**
```json
{
  "type": "Results",
  "channel_index": [0, 0],
  "duration": 1.9,
  "start": 0.0,
  "is_final": true,
  "speech_final": true,
  "channel": {
    "alternatives": [{
      "transcript": "Your transcribed text here",
      "confidence": 0.99,
      "words": [...]
    }]
  }
}
```

**Error Messages:**
```json
{
  "type": "Error",
  "description": "Error message",
  "code": "ERROR_CODE"
}
```

### GET /api/metadata

Returns metadata about this starter application.

**Response:**
```json
{
  "title": "Deno Live Transcription",
  "description": "...",
  "framework": "Deno",
  ...
}
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DEEPGRAM_API_KEY` | (required) | Your Deepgram API key |
| `PORT` | 8080 | Server port |
| `HOST` | 0.0.0.0 | Server host |
| `VITE_PORT` | 8081 | Frontend dev server port |
| `NODE_ENV` | - | Set to "development" for dev mode |

### Deno Permissions

This application requires the following Deno permissions:

- `--allow-net`: HTTP server, WebSocket, and Deepgram API calls
- `--allow-read`: Read .env, deepgram.toml, and static files
- `--allow-env`: Access environment variables

These are configured in `deno.json` tasks.

## Development

### Type Checking

```bash
deno task check
```

### Cache Dependencies

```bash
deno task cache
```

### Hot Reload

The `dev` task includes `--watch` flag for automatic reload on file changes.

## Architecture

This starter demonstrates:

- **Native Deno WebSocket**: Uses `Deno.upgradeWebSocket()` for WebSocket handling
- **Bidirectional Proxy**: Streams audio to Deepgram, transcriptions to client
- **TypeScript First**: Full type safety with native TS support
- **No External Dependencies**: Pure Deno standard library for WebSockets
- **Static Serving**: Development proxy and production static files

## How It Works

1. **Client Connection**: Browser connects via WebSocket to `/listen`
2. **Deepgram Connection**: Server establishes WebSocket to Deepgram
3. **Audio Streaming**: Client sends audio → Server → Deepgram
4. **Transcription Streaming**: Deepgram sends results → Server → Client
5. **Cleanup**: Both connections close when either party disconnects

```
┌─────────┐        ┌──────────┐        ┌──────────┐
│ Browser │◄──────►│   Deno   │◄──────►│ Deepgram │
│         │        │  Server  │        │   API    │
└─────────┘        └──────────┘        └──────────┘
   audio              proxy           transcription
```

## Customization

### Adding Features

The code is organized into clear sections:

1. **Configuration** - Customize ports, models, etc.
2. **Helper Functions** - Add validation, formatting logic
3. **WebSocket Handlers** - Modify bidirectional proxy logic
4. **Frontend Serving** - Modify dev/prod serving logic

### Deepgram Features

Add more Deepgram features by modifying the URL builder:

```typescript
function buildDeepgramUrl(queryParams: URLSearchParams): string {
  const model = queryParams.get("model") || "nova-2";
  // Add more parameters:
  const language = queryParams.get("language") || "en";
  const diarize = queryParams.get("diarize") || "false";
  const smart_format = queryParams.get("smart_format") || "true";

  return `${DEEPGRAM_WS_URL}?model=${model}&language=${language}&diarize=${diarize}&smart_format=${smart_format}`;
}
```

See [Deepgram docs](https://developers.deepgram.com/docs) for all available features.

## Troubleshooting

### WebSocket connection fails

- Check that your DEEPGRAM_API_KEY is valid
- Verify your Deepgram account has API access enabled

### Vite dev server not running

Make sure frontend dependencies are installed:
```bash
cd frontend && corepack pnpm install
```

### Permission errors

Ensure you're running with the correct Deno permissions (see deno.json tasks).

### Module not found

Cache dependencies:
```bash
deno task cache
```

## Resources

- [Deepgram Documentation](https://developers.deepgram.com/docs)
- [Deno Documentation](https://docs.deno.com/)
- [Deepgram Live API Reference](https://developers.deepgram.com/reference/listen-live)
- [Deno WebSocket Guide](https://docs.deno.com/runtime/tutorials/websocket/)

## License

MIT License - see LICENSE file for details

## Support

- [Deepgram Community](https://github.com/orgs/deepgram/discussions)
- [Deepgram Support](https://deepgram.com/contact-us)
- [File an Issue](https://github.com/deepgram-starters/deno-live-transcription/issues)
