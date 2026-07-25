---
name: haider-building-mcp-servers
description: Designing and hosting MCP servers – resources vs tools vs prompts, transport-agnostic cores, content bundling for filesystem-less runtimes, bearer auth, deploy pitfalls, and stdio smoke testing. Use when building an MCP server, adding tools or resources, hosting one, or debugging transport and auth.
---

# Building MCP servers

Defaults for this skill: `@modelcontextprotocol/sdk`, zod, tsup, vitest, ESM, Node 20+ (also listed in [haider-engineering-defaults](../haider-engineering-defaults/SKILL.md)).

## Core shape

- One `createServer(store): McpServer` factory holding every resource, tool, and prompt. It takes a content source (an interface), never a filesystem path – that seam is what makes the same server run locally and hosted unchanged.
- Adapters are files, not forks: `stdio.ts` (local, wraps `StdioServerTransport`) and `fetch.ts` (hosted, wraps the SDK's `WebStandardStreamableHTTPServerTransport`). The host affects only the shell around `createServer`.
- Version and name the server once in the factory; clients display them, so treat them as product surface.

## Resources vs tools vs prompts

- **Resources** are addressable content with stable URIs under a scheme you own (`my-product://skills/{name}`, or whatever the product uses): things a client browses or subscribes to. Use `ResourceTemplate` with a `list` callback so clients can enumerate.
- **Tools** are queries and actions with zod input schemas – e.g. `list_items`, `get_item(name, reference?)`, `get_tokens(format)`. Describe them for a model, not a human – the description is the trigger. Validate inputs with zod; throw messages that name the valid options (`Reference "x" not found. Available: …`).
- **Prompts** are user-invokable workflows that assemble content into an instruction. A tool can serve the same job for tool-only clients by returning the assembled instructions as text – the caller applies them.
- Return raw content; never wrap results in conversational prose.

## Content for filesystem-less runtimes

- Workers and serverless functions have no filesystem. Snapshot content at build time into a generated TypeScript module (`scripts/bundle-content.ts` → gitignored `src/generated/content-bundle.ts`) and read it through the same content-source interface as the filesystem.
- Regenerate the bundle in every build and typecheck script so it can never go stale; CI and the deploy pipeline get it for free.
- Bundle keys are posix relative paths plus a directory-listing map – enough to satisfy `exists`/`readText`/`readDir` without pretending to be a real filesystem.

## Hosted transport

- Stateless first: `sessionIdGenerator: undefined`, `enableJsonResponse: true`, and a fresh server + transport per request. Sessions and SSE streams are a later problem; simple request/response covers tool calls.
- Ship an unauthenticated `/health` probe beside the MCP endpoint – it separates DNS, TLS, and routing failures from application ones instantly.
- Serve the MCP at a clean path (`/mcp`) via platform rewrites rather than exposing framework routing (`/api/...`).

## Auth

- Floor: a single long random bearer token as a platform env var, checked with a constant-time comparison, failing closed with 401 + `WWW-Authenticate`. Throw at construction on an empty token – a misconfigured deploy must not run open.
- MCP's own auth story is OAuth-based; any stronger ceremony (passkeys, OTP) should mint tokens the transport accepts rather than inventing a parallel scheme.
- Local `.env` files are not read by deployed functions – the secret must be a real platform env var (and in dev, a real process env var).

## Deploy pitfalls

- **pnpm workspace symlinks defeat file tracers.** A deployed function that imports a workspace package dies at runtime with `ERR_MODULE_NOT_FOUND`. Pre-bundle the server self-contained (tsup `noExternal: [/.*/]`) into a file the function imports by relative path – nothing resolves through `node_modules` at runtime.
- Keep the deploy shell a separate package from the server library, or the platform detects a single Node entrypoint and ignores the functions directory.
- For monorepo subdirectories, `vercel build` + `vercel deploy --prebuilt` uploads the locally built output – the cloud never has to resolve the workspace.
- A workspace-aware build command (`pnpm -w run build`) in the deploy config, not the package's own build – dependencies must build first on a clean clone.

## Testing

- Smoke over stdio with no harness: pipe JSON-RPC lines (`initialize`, `notifications/initialized`, `tools/list`, `tools/call`, `resources/read`) into the binary and parse stdout. This is also why stdout must stay protocol-clean – no banners, no update checks (skip them for the serve command).
- Repeat the same smoke over HTTP against the fetch handler in-process, then against the deployed URL – with and without the token, expecting 401 without.
- The definitive post-deploy check is a real client call end to end (`initialize` → `tools/call`) on the production domain.
