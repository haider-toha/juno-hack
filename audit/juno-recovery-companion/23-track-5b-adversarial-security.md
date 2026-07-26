# 23 — Track 5b: security and config hygiene

Date: 2026-07-26. Branch `docs/demo-qa-guide`, working tree (uncommitted, and
carrying the four Phase-1 tracks' changes). This track was read-only except for
one targeted `.gitignore` fix. Nothing was committed, no dependency was
installed, `package.json` and `pnpm-lock.yaml` were not opened for writing.

Skill invoked before starting: `/code-review-and-quality`.

**Verdict in one line:** the config surface is clean, and the checks below are
the ones that could have found it dirty — **no secret value exists anywhere in
this repository except `.env.local`**, not in the working tree (635 files), not
in any of the 41 commits, not in a production client bundle built with the real
keys present. Two things need a human: the **`OPENAI_API_KEY` must be rotated**
(it was surfaced in a session transcript tonight — nothing in the repo leaked
it), and **`next@16.2.9` carries four unpatched high-severity advisories** that
a patch bump to `16.2.11` closes. One latent trap was fixed: `.gitignore` was
silently ignoring `.env.example`, the file `make setup` copies from.

---

## Scope

| Owned                                                  | What happened                                                   |
| ------------------------------------------------------ | --------------------------------------------------------------- |
| `.env`, `.env.local`, `.env.example` contract          | Verified against `tasks/todo.md §Env file contract`. Clean — §1 |
| `lib/env.ts` (rewritten by Track 1)                    | Reviewed. Clean, with one structural note — §2                  |
| Client-bundle leak surface                             | Real production build, chunks grepped. Clean — §3               |
| ElevenLabs shared secret + Track 3's three mutations   | Read back from the live API. Clean — §4                         |
| `@ai-sdk/openai` provenance                            | Registry, integrity hash, maintainers, audit. Legitimate — §5   |
| Route auth surface (`/api/log`, `/api/escalate`, demo) | Code path reviewed. Intact — §6                                 |
| `.gitignore`                                           | **One fix.** `.env*` was shadowing `.env.example` — §Fixed      |

**Explicitly not touched**, to stay off Track 5a's surface: `make arc`,
`make eval`, escalation/red-flag/demo-boundary behaviour, and the empirical
live-mode 403 run. This track reviews the _auth code path_; 5a proves the
runtime behaviour. Prose in `audit/`, `tasks/` and `DEMO.md` was read but never
edited, per scope.

**Method note.** No secret value was printed, echoed or written to disk at any
point. Env files were read through `sed 's/=.\{4\}.*/=<REDACTED>/'`. Value
comparisons were done inside Python that emitted only booleans, lengths, char
classes and file paths. The two exceptions where a literal is printed below are
`NEXT_PUBLIC_*` values, which are public by design and already committed to
`.env.example`.

---

## §1 · Env file contract — **CLEAN**

`tasks/todo.md:155 §Env file contract` states the rule: secrets → `.env.local`
(quoted), public → `.env`, `PORTICO_TOOL_SECRET` is server-only, and it records
two drifts to fix — a live `OPENAI_API_KEY` sitting in `.env`, and a missing
`ANTHROPIC_API_KEY`. Both drifts are now resolved. Variable-name inventory, the
whole of each file:

```
=== VAR NAMES in .env ===          === VAR NAMES in .env.local ===   === VAR NAMES in .env.example ===
NEXT_PUBLIC_AGENT_ID               BLOB_READ_WRITE_TOKEN             BLOB_READ_WRITE_TOKEN
NEXT_PUBLIC_PORTICO_MODE           FAL_KEY                           NEXT_PUBLIC_AGENT_ID
NEXT_PUBLIC_XI_VOICE_ID            OPENAI_API_KEY                    NEXT_PUBLIC_PORTICO_MODE
                                   PORTICO_TOOL_SECRET               NEXT_PUBLIC_XI_VOICE_ID
                                   UPSTASH_REDIS_REST_TOKEN          OPENAI_API_KEY
                                   UPSTASH_REDIS_REST_URL            PORTICO_TOOL_SECRET
                                   VERCEL_OIDC_TOKEN                 UPSTASH_REDIS_REST_TOKEN
                                   XI_API_KEY                        UPSTASH_REDIS_REST_URL
                                                                     XI_API_KEY
```

| Check                                                         | Verdict                                                                                        |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY` in `.env.local` only                         | **Clean.** Present in `.env.local`, absent from `.env`. The todo's recorded drift is closed    |
| No secret behind a `NEXT_PUBLIC_` name                        | **Clean.** All three `NEXT_PUBLIC_*` vars are the agent id, the voice id and the mode          |
| No other secret drifted into `.env`                           | **Clean.** `.env` holds exactly three vars, all public                                         |
| `.env.example` carries placeholders only                      | **Clean** — see the shape table below                                                          |
| `.env.example` no longer instructs anyone to set up Anthropic | **Clean.** `git diff` shows the block renamed to OpenAI; zero `ANTHROPIC` strings remain in it |
| `.env.example` documents every var the code requires          | **Clean.** All 9 vars `lib/env.ts` parses are present, and only those                          |

`.env.example` was the one file that needed shape-checking rather than a name
check, because a "template" is exactly where a real key hides. Every value,
compared against the real ones without printing either:

```
VAR                           len  empty ==.env  ==.env.local shape
XI_API_KEY                     47  False False   False        prefix='sk_'... body is 44x 'x'
NEXT_PUBLIC_AGENT_ID           33  False False   False        PUBLIC value: 'agent_xxxxxxxxxxxxxxxxxxxxxxxxxxx'
NEXT_PUBLIC_XI_VOICE_ID        20  False True    False        PUBLIC value: 'EXAVITQu4vr4xnSDxMaL'
NEXT_PUBLIC_PORTICO_MODE        4  False False   False        PUBLIC value: 'live'
OPENAI_API_KEY                  0  True  False   False        EMPTY placeholder
BLOB_READ_WRITE_TOKEN           0  True  False   False        EMPTY placeholder
UPSTASH_REDIS_REST_URL          0  True  False   False        EMPTY placeholder
UPSTASH_REDIS_REST_TOKEN        0  True  False   False        EMPTY placeholder
PORTICO_TOOL_SECRET             0  True  False   False        EMPTY placeholder
```

The only non-empty secret-shaped entry is `XI_API_KEY`, and its body is a single
repeated `x` 44 times — a placeholder, and **not equal** to the real key.
`NEXT_PUBLIC_XI_VOICE_ID` matching `.env` is correct and intended: it is the
public Sarah preset voice, and `todo.md` records it being set to this value in
all three places deliberately.

`FAL_KEY` is in `.env.local` but in neither `.env.example` nor any code path
(`grep` for `FAL_KEY` across `*.ts`/`*.tsx`/`*.mjs`/`*.json`/`Makefile`/`*.sh`
returns nothing). It is a leftover from logo generation. Correct to omit from
`.env.example`, which documents what the code _requires_. Not a finding — noted
so nobody "helpfully" adds it.

### No secret value has been written into any tracked file

Three independent scans. None print a value; all print only locations.

**Working tree, exact values** — every secret from `.env.local` (8 vars, ≥8
chars), searched across the whole repo excluding `node_modules`, `.next`,
`.git`, `.pnpm-store`. This covers the new `audit/` files, `.e2e/`, the
`scripts/` additions, `tasks/`, `fixtures/` and `public/`:

```
Scanning for 8 distinct secret values
Files scanned: 630

=== MATCHES ===
EXPECTED  ./.env.local:4    [XI_API_KEY]              EXPECTED  ./.env.local:16   [OPENAI_API_KEY]
EXPECTED  ./.env.local:7    [BLOB_READ_WRITE_TOKEN]   EXPECTED  ./.env.local:22   [PORTICO_TOOL_SECRET]
EXPECTED  ./.env.local:10   [UPSTASH_REDIS_REST_URL]  EXPECTED  ./.env.local:25   [FAL_KEY]
EXPECTED  ./.env.local:11   [UPSTASH_REDIS_REST_TOKEN]
EXPECTED  ./.env.local:14   [VERCEL_OIDC_TOKEN]
```

Every value appears exactly once, in the one file that is meant to hold it.

**Full git history** — `git grep -F <value>` against every commit reachable from
any ref, per secret:

```
XI_API_KEY                 clean (0 hits in 41 commits)   OPENAI_API_KEY        clean (0 hits in 41 commits)
BLOB_READ_WRITE_TOKEN      clean (0 hits in 41 commits)   PORTICO_TOOL_SECRET   clean (0 hits in 41 commits)
UPSTASH_REDIS_REST_URL     clean (0 hits in 41 commits)   FAL_KEY               clean (0 hits in 41 commits)
UPSTASH_REDIS_REST_TOKEN   clean (0 hits in 41 commits)   VERCEL_OIDC_TOKEN     clean (0 hits in 41 commits)

No secret value from .env.local appears in any commit reachable from any ref.
```

This matters more than the working-tree scan: a value scrubbed from a file but
already committed would still be extractable from the object store. It is not
there.

**Partial / truncated leaks** — an exact-value scan misses a key that was pasted
half-way, or logged with an ellipsis. So: the first 12 and last 12 characters of
every secret, as 16 separate fragments:

```
Partial-leak probe: 16 fragments x 635 files
RESULT: no 12-char prefix or suffix of any secret appears outside .env.local
```

**Limitation, stated rather than glossed:** `.e2e/` contains 20+ PNG
screenshots, which a text scan cannot read. They are not a plausible leak
vector, and this is provable rather than assumed — see §3, where the only env
values any component can reach are shown to be the two public ones. A secret
cannot be rendered, so it cannot be screenshotted.

---

## §2 · `lib/env.ts` review — **CLEAN**, with one structural note

Track 1's diff is a minimal, faithful rename — `llmSchema`/`llmEnv`/
`ANTHROPIC_API_KEY` → `openAiSchema`/`openAiEnv`/`OPENAI_API_KEY`, plus the
comment above it. Nothing else in the file moved.

| Check                                                    | Verdict                                                                                                                                                         |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One `xxxEnv()` per integration, following the pattern    | **Clean.** `serverEnv` (ElevenLabs), `openAiEnv`, `blobEnv`, `toolEnv`, `redisEnv` — five, one per integration                                                  |
| Each throws loudly on absence, no soft default           | **Clean.** Every schema is `z.string().min(1)` (or `z.url()`) behind a bare `.parse()` — no `.optional()`, no `.catch()`, no `??` fallback anywhere in the file |
| Browser-safe `env` contains only `NEXT_PUBLIC_*`         | **Clean.** Three keys, all `NEXT_PUBLIC_`-prefixed                                                                                                              |
| No server secret can reach a client component through it | **Clean** — proven empirically in §3, not argued                                                                                                                |
| No dangling `llmEnv` / `ANTHROPIC_API_KEY` reference     | **Clean.** Zero hits across `*.ts`, `*.tsx`, `*.json`, `*.mjs`, `*.js`, `*.sh`, `*.yml`, `Makefile`                                                             |

The single deliberate default is `NEXT_PUBLIC_PORTICO_MODE: z.enum(["live",
"demo"]).default("live")`. This is correct and is not a soft default: it
defaults to the **stricter** mode, and a value that is neither throws rather
than resolving to one of them. Unset can never silently mean "demo".

Every secret accessor's call sites, exhaustively — this is what backs the claim
that no secret reaches a response body:

```
app/api/eleven/signed-url/route.ts:13   const { XI_API_KEY } = serverEnv();       -> outbound request header
app/api/log/route.ts:38                 !== toolEnv().PORTICO_TOOL_SECRET         -> equality comparison
app/api/escalate/route.ts:33            !== toolEnv().PORTICO_TOOL_SECRET         -> equality comparison
app/api/remind/route.ts:24              !== toolEnv().PORTICO_TOOL_SECRET         -> equality comparison
app/api/seed/route.ts:86                token: blobEnv().BLOB_READ_WRITE_TOKEN    -> SDK argument
app/api/blob/source/[...path]/route.ts:32  token: blobEnv()...                    -> SDK argument
app/api/blob/upload/route.ts:60         token: blobEnv()...                       -> SDK argument
lib/extraction/extract.ts:171           token: blobEnv()...                       -> SDK argument
lib/extraction/extract.ts:101           openAiEnv();                              -> bare validation call
lib/store/redis.ts:20                   const env = redisEnv();                   -> Redis client constructor
```

Comparison, outbound header, SDK argument, constructor, validation. **No secret
is ever placed in a `Response`.** The `/api/eleven/signed-url` handler is the
one that could plausibly get this wrong, and does not: the key goes into
`headers: { "xi-api-key": XI_API_KEY }`, the response is
`NextResponse.json({ signedUrl: signed_url })`, and the failure branch returns
`{ error: "signed_url_failed" }` — no upstream body is echoed, so a 401 from
ElevenLabs cannot reflect the key back.

Also confirmed: `env` is imported by exactly one client component
(`components/voice/voice-session.tsx`, the one sanctioned client boundary per
`CLAUDE.md`), and every other importer is a route handler or a `server-only`
module. Ten `lib/**` modules carry `import "server-only"`, including all of
`lib/store/**`, `lib/extraction/extract.ts` and `lib/drugs/lookup.ts`.

**Consider (not required):** `lib/env.ts` cannot itself be `server-only` —
`env` is client-imported by design — so the five server accessors are compiled
into the client bundle alongside it. No value leaks (§3 proves this), but there
is no _compile-time_ barrier stopping a future client component from calling
`toolEnv()`; it would fail at runtime with a Zod error in the browser rather
than at build time. Splitting the file into `lib/env.ts` (public) and a
`lib/server-env.ts` carrying `import "server-only"` would convert that runtime
failure into a build failure. Deliberately **not done here** — it touches ten
import sites, it is a refactor rather than a config fix, and Track 5a is working
the same tree. See §Non-obvious decisions · 2.

---

## §3 · Client-bundle leak check — **CLEAN**, proven against a real production build

I did not want to infer this from Next's documented behaviour, so I built the
app for production and grepped the artefact.

**How, and why it is trustworthy.** The repo was `rsync`'d to a scratchpad
directory with `node_modules` copied in (not symlinked — the first attempt with
a symlink made Next's dependency check try to reinstall, and it aborted). The
copy **includes the real `.env.local`**, so if Next were ever going to inline a
secret, this build is the one that would do it. The dev server on `:3000` and
the user's `.next` were never touched.

```
✓ Lockfile passes supply-chain policies (verified 1h ago)
✓ Compiled successfully in 2.6s
✓ Generating static pages using 9 workers (18/18) in 1072ms
BUILD_ID: 4Kq2USdlqED96ZRDENA7E
client js chunks: 25
```

Result:

```
Secret vars tested: BLOB_READ_WRITE_TOKEN, FAL_KEY, OPENAI_API_KEY, PORTICO_TOOL_SECRET,
                    UPSTASH_REDIS_REST_TOKEN, UPSTASH_REDIS_REST_URL, VERCEL_OIDC_TOKEN, XI_API_KEY

### PRODUCTION CLIENT chunks (.next/static — served to browser) — 33 files
  CLEAN — 0 of 8 secret VALUES present
### PRODUCTION SERVER output (.next/server — never served) — 484 files
  CLEAN — 0 of 8 secret VALUES present
### PRERENDERED HTML — 1 files
  CLEAN — 0 secret values

### Server env var NAMES in production client chunks
  XI_API_KEY                 present in 1 chunk(s)     UPSTASH_REDIS_REST_TOKEN   present in 1 chunk(s)
  OPENAI_API_KEY             present in 1 chunk(s)     UPSTASH_REDIS_REST_URL     present in 1 chunk(s)
  PORTICO_TOOL_SECRET        present in 1 chunk(s)     ANTHROPIC_API_KEY          ABSENT
  BLOB_READ_WRITE_TOKEN      present in 2 chunk(s)
```

The variable _names_ are present and the _values_ are not. That distinction is
the whole answer, so here is the compiled evidence from
`.next/static/chunks/0kqjfw03mljal.js` — a public var and a secret var, side by
side in the same chunk:

```js
// public — inlined as a literal at build time:
ICE_ID:"EXAVITQu4vr4xnSDxMaL",NEXT_PUBLIC_PORTICO_MODE:"demo"});

// secret — only the Zod schema shape survives; no value, no process.env read:
cL.z.object({XI_API_KEY:cL.z.string().min(1)}),cL.z.object({OPENAI_A…
…B_READ_WRITE_TOKEN:cL.z.string().min(1)}),cL.z.object({PORTICO_TOOL_SECRET:cL.z.string().min(1)}),…
```

What ships to the browser is `z.object({ XI_API_KEY: z.string().min(1) })` — a
validator describing a key's _shape_. The names are already public: they are in
the committed `.env.example`. No secret material is exposed.

The dev bundle tells the same story with the un-minified form visible, which is
worth recording because it shows the mechanism:

```js
// secret: resolved at runtime against Next's browser `process` shim, whose env is empty -> undefined
OPENAI_API_KEY: __TURBOPACK__…process$2e$js__$5b$app$2d$client$5d$…["default"].env.OPENAI_API_KEY

// public: replaced at compile time
NEXT_PUBLIC_PORTICO_MODE: ("TURBOPACK compile-time value", …)
```

`ANTHROPIC_API_KEY` is **ABSENT** from the production bundle. It does appear in
some stale on-disk dev chunks under `.next/dev/static` — those are pre-Track-1
artefacts the hot-reloading dev server left behind, not live code. The
production build, compiled fresh from the current source, settles it.

**Nothing renderable carries a secret.** Every use of the browser-safe `env`
object across all `.tsx` files in `app/` and `components/`, deduplicated:

```
env.NEXT_PUBLIC_PORTICO_MODE
env.NEXT_PUBLIC_XI_VOICE_ID
```

Two public values. That is the complete set of env data any component can put on
screen — which is also what retires the `.e2e/` screenshot question from §1.

---

## §4 · ElevenLabs shared secret — **CLEAN**, read back from the live API

`tasks/todo.md` correction 3 is the rule being checked: _"`secret__` is not
request auth — it hides a value from the LLM, not from the browser. Use
`request_headers` with a `secret_id`."_ The reason is that dynamic variables
travel **from** the browser inside `conversation_initiation_client_data`, so a
`secret__` prefix keeps a value out of the model's context while leaving it
fully visible in devtools. `request_headers` + `secret_id` is different in kind:
ElevenLabs' backend resolves the reference server-side and the value never
enters the browser at all.

Read back live via `GET /v1/convai/tools/{id}` for all five attached tools:

```
=== log_step  [webhook] ===                    === escalate_to_next_of_kin  [webhook] ===
   url: https://juno-hack.vercel.app/api/log      url: https://juno-hack.vercel.app/api/escalate
   header 'X-Portico-Tool-Secret':                header 'X-Portico-Tool-Secret':
        REFERENCE keys=['secret_id']                   REFERENCE keys=['secret_id']
   header is the literal tool secret: False       header is the literal tool secret: False
   contains 'secret__': False                     contains 'secret__': False

=== schedule_reminder  [webhook] ===           === show_red_flag / end_check_in  [client] ===
   url: https://juno-hack.vercel.app/api/remind   (client tools — no server auth surface)
   header 'X-Portico-Tool-Secret':                contains literal PORTICO_TOOL_SECRET: False
        REFERENCE keys=['secret_id']              contains 'secret__': False
   header is the literal tool secret: False
```

All three webhook tools carry the secret as a `secret_id` **reference**. The
only literal header value on any tool is `Content-Type` (length 16 —
`application/json`). No tool config contains the literal `PORTICO_TOOL_SECRET`,
and the substring `secret__` appears nowhere.

Agent-level config, same read-back:

```
AGENT: Portico | id ok: True
auth.enable_auth: False
guardrails.prompt_injection: {"is_enabled": true}
tool_ids: 5
asr keywords count: 29
dynamic_variables: {"dynamic_variable_placeholders": {}}
secret__ keys present: NONE
contains literal PORTICO_TOOL_SECRET value: False
contains literal XI_API_KEY value: False
'secret__' substring anywhere: False
```

`dynamic_variable_placeholders` is **empty** — the browser-originated channel
carries nothing at all, so the `secret__` mistake is not merely avoided, there
is no dynamic variable to make it with.

### Track 3's three mutations — none weakened auth

Cross-read against `20-track-3-elevenlabs-stress-test.md §What changed`, then
verified against the live config rather than taken on trust:

| Mutation                         | Surface touched                                  | Auth impact                                                                           |
| -------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 1 · ASR keywords, 1 → 29 terms   | `conversation_config.asr.keywords`               | **None.** Speech-recognition hinting. Confirmed live: 29 keywords                     |
| 2 · `end_check_in` description   | `tool_config.description` on a **`client`** tool | **None.** Client tools run in the browser and call no route. Confirmed `type: client` |
| 3 · `prompt_injection` guardrail | `platform_settings.guardrails`                   | **Strengthens.** `false → true`. Confirmed live: `is_enabled: true`                   |

None of the three touches `request_headers`, `secret_id`, `tool_ids`, or the
webhook URLs. The report's own claim that "the five `tool_ids` … the workspace
secret … were asserted identical after every PATCH" holds: I count 5 `tool_ids`
and 3 intact `secret_id` references.

The workspace secret **identifier** `jSDnjhNCouONynsL6JwP` appears in
`tasks/todo.md` and `20-…md`. This is an opaque reference, **not** the secret
value — confirmed by the fact that the real `PORTICO_TOOL_SECRET` value was
found in `.env.local` and nowhere else (§1), so the two strings necessarily
differ. Safe to leave in the prose.

`auth.enable_auth: False` is a pre-existing, documented decision (`todo.md`
locked decision 3), not something tonight changed. It governs who may _start a
conversation_, not who may call the routes — the routes have their own shared
secret. It is listed under residual risk below.

---

## §5 · Dependency provenance — `@ai-sdk/openai` is legitimate

The swap was `@ai-sdk/anthropic": "^4.0.20"` → `@ai-sdk/openai": "^4.0.20"` —
the same version range, kept by what looks like a name substitution. That is
exactly the pattern worth checking hard, because a typosquat and a careless
find-and-replace produce identical diffs.

| Check                                 | Result                                                                                                      |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Correct registry name                 | `@ai-sdk/openai` — the `@ai-sdk` scope, which is Vercel's                                                   |
| Repository                            | `git+https://github.com/vercel/ai.git`, `directory: packages/openai` — the official AI SDK monorepo         |
| Maintainers                           | `vercel-release-bot <infra+release@vercel.com>`, `jaredpalmer`, plus two Vercel staff                       |
| Publisher of this exact version       | `GitHub Actions <npm-oidc-no-reply@github.com>` — npm **trusted publishing** via OIDC, not a personal token |
| License                               | Apache-2.0                                                                                                  |
| Deprecated?                           | No                                                                                                          |
| Registry in use                       | `https://registry.npmjs.org/` — no `.npmrc` in the repo, none in `~`, no scope override                     |
| Version pinned vs. published `latest` | `4.0.20` **is** `latest`                                                                                    |
| Consistency with `ai@^7`              | dist-tags carry `ai-v5: 2.0.115` and `ai-v6: 3.0.88`, so the `4.x` line is the one for `ai` v7              |

**Integrity hash matches the registry byte-for-byte:**

```
registry  dist.integrity = 'sha512-/Hu+btLIO2zuYqCp//vBBAGdM/BeN4gds+NWrlv7Y9WrcTXwnEEwh6P3QZIWh2Tt1I1lswuDIpAJ4t/c/rws3Q=='
lockfile  resolution: {integrity: sha512-/Hu+btLIO2zuYqCp//vBBAGdM/BeN4gds+NWrlv7Y9WrcTXwnEEwh6P3QZIWh2Tt1I1lswuDIpAJ4t/c/rws3Q==}
registry  dist.tarball   = 'https://registry.npmjs.org/@ai-sdk/openai/-/openai-4.0.20.tgz'
```

The strongest compatibility evidence is that the installed provider and the
installed core depend on **identical** protocol packages — no version skew:

```
@ai-sdk/openai@4.0.20  dependencies: { "@ai-sdk/provider": "4.0.3", "@ai-sdk/provider-utils": "5.0.12" }
ai@7.0.37              dependencies: { "@ai-sdk/gateway": "4.0.28", "@ai-sdk/provider": "4.0.3", "@ai-sdk/provider-utils": "5.0.12" }
@ai-sdk/openai peerDependencies: { "zod": "^3.25.76 || ^4.1.8" }   // repo pins zod 4.4.3 — satisfied
```

**Nothing was orphaned by removing `@ai-sdk/anthropic`.** The lockfile diff is a
clean 1:1 swap, and the one entry that _looks_ like it changed —
`@ai-sdk/gateway@4.0.28` — only moved position in the alphabetically-sorted
list. It is still present and still carries `@vercel/oidc: 3.2.0`, because it is
a direct dependency of `ai@7.0.37` itself, not of the removed provider. Zero
occurrences of the string `anthropic` remain in `pnpm-lock.yaml`.

Next's own build-time check agrees: `✓ Lockfile passes supply-chain policies`.

### `pnpm audit` — 0 advisories in `@ai-sdk/*`, but `next` needs a bump

```
SEV       MODULE           VULNERABLE             PATCHED     TITLE
high      next             >=16.0.0 <16.2.11      >=16.2.11   Middleware / Proxy bypass in App Router (Turbopack, single locale)
high      next             >=16.0.0 <16.2.11      >=16.2.11   Denial of Service in App Router using Server Actions
high      next             >=16.0.0 <16.2.11      >=16.2.11   SSRF in Server Actions on custom servers
high      next             >=16.0.0 <16.2.11      >=16.2.11   SSRF in rewrites via attacker-controlled destination hostname
high      postcss          <=8.5.11               >=8.5.12    Arbitrary file read via attacker-controlled sourceMappingURL
high      postcss          <=8.5.17               >=8.5.18    Path traversal in source-map auto-loading
high      sharp            <0.35.0                >=0.35.0    Inherited libvips CVEs (CVE-2026-33327/33328/35590/35591)
high      brace-expansion  <=5.0.7                >=5.0.8     DoS via unbounded expansion
moderate  next  x5         >=16.0.0 <16.2.11      >=16.2.11   Cache confusion x2, unbounded Server Action payload, image-opt DoS,
                                                              unauthenticated disclosure of internal Server Function endpoints
moderate  postcss          <8.5.10                >=8.5.10    XSS via unescaped </style> in stringify output

total advisories: 14        any in @ai-sdk/*: False
```

**Tonight's dependency change introduced none of these.** All 14 are
pre-existing — `package.json`'s diff touches only the one ai-sdk line, and
`next` is unchanged at its pinned `16.2.9`. They are a real finding for a human
regardless; see §Findings requiring a human.

---

## §6 · Route auth surface — **INTACT**

Reviewed as a code path. Track 5a owns the empirical live-mode run; these are
not duplicated curl results.

**Shared-secret routes.** All three tool webhooks gate on the same header,
identically, as the first statement of the handler and before any parsing:

```ts
const HEADER = "x-portico-tool-secret";
if (request.headers.get(HEADER) !== toolEnv().PORTICO_TOOL_SECRET) {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
```

| Route           | Line | Gate present |
| --------------- | ---- | ------------ |
| `/api/log`      | 38   | **Yes**      |
| `/api/escalate` | 33   | **Yes**      |
| `/api/remind`   | 24   | **Yes**      |

`toolEnv()` throws if the secret is unset, so a misconfigured server refuses
every call rather than comparing against `undefined` and letting a header-less
request through. The header name casing differs between the tool config
(`X-Portico-Tool-Secret`) and the route (`x-portico-tool-secret`); this is
correct, as Fetch `Headers.get()` is case-insensitive.

**Demo-mode guards.** `/api/seed` inlines its own check
(`env.NEXT_PUBLIC_PORTICO_MODE !== "demo"` → 403). The five operator routes
share `app/api/demo/demo-only.ts`'s `refuseOutsideDemo()`, and — checked
individually, because importing a guard is not calling one — every exported
handler calls it as its **first** statement:

```
app/api/demo/clock/route.ts       POST:22  GET:46
app/api/demo/check-in/route.ts    GET:16   POST:24   DELETE:32
app/api/demo/log/route.ts         POST:26
app/api/demo/plan/route.ts        DELETE:24
app/api/demo/reminder/route.ts    GET:23   POST:35   DELETE:62
```

Nine handlers, nine guards, zero gaps. Guard is intact.

**Nit (not required):** the secret comparison is a plain `!==` rather than a
constant-time compare. Against a remote HTTP endpoint the network jitter
dominates the timing signal by orders of magnitude, so this is not practically
exploitable and is not worth changing.

---

## Grounding notes

Web searches and registry lookups run, and what they returned.

| Query / lookup                                                                  | What it established                                                                                                          |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `npm view @ai-sdk/openai …`                                                     | Official metadata: `vercel/ai` repo, Apache-2.0, `vercel-release-bot` maintainer, `latest: 4.0.20`                           |
| `npm view @ai-sdk/openai@4.0.20 dist.integrity dist.tarball _npmUser`           | Integrity matches the lockfile exactly; tarball on `registry.npmjs.org`; published by npm OIDC trusted publishing            |
| `WebFetch https://registry.npmjs.org/@ai-sdk/openai`                            | Independent confirmation of repo, maintainers (`jaredpalmer`, `vercel-release-bot`), license, dist-tags, **not deprecated**  |
| WebSearch: `@ai-sdk/openai npm official Vercel AI SDK provider version 4 ai v7` | Corroborates it as the official Vercel provider package, with **2587 dependent projects** — a typosquat has effectively none |
| `npm config get registry`, `.npmrc` in repo and `~`                             | Default registry, **no override anywhere** — rules out a redirected-registry attack                                          |
| `pnpm audit --json`                                                             | 14 advisories, **0 in `@ai-sdk/*`**; `next@16.2.9` needs `>=16.2.11`                                                         |
| `tasks/todo.md:155 §Env file contract`, corrections 1–5                         | The contract this track checked against, and correction 3's `secret__` reasoning                                             |
| `audit/…/20-track-3-elevenlabs-stress-test.md §What changed`, `§Rollback`       | The three mutations and their claimed auth-neutrality — then verified live rather than trusted                               |
| `GET /v1/convai/agents/{id}`, `GET /v1/convai/tools/{id}` ×5                    | Live read-back of the agent and all five tools (§4)                                                                          |

Sources:
[@ai-sdk/openai on npm](https://www.npmjs.com/package/@ai-sdk/openai) ·
[registry metadata](https://registry.npmjs.org/@ai-sdk/openai) ·
[ai on npm](https://www.npmjs.com/package/ai) ·
[vercel/ai](https://github.com/vercel/ai)

---

## Fixed

**One change, `.gitignore`.** It is the only file this track wrote.

`.gitignore` had accumulated a stray `.env*` on its last line, sitting under the
`# OS` heading beside `.vercel` — the signature of `vercel link` appending to
the file. It did two things nobody intended:

1. It made the deliberate `# Env` block above it (`.env`, `.env.local`,
   `.env*.local`) entirely dead — `.env*` already subsumes all three.
2. **It silently ignored `.env.example`** — the tracked template that
   `Makefile:15` copies (`cp -n .env.example .env`) as the first step of
   `make setup`. The file survives only because it was committed before the rule
   arrived; git does not un-track a file for a new ignore rule. Anyone adding a
   sibling (`.env.production.example`) would have found it silently dropped, and
   anyone reading `.gitignore` would reasonably conclude example files are not
   tracked here.

```diff
 # Env
-.env
-.env.local
-.env*.local
+# Env — every real env file, and never the committed template `make setup` copies.
+.env*
+!.env.example

 # OS
 .DS_Store
 .vercel
-.env*
```

Verified by exit code — `git check-ignore -q` returns 0 for ignored, 1 for not —
and then by what actually matters, `git add`:

```
.env                         rc=0  -> IGNORED
.env.local                   rc=0  -> IGNORED
.env.production.local        rc=0  -> IGNORED
.env.example                 rc=1  -> NOT ignored (trackable)

$ git add --dry-run .env.example   ->  add '.env.example'
$ git add --dry-run .env           ->  The following paths are ignored by one of your .gitignore files: .env
$ git add --dry-run .env.local     ->  The following paths are ignored by one of your .gitignore files: .env.local
```

Secrets still refused, the template now genuinely trackable, four lines become
two. **Nothing secret became stageable** — `git status --short` shows only the
pre-existing `M .env.example` from Track 1's edit.

Nothing else was fixed. Everything else in scope was already clean.

---

## Findings requiring a human

**1 · Rotate `OPENAI_API_KEY`. Required, and the only urgent item.**

The orchestrator surfaced this key's value once in tonight's own session
transcript while removing it from `.env`. **Treat it as exposed and rotate it**,
regardless of everything above. To be precise about what this finding is and is
not: nothing in this repository leaked it — the working tree, all 41 commits,
the production bundle and the partial-fragment probe are all clean. The exposure
is the transcript, not the code. Rotation is cheap here because the key is
currently unused at runtime: `openAiEnv()` has one call site
(`lib/extraction/extract.ts:101`), the app runs in demo mode, and `todo.md` A6
records that live extraction has never worked on this machine.

After rotating, update `.env.local` **and** the Vercel project env (production
carries its own copy).

**2 · Decide on `next@16.2.9` → `16.2.11` before the demo. Human judgement.**

Nine advisories against the pinned version — four high, five moderate — all
fixed by `>=16.2.11`, a patch bump within the same minor. The four highs are a
Middleware/Proxy bypass in App Router under Turbopack, two SSRFs in Server
Actions and rewrites, and a Server Actions DoS. None was introduced tonight.

This is a human call, not an agent's, for two reasons: `CLAUDE.md` pins Next
exactly (`16.2.9`, no caret) so a bump is a deliberate policy change, and it
would mean an install and a rebuild hours before filming. My read: **the
exploitability here is low for this app** — it has no middleware, no custom
server, and no rewrites, which is three of the four highs. The remaining
Server Actions DoS needs an attacker who can reach the deployment, and
`https://juno-hack.vercel.app` is public. See §Non-obvious decisions · 3.

**3 · There is no identity model on the patient-facing routes. Product decision.**

Pre-existing and already named in `20-…md` ("the session is authenticated by
holding the phone"), restated because this track independently reached the same
routes from the auth side. `/api/extract`, `/api/blob/upload` and
`/api/blob/source/[...path]` require no credential. Anyone who can guess a
`patientId` can read that patient's discharge-letter pages or overwrite their
stored plan. This is consistent with the demo's stated threat model and is not a
regression — but it is the sentence to have ready if anyone asks how Portico
handles a hostile caller, and it is a product decision rather than a prompt or
config edit.

**4 · FYI — the ElevenLabs agent has `auth.enable_auth: False`.** Documented and
locked (`todo.md` decision 3). It governs who may start a conversation, not who
may call the routes; the routes carry their own shared secret and are unaffected.
Listed only so its status is explicit rather than assumed.

---

## Residual risk

**What this track proved, and what it could not.**

- **`.e2e/` PNGs were not OCR'd.** A text scan cannot read an image. The risk is
  retired by argument rather than by scanning: §3 shows the only env values any
  component can render are `NEXT_PUBLIC_PORTICO_MODE` and
  `NEXT_PUBLIC_XI_VOICE_ID`, both public. A secret cannot appear on screen, so it
  cannot appear in a screenshot. `.e2e/` is gitignored and cannot be committed.

- **The production bundle was built from the working tree, not from a
  deployment.** It is the right artefact for "can a secret reach the browser",
  and it is the same source that will be deployed. But `todo.md` warns that
  production ships the working tree at deploy time — so if anyone deploys a
  _different_ tree, this evidence does not automatically transfer. Re-run the
  §3 grep if the deployed source diverges.

- **`node_modules` contents were not audited beyond the lockfile.** Provenance
  here means registry identity, publisher, integrity hash and advisory database
  — not a read of the package's source. `@ai-sdk/openai@4.0.20` is what npm
  published; that it is also _benign_ rests on Vercel's release integrity, not
  on my inspection.

- **The 14 `pnpm audit` advisories are unresolved by design** — fixing them was
  out of scope (no `pnpm install`, no `package.json` edits). They are reported,
  not remediated.

- **`lib/env.ts` cannot be `server-only`.** No value leaks today and §3 proves
  it, but the compile-time barrier does not exist. A future client component
  calling `toolEnv()` would fail loudly in the browser rather than at build time.
  Recommended split in §2; deliberately not done.

- **The remote ElevenLabs config was read at one moment in time.** It is clean as
  of this pass. It is a shared mutable resource, and the tools point at the
  production alias, so anyone with workspace access can change it after this
  file is written.

- **`scripts/demo-arc.sh:13` reads `PORTICO_TOOL_SECRET` from `.env.local` _and_
  `.env`** (`grep -h … .env.local .env | head -1`). `.env.local` wins the
  ordering so behaviour is correct today, and the value is not in `.env`. But it
  is a small crack in the "secrets never live in `.env`" contract: if the secret
  ever drifted back into `.env`, this script would use it without complaint
  rather than failing. Nit, not fixed — it is Track 5a's file this week.

**Not at risk, stated plainly so the negative is on the record:** no secret value
is in the working tree, in git history, in a client bundle, in a prerendered
page, in an API response body, in a rendered component, in any ElevenLabs tool
config, or behind a `NEXT_PUBLIC_` name.

---

## Non-obvious decisions

### 1 · How should `.gitignore` protect env files?

Three options, since getting this wrong either leaks a key or breaks setup.

- **(a) Explicit list** — `.env`, `.env.local`, `.env*.local`, and drop the
  stray `.env*`. Precise, and `.env.example` needs no special case. But it fails
  open: `.env.staging` or `.env.production` match nothing and would be
  committable. A rule that has to enumerate every future filename is a rule that
  will eventually miss one.
- **(b) Keep `.env*` alone.** Fails safe — every env file is ignored, including
  ones nobody has thought of. But it silently ignores `.env.example`, which is
  the state I found and the trap described above.
- **(c) `.env*` plus `!.env.example`.** ← **chosen.** Fails safe by default, and
  states the single exception explicitly rather than relying on the file already
  being tracked. A reader sees both the rule and its one carve-out on adjacent
  lines. It also lets the two blocks collapse into one, deleting three redundant
  lines — which `CLAUDE.md`'s "every line justifies itself" asks for.

Verified in both directions (secrets refused, template accepted) rather than
assumed, because a mis-ordered negation silently un-ignores everything.

### 2 · Should `lib/env.ts` be split so the server accessors are `server-only`?

- **(a) Split now** into `lib/env.ts` (public) + `lib/server-env.ts`
  (`import "server-only"`). Gives a genuine compile-time barrier.
- **(b) Add `import "server-only"` to the existing file.** Wrong — it would
  break the build immediately, because `voice-session.tsx` legitimately imports
  `env` from it.
- **(c) Report, do not do.** ← **chosen.** Three reasons, in order: the risk it
  mitigates is hypothetical (§3 proves no value leaks today), it is a refactor
  across ten import sites rather than the "targeted config fix" this track was
  scoped to, and Track 5a is running against the same tree tonight — a
  ten-file rename landing under another agent's feet is a worse outcome than the
  finding it fixes. Written up in §2 so the next person can take it deliberately.

### 3 · Should `next` be bumped to `16.2.11` tonight?

- **(a) Bump now.** Closes four highs. But it needs `pnpm install` and a
  rebuild, both explicitly out of this track's scope, hours before filming, on a
  tree four other agents have been writing to — and `CLAUDE.md` pins Next
  exactly, so it is a policy change, not a maintenance action.
- **(b) Say nothing** because it is pre-existing and not tonight's regression.
  Dishonest by omission: "pre-existing" is not "acceptable", and four unpatched
  highs on a publicly-reachable deployment is exactly what a security review
  exists to surface.
- **(c) Report with the exploitability analysis and let a human decide.** ←
  **chosen.** The analysis is what makes the report actionable rather than
  alarming: this app has no middleware, no custom server and no rewrites, which
  eliminates three of the four highs outright. The honest residual is a Server
  Actions DoS against a public URL. That is a real but low-stakes risk for a
  hackathon demo, and the bump is a patch-level one-liner whenever someone wants
  it. Recorded in §Findings requiring a human · 2.
