import { z } from "zod";

// The app's trust boundary for configuration. Validate once here and fail
// loudly on misconfiguration; import `env` elsewhere, never `process.env`.
// Browser-safe vars ONLY (imported by client components); the server-only secret
// lives in serverEnv().
const schema = z.object({
  NEXT_PUBLIC_AGENT_ID: z.string().min(1),
  NEXT_PUBLIC_XI_VOICE_ID: z.string().min(1),
});

export const env = schema.parse({
  NEXT_PUBLIC_AGENT_ID: process.env.NEXT_PUBLIC_AGENT_ID,
  NEXT_PUBLIC_XI_VOICE_ID: process.env.NEXT_PUBLIC_XI_VOICE_ID,
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
