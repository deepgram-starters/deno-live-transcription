/**
 * Deno Live Transcription Starter - Backend Server
 *
 * This is a Deno HTTP/WebSocket server that provides real-time transcription
 * by proxying audio streams between the client and Deepgram's Live API.
 *
 * Key Features:
 * - WebSocket endpoint: /listen
 * - Bidirectional audio/transcription streaming
 * - Proxies to Vite dev server in development
 * - Serves static frontend in production
 * - Native TypeScript support
 * - No external web framework needed
 */

import { load } from "dotenv";
import TOML from "npm:@iarna/toml@2.2.5";

// Load environment variables
await load({ export: true });

// ============================================================================
// CONFIGURATION - Customize these values for your needs
// ============================================================================

/**
 * Default transcription model to use when none is specified
 * Options: "nova-2", "nova", "enhanced", "base"
 * See: https://developers.deepgram.com/docs/models-languages-overview
 */
const DEFAULT_MODEL = "nova-2";

/**
 * Deepgram Live Transcription WebSocket URL
 */
const DEEPGRAM_WS_URL = "wss://api.deepgram.com/v1/listen";

/**
 * Server configuration - These can be overridden via environment variables
 */
interface ServerConfig {
  port: number;
  host: string;
  vitePort: number;
  isDevelopment: boolean;
}

const config: ServerConfig = {
  port: parseInt(Deno.env.get("PORT") || "8080"),
  host: Deno.env.get("HOST") || "0.0.0.0",
  vitePort: parseInt(Deno.env.get("VITE_PORT") || "8081"),
  isDevelopment: Deno.env.get("NODE_ENV") === "development",
};

// ============================================================================
// API KEY LOADING - Load Deepgram API key from environment
// ============================================================================

/**
 * Loads the Deepgram API key from environment variables
 */
function loadApiKey(): string {
  const apiKey = Deno.env.get("DEEPGRAM_API_KEY");

  if (!apiKey) {
    console.error("\n❌ ERROR: Deepgram API key not found!\n");
    console.error("Please set your API key using one of these methods:\n");
    console.error("1. Create a .env file (recommended):");
    console.error("   DEEPGRAM_API_KEY=your_api_key_here\n");
    console.error("2. Environment variable:");
    console.error("   export DEEPGRAM_API_KEY=your_api_key_here\n");
    console.error("Get your API key at: https://console.deepgram.com\n");
    Deno.exit(1);
  }

  return apiKey;
}

const apiKey = loadApiKey();

// ============================================================================
// TYPES - TypeScript interfaces for WebSocket communication
// ============================================================================

interface ErrorMessage {
  type: "Error";
  description: string;
  code: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build Deepgram WebSocket URL with query parameters
 */
function buildDeepgramUrl(queryParams: URLSearchParams): string {
  const model = queryParams.get("model") || DEFAULT_MODEL;
  const encoding = queryParams.get("encoding") || "linear16";
  const sampleRate = queryParams.get("sample_rate") || "16000";
  const channels = queryParams.get("channels") || "1";
  const punctuate = queryParams.get("punctuate") || "true";
  const interim_results = queryParams.get("interim_results") || "true";

  return `${DEEPGRAM_WS_URL}?model=${model}&encoding=${encoding}&sample_rate=${sampleRate}&channels=${channels}&punctuate=${punctuate}&interim_results=${interim_results}`;
}

/**
 * Send error message to client WebSocket
 */
function sendError(socket: WebSocket, error: Error, code: string = "UNKNOWN_ERROR") {
  if (socket.readyState === WebSocket.OPEN) {
    const errorMsg: ErrorMessage = {
      type: "Error",
      description: error.message,
      code: code,
    };
    socket.send(JSON.stringify(errorMsg));
  }
}

// ============================================================================
// WEBSOCKET HANDLERS
// ============================================================================

/**
 * Handle live transcription WebSocket connection
 * Establishes bidirectional proxy between client and Deepgram
 */
async function handleLiveTranscription(
  clientSocket: WebSocket,
  queryParams: URLSearchParams
) {
  console.log("Client connected to /listen");

  let deepgramWs: WebSocket | null = null;

  try {
    // Build Deepgram WebSocket URL with parameters
    const deepgramUrl = buildDeepgramUrl(queryParams);
    console.log("Connecting to Deepgram:", deepgramUrl);

    // Connect to Deepgram with authorization
    deepgramWs = new WebSocket(deepgramUrl, {
      headers: {
        Authorization: `Token ${apiKey}`,
      },
    });

    // Wait for Deepgram connection to open
    await new Promise((resolve, reject) => {
      if (!deepgramWs) return reject(new Error("deepgramWs is null"));

      deepgramWs.onopen = () => {
        console.log("✓ Connected to Deepgram");
        resolve(null);
      };

      deepgramWs.onerror = (err) => {
        console.error("Deepgram connection error:", err);
        reject(new Error("Failed to connect to Deepgram"));
      };
    });

    // Forward messages from client to Deepgram (audio data)
    clientSocket.onmessage = (event) => {
      if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
        deepgramWs.send(event.data);
      }
    };

    // Forward messages from Deepgram to client (transcription results)
    deepgramWs.onmessage = (event) => {
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(event.data);
      }
    };

