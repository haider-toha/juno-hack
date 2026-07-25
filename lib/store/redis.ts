import "server-only";

import { Redis } from "@upstash/redis";

import { redisEnv } from "@/lib/env";

let client: Redis | null = null;

// Lazy, never module-scope. `next build` evaluates every imported module while
// collecting page data, and a top-level `new Redis(...)` there crashes the
// build on a machine that has no runtime env — verified, not theoretical.
//
// Callers must annotate reads as `redis().get<unknown>(key)` and parse the
// result: the command's default generic is `string`, but the client
// deserialises automatically and hands back a parsed object, so the default
// type is a lie. It also swallows a JSON parse failure and returns the raw
// string, which only a schema parse at the call site will catch.
export function redis() {
  if (!client) {
    const env = redisEnv();
    client = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return client;
}
