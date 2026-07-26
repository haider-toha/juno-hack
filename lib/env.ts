import { z } from "zod";

// The app's trust boundary for configuration. Validate once here and fail
// loudly on misconfiguration; import `env` elsewhere, never `process.env`.
// Browser-safe vars ONLY (imported by client components); the server-only secret
// lives in serverEnv().
const schema = z.object({
  NEXT_PUBLIC_AGENT_ID: z.string().min(1),
  NEXT_PUBLIC_XI_VOICE_ID: z.string().min(1),
  // Public by design: the UI has to render it, because a demo mode you cannot
  // see is indistinguishable from a lie. Unset means live; a value that is
  // neither throws here rather than quietly resolving to one of them.
  NEXT_PUBLIC_PORTICO_MODE: z.enum(["live", "demo"]).default("live"),
});

export const env = schema.parse({
  NEXT_PUBLIC_AGENT_ID: process.env.NEXT_PUBLIC_AGENT_ID,
  NEXT_PUBLIC_XI_VOICE_ID: process.env.NEXT_PUBLIC_XI_VOICE_ID,
  NEXT_PUBLIC_PORTICO_MODE: process.env.NEXT_PUBLIC_PORTICO_MODE,
});

const serverSchema = z.object({
  XI_API_KEY: z.string().min(1),
});

// Server-only. Never import into a client component. Called only inside
// /api/eleven/signed-url so the ElevenLabs key never enters the browser bundle.
export function serverEnv() {
  return serverSchema.parse({
    XI_API_KEY: process.env.XI_API_KEY,
  });
}

// One function per integration, not one fat schema: a missing OpenAI key must
// not stop the Redis-only parts of the app from booting. Each is called at the
// first line of the code that needs it, so a misconfiguration fails at the
// config boundary with the variable's name — never as a third-party 401 in the
// middle of an extraction.

const openAiSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
});

// The provider reads OPENAI_API_KEY from process.env itself, so nothing forces
// this call. Extraction calls it anyway — that is the whole point.
export function openAiEnv() {
  return openAiSchema.parse({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  });
}

const blobSchema = z.object({
  BLOB_READ_WRITE_TOKEN: z.string().min(1),
});

// Asserted and passed explicitly. The Blob SDK would otherwise fall back to
// OIDC (VERCEL_OIDC_TOKEN), which is short-lived and auto-rotated: a pulled
// copy goes stale and yesterday's working upload starts failing. handleUpload
// needs the long-lived token regardless.
export function blobEnv() {
  return blobSchema.parse({
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  });
}

const toolSchema = z.object({
  PORTICO_TOOL_SECRET: z.string().min(1),
});

// The shared secret behind `/api/log` and `/api/escalate`. ElevenLabs' backend
// sends it as a request header it resolves from a workspace secret, so the
// value never reaches the browser. It is deliberately NOT a `NEXT_PUBLIC_` var
// and deliberately not a `secret__` dynamic variable: dynamic variables are
// sent FROM the browser inside conversation_initiation_client_data, so the
// prefix hides a value from the LLM, not from anyone with devtools open [C7].
export function toolEnv() {
  return toolSchema.parse({
    PORTICO_TOOL_SECRET: process.env.PORTICO_TOOL_SECRET,
  });
}

const redisSchema = z.object({
  UPSTASH_REDIS_REST_URL: z.url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
});

export function redisEnv() {
  return redisSchema.parse({
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}