    // Handle client disconnect
    clientSocket.onclose = () => {
      console.log("Client disconnected");
      if (deepgramWs) {
        deepgramWs.close();
      }
    };

    // Handle client errors
    clientSocket.onerror = (err) => {
      console.error("Client WebSocket error:", err);
      if (deepgramWs) {
        deepgramWs.close();
      }
    };

    // Handle Deepgram disconnect
    deepgramWs.onclose = (event) => {
      console.log(`Deepgram connection closed: ${event.code} ${event.reason}`);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.close();
      }
    };

    // Handle Deepgram errors
    deepgramWs.onerror = (err) => {
      console.error("Deepgram WebSocket error:", err);
      sendError(clientSocket, new Error("Deepgram connection error"), "DEEPGRAM_ERROR");
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.close();
      }
    };

  } catch (err) {
    console.error("Error setting up live transcription:", err);
    sendError(clientSocket, err as Error, "CONNECTION_FAILED");
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.close(3000, "Setup failed");
    }
    if (deepgramWs) {
      deepgramWs.close();
    }
  }
}

// ============================================================================
// API ROUTE HANDLERS
// ============================================================================

/**
 * GET /api/metadata
 * Returns metadata about this starter application
 */
async function handleMetadata(): Promise<Response> {
  try {
    const tomlContent = await Deno.readTextFile("./deepgram.toml");
    const config = TOML.parse(tomlContent);

    if (!config.meta) {
      return Response.json(
        {
          error: "INTERNAL_SERVER_ERROR",
          message: "Missing [meta] section in deepgram.toml",
        },
        { status: 500 }
      );
    }

    return Response.json(config.meta);
  } catch (error) {
    console.error("Error reading metadata:", error);
    // Return default metadata if TOML parsing fails
    return Response.json({
      title: "Deno Live Transcription",
      description: "Real-time speech transcription using Deepgram",
      framework: "Deno",
      language: "TypeScript",
      useCase: "live-transcription"
    });
  }
}

// ============================================================================
// FRONTEND SERVING - Development proxy or production static files
// ============================================================================

/**
 * Get content type based on file extension
 */
function getContentType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    ico: "image/x-icon",
  };
  return types[ext || ""] || "application/octet-stream";
}

/**
 * Serve static file from frontend/dist
 */
async function serveStaticFile(pathname: string): Promise<Response> {
  const filePath = pathname === "/"
    ? "./frontend/dist/index.html"
    : `./frontend/dist${pathname}`;

  try {
    const file = await Deno.readFile(filePath);
    const contentType = getContentType(filePath);
    return new Response(file, {
      headers: { "content-type": contentType },
    });
  } catch {
    // Return index.html for SPA routing (404s -> index.html)
    try {
      const index = await Deno.readFile("./frontend/dist/index.html");
      return new Response(index, {
        headers: { "content-type": "text/html" },
      });
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  }
}

/**
 * Handle frontend requests - proxy to Vite in dev, serve static in prod
 */
async function handleFrontend(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (config.isDevelopment) {
    // Proxy to Vite dev server
    const viteUrl = `http://localhost:${config.vitePort}${url.pathname}${url.search}`;

    try {
      const response = await fetch(viteUrl, {
        method: req.method,
        headers: req.headers,
        body: req.body,
      });
      return response;
    } catch {
      return new Response(
        `Vite dev server not running on port ${config.vitePort}`,
        { status: 502 }
      );
    }
  }

  // Production mode - serve static files
  return serveStaticFile(url.pathname);
}

// ============================================================================
// MAIN REQUEST HANDLER
// ============================================================================

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // WebSocket endpoint: /stt/stream
  if (url.pathname === "/stt/stream") {
    const upgrade = req.headers.get("upgrade") || "";

    if (upgrade.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    // Upgrade to WebSocket
    const { socket, response } = Deno.upgradeWebSocket(req);

    // Handle the WebSocket connection
    handleLiveTranscription(socket, url.searchParams);

    return response;
  }

  // API endpoint: /api/metadata
  if (req.method === "GET" && url.pathname === "/api/metadata") {
    return handleMetadata();
  }

  // Frontend (catch-all)
  return handleFrontend(req);
}

// ============================================================================
// SERVER START
// ============================================================================

console.log("\n" + "=".repeat(70));
console.log(`🚀 Deno Live Transcription Server running at http://localhost:${config.port}`);
if (config.isDevelopment) {
  console.log(`📡 Proxying frontend from Vite dev server on port ${config.vitePort}`);
  console.log(`\n⚠️  Open your browser to http://localhost:${config.port}`);
} else {
  console.log(`📦 Serving built frontend from frontend/dist`);
}
console.log("=".repeat(70) + "\n");

Deno.serve({ port: config.port, hostname: config.host }, handleRequest);
