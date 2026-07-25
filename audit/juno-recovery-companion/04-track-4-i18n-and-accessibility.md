# Track 4 – i18n (en/cy) and plain-language accessibility

Research pass only. No implementation code was written. Every claim below carries a
URL. Where a source could not be confirmed it is listed under **Could not confirm**
rather than smoothed over.

---

## Scope

Two halves, both scoped to the repo as it stands at commit `dd3de56`:

1. **i18n for the Next.js App Router.** Pick one approach for localising every UI
   string _and_ the ElevenLabs persona/system prompt/first message into English and
   Welsh, without a client-side provider around the tree, without a `[locale]` URL
   segment if that churn is not justified, and with the six showcase-only languages
   degrading honestly.
2. **Plain-language and accessibility to a ~9-year-old reading level**, expressed as
   a checkable list the spec can adopt verbatim, plus a merged anti-slop checklist
   reconciling `CLAUDE.md` against the three design skills.

**Precedence rule, stated once and applied throughout.**
`/Users/haidertoha/Code/juno-hack/CLAUDE.md` is this project's design law and
**overrides the skills wherever they conflict.** The skills recommend fonts
(Inter, Geist, Satoshi, Cabinet Grotesk) that `CLAUDE.md` explicitly bans, recommend
a monospace for numerals which `CLAUDE.md` bans outright, recommend 13px UI text and
36px rows which are wrong for this audience, and (in `/design-taste-frontend`)
mandate `min-h-[100dvh]` which would break the phone shell. Every one of those
conflicts is enumerated in **Merged anti-slop checklist** below. `/design-taste-frontend`
is written for landing pages and portfolios; only its anti-slop discipline and its
Pre-Flight Check habit transfer to this product UI. Its hero/eyebrow/logo-wall/marquee
rules do not apply and must not be imported.

**Stack facts confirmed from the repo, not assumed:** Next 16.2.9, React 19.2.7,
Tailwind 4.3.1 (CSS-first, no `tailwind.config.js`), TypeScript 6.0.3, zod 4.4.3,
`@elevenlabs/react ^1.8.0`. `next.config.ts` carries only `reactStrictMode` and
`devIndicators: false`. There is **no** `middleware.ts` / `proxy.ts` at the root. No
i18n library is installed. `pnpm-workspace.yaml` carries `minimumReleaseAgeExclude`
entries, which matters (see i18n recommendation).

---

## Existing design vocabulary

Enumerated from `app/globals.css` (the whole `@theme inline` block) and `CLAUDE.md`.
New screens reuse these; they do not invent tokens.

### Fonts

Declared in `app/layout.tsx` via `next/font/google`, self-hosted, `display: "swap"`.

| CSS var          | Value                                                       | Loaded as                                                                   |
| ---------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| `--font-display` | `var(--font-hanken), "Helvetica Neue", sans-serif`          | `Hanken_Grotesk({ subsets: ["latin"], weight: ["400","500","600","700"] })` |
| `--font-body`    | same as display                                             | same instance                                                               |
| `--font-serif`   | `var(--font-newsreader), Georgia, "Times New Roman", serif` | `Newsreader({ subsets: ["latin"], weight: ["400"], style: ["italic"] })`    |

Newsreader italic is the editorial accent and **no screen uses it yet**. No monospace
exists anywhere; tabular figures come from the `.tnum` utility
(`font-feature-settings: "tnum" 1`), defined at the bottom of `globals.css`.

> **Welsh blocker, verified first-hand.** `subsets: ["latin"]` does not cover the
> Welsh circumflex forms. See **Welsh specifics → Font subsets**. Both faces must
> move to `subsets: ["latin", "latin-ext"]`.

### Colour tokens (all of them)

```
Brand primitives   navy #0d1b3d · indigo #2d51fb · lavender #ebeffd · slate #3c4b63
                   grey #909db2 · mist #f2f4f7 · white #ffffff
Status             success #21a24c · info #2566ec · warning #d4780f · error #d62d28
Surfaces           surface #ffffff · surface-raised #f2f4f7 · surface-sunken #ebeffd
                   surface-invert #0d1b3d
Ink                ink #111b32 · ink-muted #3c4b63 · ink-faint #909db2 · ink-invert #ffffff
Accent             accent #2d51fb · accent-hover #2566ec · accent-soft #ebeffd
Rules              rule #e3e8f0 · rule-strong #111b32
Device chrome      bezel #1c1c1e   (lg-only demo frame; never app UI)
```

Used as Tailwind utilities: `bg-surface`, `text-ink-muted`, `border-rule`,
`text-accent`, `bg-mist`, `bg-lavender`, and so on. Raw hex in a component is banned;
the orb's gradient in `components/voice/orb.tsx` is the single sanctioned exception,
plus `themeColor` in `app/layout.tsx` (a browser `<meta>` value, not a style).

**There is no dark theme.** No `.dark` class, no `prefers-color-scheme` block, no
paired tokens. `haider-design-taste` calls light+dark "non-negotiable" and
`/design-taste-frontend` §6.C calls dark mode mandatory. Neither is satisfied today.
Treat as a deliberate 24h scope cut, stated out loud, not as an oversight to fix
mid-hackathon.

### Radii, depth, motion, measure

| Token / rule      | Value                                                                        | Use                                                                              |
| ----------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `rounded-tactile` | 12px                                                                         | buttons, tags, chips, icon-squares                                               |
| `rounded-card`    | 16px                                                                         | cards and sheets                                                                 |
| `rounded-bubble`  | 16px                                                                         | chat bubbles                                                                     |
| `rounded-pill`    | 9999px                                                                       | input capsule, end-X circle, orb, listening dots                                 |
| `border-rule`     | 1px `#e3e8f0`                                                                | hairline structure (also the global default border colour, set in `@layer base`) |
| `shadow-card`     | `0 1px 2px 0 rgb(13 27 61 / .04), 0 6px 20px -4px rgb(13 27 61 / .08)`       | cards are shadow-defined, not ruled                                              |
| body base         | `1.0625rem` (17px) / `1.6`                                                   | set on `body` in `@layer base`                                                   |
| headings          | `--font-display`, weight 600, `line-height: 1.05`, `letter-spacing: -0.02em` | `h1`–`h4` in `@layer base`                                                       |
| measure           | ≤ 66ch                                                                       | `CLAUDE.md`; pages currently use `max-w-[40ch]` / `[42ch]` / `[32ch]`            |
| motion            | 120–200ms ease-out, opacity + small translate only                           | `CLAUDE.md`                                                                      |
| tap targets       | ≥ 44px                                                                       | `CLAUDE.md`                                                                      |

**No `--text-*` tokens are defined**, so Tailwind stock sizes apply:
`text-xs` 12px, `text-sm` 14px, `text-base` 16px, `text-lg` 18px, `text-xl` 20px.
The 17px `body` size only reaches text that carries no size utility. In practice most
copy renders at 16px and several labels at 12px. That matters for an elderly cohort
(see checklist item 14).

### The phone-shell height rule

`app/(phone)/layout.tsx` owns the height: `h-dvh` on mobile, a fixed `lg:h-[852px]`
on desktop, `overflow-hidden` on the device, and one inner
`flex min-h-0 flex-1 flex-col overflow-y-auto` region carrying the safe-area insets.
**Pages inside the frame must never use `dvh`/`vh`.** Fill the column with
`flex min-h-0 flex-1 flex-col`. Every existing page does this correctly
(`app/(phone)/page.tsx`, `check-in/page.tsx`, `plan/page.tsx`,
`components/voice/voice-session.tsx`). `app/not-found.tsx` uses `min-h-dvh` and is
fine because it sits outside the `(phone)` group.

### Icons

`components/icons.tsx` is a hand-rolled inline SVG set on a 16px grid (`IconDoc` is
24px), stroked with `currentColor`, `aria-hidden` on every glyph. Its own header
comment says "Deliberately not an icon library." `components/language-picker.tsx`
carries a second private set plus eight inline national-flag SVGs. Do not add an icon
dependency; `/design-taste-frontend` §3.C would have you install Phosphor, and that
is overridden.

### Measured contrast of the existing palette

Computed from the `@theme` hex values (WCAG relative-luminance formula). This is the
single largest accessibility finding in the current design system.

| Foreground                    | on `surface` #fff | on `mist` | on `lavender` | Verdict                                              |
| ----------------------------- | ----------------- | --------- | ------------- | ---------------------------------------------------- |
| `ink` #111b32                 | **17.12**         | 15.54     | 14.92         | AAA everywhere                                       |
| `ink-muted` #3c4b63           | **8.83**          | 8.01      | 7.69          | AAA everywhere                                       |
| `ink-faint` #909db2           | **2.74**          | 2.49      | 2.39          | **FAILS AA everywhere, and fails 3:1**               |
| `accent` #2d51fb              | **5.70**          | 5.18      | 4.97          | AA pass, AAA fail                                    |
| `accent-hover` #2566ec        | 5.01              | 4.55      | 4.37          | AA pass on white/mist; fails on lavender             |
| `success` #21a24c             | **3.31**          | 3.01      | 2.89          | large-text only; fails as body text                  |
| `warning` #d4780f             | **3.23**          | **2.94**  | 2.82          | large-text only on white; **fails even 3:1 on mist** |
| `error` #d62d28               | **4.92**          | 4.47      | 4.29          | AA on white only                                     |
| `ink-invert` #fff on `accent` | **5.70**          | –         | –             | AA pass (the primary CTA is fine)                    |
| `ink` on `accent`             | **3.00**          | –         | –             | large text only; never body text on an accent fill   |

Non-text / boundary contrast: `rule` on `surface` = **1.23:1**; `mist` fill on
`surface` = **1.10:1**; `lavender` on `surface` = **1.15:1**.

Consequences the spec must act on:

- `text-ink-faint` is currently used for the home privacy footer copy, the
  `"Default"` label and the empty-search line in the language picker, the composer
  placeholder, `VoiceStatusLine`, the `Connecting…` / `Getting ready…` line, chevrons
  and the search glyph. **Every one of those fails WCAG 1.4.3 at 2.74:1.** Demote
  `ink-faint` to decorative glyph duty only, or add a darker third ink tier.
- `success` and `warning` cannot carry body text. In a medication UI ("taken",
  "missed", "due") they may tint an _icon_ (1.4.11 needs 3:1, and `success` 3.31 /
  `warning` 3.23 clear it on white but `warning` fails on `mist`), but the state must
  also be carried by a word, never by colour alone (WCAG 1.4.1).
- The composer's text input is identified only by a `bg-mist` fill at **1.10:1**
  against `bg-surface`, with `border-transparent`. WCAG 1.4.11 requires 3:1 for
  "visual information required to identify user interface components". Give inputs a
  real boundary.

---

## i18n options evaluated

All version and compatibility facts below were checked against live docs and the npm
registry on 2026-07-25. Next.js docs cited render as version 16.2.11.

| Option                                                | Version / status                                                                      | RSC-native?                                                                                                    | Needs URL segment?                                                        | Client bundle                                                                                     | Next 16                                                                 | Verdict                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------- |
| **Typed dictionary, zero deps**                       | n/a                                                                                   | **Yes, by construction**                                                                                       | **No**                                                                    | Zero unless a leaf needs strings                                                                  | n/a – nothing to break                                                  | **Recommended**                                     |
| **next-intl**                                         | `4.13.4`, published 2026-07-23, peer `next: ^16`                                      | Yes (`react-server` conditional exports; `useTranslations` works in Server Components)                         | **Optional** – the "without i18n routing" setup drops `[locale]` entirely | Current locale only; ships _all_ that locale's messages clientward by default unless you `pick()` | Docs already use `proxy.ts`; `cacheComponents` interop is an open issue | **Named fallback**                                  |
| **next-i18next / react-i18next**                      | `next-i18next@16.0.8` (2026-07-15); App Router support landed in `16.0.0`, 2026-03-23 | **Partial** – `getT()` works in RSC but the architecture still hydrates an i18next instance via `I18nProvider` | No (`localeInPath: false` cookie mode)                                    | Heavier: an i18next instance plus resources reach the client                                      | Supported; README references `proxy.ts`                                 | Rejected: provider-heavy for a mostly-server app    |
| **Next's built-in `i18n` config**                     | Pages Router only                                                                     | n/a                                                                                                            | n/a                                                                       | n/a                                                                                               | **Breaks App Router**                                                   | **Non-starter**                                     |
| **Paraglide JS / inlang**                             | `@inlang/paraglide-js@2.22.0` (2026-07-14); `@inlang/paraglide-next` **deprecated**   | Yes in principle (plain message functions, no context)                                                         | Optional                                                                  | Best-in-class (compile-time, tree-shaken; claims ~70% smaller)                                    | **Turbopack unsupported by design**                                     | Rejected on Next 16                                 |
| **next-international**                                | `1.3.1`, last release 2024-10-31, 96 open issues                                      | Claims yes                                                                                                     | Required                                                                  | –                                                                                                 | No Next 16                                                              | Rejected: unmaintained                              |
| **intlayer / next-intlayer**                          | `9.0.1`, 2026-07-23; claims Next 12–16 + Turbopack; has a `no-locale-path` guide      | Yes                                                                                                            | Optional                                                                  | –                                                                                                 | Claimed                                                                 | Viable but unnecessary here                         |
| **Lingui**                                            | `6.6.0`, 2026-07-24; RSC since v4.10                                                  | Yes                                                                                                            | Typically `[lang]`                                                        | –                                                                                                 | Yes; needs an SWC plugin                                                | Rejected: setup cost                                |
| **gt-next**, **next-translate**, **next-i18n-router** | active                                                                                | mixed                                                                                                          | mixed                                                                     | –                                                                                                 | mixed                                                                   | Not evaluated in depth; no advantage over the above |

URLs: [next-intl](https://next-intl.dev) ·
[next-intl without i18n routing](https://next-intl.dev/docs/getting-started/app-router/without-i18n-routing) ·
[next-intl server/client components](https://next-intl.dev/docs/environments/server-client-components) ·
[next-intl cacheComponents issue #1493](https://github.com/amannn/next-intl/issues/1493) ·
[next-i18next](https://github.com/i18next/next-i18next) ·
[Next.js App Router internationalization guide](https://nextjs.org/docs/app/guides/internationalization) ·
[Next.js Pages Router i18n (note the `router: Pages Router` frontmatter)](https://nextjs.org/docs/pages/guides/internationalization) ·
[vercel/next.js#53724 – `i18n` config 404s all App Router routes, still open](https://github.com/vercel/next.js/issues/53724) ·
[Paraglide JS](https://paraglidejs.com) ·
[paraglide-js#675 – Turbopack out of scope](https://github.com/opral/paraglide-js/issues/675) ·
[next-international](https://github.com/QuiiBz/next-international) ·
[intlayer Next.js docs](https://intlayer.org/doc/environment/nextjs) ·
[Lingui RSC tutorial](https://lingui.dev/tutorials/react-rsc)

### Four findings that settle the choice

**1. Next's built-in `i18n` config is dead for the App Router – verified, not assumed.**
The docs page carries `router: Pages Router` in its frontmatter and there is no App
Router equivalent. [vercel/next.js#53724](https://github.com/vercel/next.js/issues/53724)
is **still open**: setting `i18n` in `next.config` makes every `app/` route return 404. Do not put an `i18n` key in `next.config.ts`.

**2. `middleware.ts` is `proxy.ts` in Next 16.**
[File convention docs](https://nextjs.org/docs/app/api-reference/file-conventions/proxy):
"the `middleware` file convention is deprecated and has been renamed to `proxy`", from
`v16.0.0`, and proxy now defaults to the Node runtime. Codemod:
`npx @next/codemod@canary middleware-to-proxy .`. The docs also say the feature "is
recommended to be used as a last resort". Any tutorial telling you to create
`middleware.ts` for locale negotiation is pre-16.

**3. `localePrefix: "never"` is not the same as "no URL segment".**
next-intl's [routing configuration](https://next-intl.dev/docs/routing/configuration)
still requires a `[locale]` folder under `never` – requests are only rewritten
internally. The genuinely segment-free path is the separate
["without i18n routing"](https://next-intl.dev/docs/getting-started/app-router/without-i18n-routing)
setup, where the locale comes from a cookie inside `i18n/request.ts`. Its maintainer
is explicit that the _routing_ setup needs a top-level dynamic segment
([#1764](https://github.com/amannn/next-intl/issues/1764)) – which would mean moving
`app/(phone)/` under `app/[locale]/`.

**4. Reading a cookie makes the route dynamic – and this cost is identical for every
option, so it is not a differentiator.**
[`cookies()`](https://nextjs.org/docs/app/api-reference/functions/cookies): "Using it
in a layout or page will opt a route into dynamic rendering."
[`headers()`](https://nextjs.org/docs/app/api-reference/functions/headers) says the
same. You also **cannot `set` a cookie during Server Component render** – the switch
must go through a Server Function or Route Handler. For this app the dynamic-rendering
cost is nil: nothing is worth statically generating, and `/api/eleven/signed-url`
already runs `cache: "no-store"`.

### One repo-specific constraint the libraries all share

pnpm 11 turns on `minimumReleaseAge` **by default at 1440 minutes (1 day)**
([pnpm 11.0 release notes](https://pnpm.io/blog/releases/11.0),
[settings](https://pnpm.io/settings)). That is exactly why
`pnpm-workspace.yaml` carries `minimumReleaseAgeExclude` for the ElevenLabs packages.
Adding a dependency mid-hackathon means either resolving to a >24h-old version or
adding another exclude entry. A zero-dependency approach sidesteps this entirely.

---

## i18n RECOMMENDATION

**Ship a typed dictionary module. No library. Locale carried by a cookie, negotiated
from `Accept-Language` on first visit. No `[locale]` segment. No `proxy.ts`.**

This is a clear pick, not a hedge. If the team later wants ICU messages, plural
tooling or a translator workflow, **next-intl in its "without i18n routing" mode** is
the migration target and nothing about the shape below blocks it.

### Why the zero-dependency option wins here

1. **The translation surface is about 55 strings plus one system prompt.** Enumerated
   from the repo: `app/layout.tsx` metadata (5), `app/(phone)/page.tsx` (7),
   `check-in/page.tsx` (4), `plan/page.tsx` (3), `back-button.tsx` (1),
   `language-picker.tsx` (7), `voice/orb.tsx` (5), `voice/composer.tsx` (5),
   `voice/transcript.tsx` (1), `voice/suggested-questions.tsx` (1),
   `voice/voice-session.tsx` (7), `lib/check-in-prompt.ts` (1 prompt + 4 questions),
   `app/not-found.tsx` (4). At that size, a library's value (namespacing, extraction,
   ICU, TMS integration) is close to zero and its cost (a dependency, a config file, a
   provider decision, a Next-16 compatibility bet) is not.
2. **It is Server-Component-native by construction.** `getDictionary(locale)` is a
   plain async function called in an async Server Component. There is no provider,
   no context, no `"use client"` anywhere new. That is exactly what `CLAUDE.md`'s
   Frontend section asks for.
3. **Zero client bundle by default, and the codebase already has the right shape.**
   `app/(phone)/check-in/page.tsx` is a thin Server Component that passes `title`,
   `blurb`, `systemPrompt`, `firstMessage` and `suggestedQuestions` as props into
   `<VoiceSession>`, the one client boundary. Localised strings ride the same route.
   next-intl by contrast ships _all_ of the active locale's messages clientward
   unless you explicitly `pick()`.
4. **Type safety for free, in the idiom `CLAUDE.md` already prescribes.** Derive the
   contract from the English dictionary and make Welsh `satisfies` it – a missing
   Welsh key is a compile error, not a runtime English leak. `CLAUDE.md` says
   "Use `satisfies` for config-shaped literals, not `as`".
5. **It models the showcase-only languages honestly.** A discriminated union splits
   real locales from showcase locales, so the type system makes a half-translated
   screen unrepresentable. A library would push you toward either six empty message
   files or fallback-to-English, and English leaking into a Welsh screen is a direct
   violation of the Welsh guidance quoted below.
6. **No dependency means no `minimumReleaseAge` friction and no Next-16 bet.**
7. `CLAUDE.md`: "Every line justifies itself", "Rule of three", "no premature
   abstraction". All three point the same way.

Honest counter-arguments, stated so the spec-writer can weigh them:

- **No ICU plurals.** Welsh is the hard case: `Intl.PluralRules("cy")` resolves to
  **six** categories – `zero, one, two, few, many, other` – against English's two
  (verified in Node 26). Mitigation, in order: (a) design counts out of sentences,
  which is a plain-language win anyway ("Diwrnod 3 o 30" as a label beats "You have
  3 days left" as a sentence); (b) if a count must sit in a sentence, `Intl.PluralRules`
  is in the platform, zero dependency; (c) Welsh numerals also trigger initial
  consonant mutation and take a singular noun, which no plural-category system solves –
  that needs a Welsh speaker, not a library.
- **No date/number formatting helpers.** `Intl.*` is built in and verified working for
  `cy` (Node 26): `Intl.DateTimeFormat("cy")` → "Dydd Sadwrn, 25 Gorffennaf",
  `Intl.RelativeTimeFormat("cy")` → "ddoe", `Intl.ListFormat("cy")` → "A, B, a(c) C".
  The Web Interface Guidelines mandate `Intl.DateTimeFormat` / `Intl.NumberFormat`
  over hardcoded formats regardless of which i18n library you pick.
- **No translation-management tooling.** Irrelevant at two locales in 24 hours.

### File and folder shape this implies

```
lib/i18n/
  locales.ts     the locale unions + the picker's display list + isRealLocale()
  en.ts          the source of truth; `export const en = { … } as const`
  cy.ts          `export const cy = { … } satisfies Dictionary`  ← missing key = tsc error
  index.ts       type Dictionary = typeof en
                 getLocale(): Promise<Locale>       reads cookie, falls back to Accept-Language
                 getDictionary(locale): Dictionary  a plain switch, no dynamic import needed at 2 locales
app/actions/
  set-locale.ts  "use server" – the ONLY place the cookie is written
```

`index.ts` is not a barrel re-export file in the sense `CLAUDE.md` bans; it is the
module's real implementation. If that reads ambiguously, name it `lib/i18n.ts` with
`lib/i18n-en.ts` / `lib/i18n-cy.ts` beside it and the question disappears.

Schematic only, to fix the shape:

```ts
// lib/i18n/locales.ts
export const REAL_LOCALES = ["en", "cy"] as const;
export const SHOWCASE_LOCALES = ["pl", "ro", "tr", "pt", "es", "fr"] as const;

export type Locale = (typeof REAL_LOCALES)[number];
export type ShowcaseLocale = (typeof SHOWCASE_LOCALES)[number];
export type PickerLocale = Locale | ShowcaseLocale;

export const LOCALE_COOKIE = "juno_locale";
```

```ts
// lib/i18n/index.ts   (server-only)
import { cookies, headers } from "next/headers";

export type Dictionary = typeof en;

export async function getLocale(): Promise<Locale> {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (stored === "en" || stored === "cy") return stored;
  // First visit: negotiate from the browser, per Helo Blod 4.1
  const accept = (await headers()).get("accept-language") ?? "";
  return /(^|,)\s*cy\b/i.test(accept) ? "cy" : "en";
}

export function getDictionary(locale: Locale): Dictionary {
  return locale === "cy" ? cy : en;
}
```

```ts
// app/actions/set-locale.ts
"use server";
export async function setLocale(locale: Locale) {
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout"); // switching reloads the same page – Helo Blod 4.5
}
```

Then: `app/layout.tsx` awaits `getLocale()` and renders `<html lang={locale}>`
(WCAG 3.1.1 – see checklist item 26). Each page awaits `getLocale()` +
`getDictionary()` and passes strings down as props. `components/language-picker.tsx`
stays a client leaf and calls `setLocale` in its row handler instead of just closing
the menu.

Zod is **not** needed here. `CLAUDE.md` scopes Zod to trust boundaries; a cookie value
narrowed by a two-branch string comparison is already provably typed, and adding a
schema would be the "validating internal calls is slop" case.

### Why not a `[locale]` segment

Not worth the churn in a sub-24h build. It would mean moving `app/(phone)/*` under
`app/[locale]/(phone)/*`, rewriting every `href` in `page.tsx`, `back-button.tsx`,
`voice-session.tsx` and `not-found.tsx`, adding `generateStaticParams`, and adding a
`proxy.ts` to negotiate and redirect – for two locales in a demo where nobody shares
a URL. Roughly an hour of churn plus a whole bug class (links silently dropping the
locale) against the crown-jewel work.

Two honest counter-points, recorded rather than buried:

- The Web Interface Guidelines rule "URL reflects state" argues for the segment, as
  does shareability of a Welsh screen.
- Welsh Language Standard 42 (WSI 2018/441) requires that where a Welsh page
  _corresponds_ to an English page, the English page says so and links to it. A
  single-URL, cookie-rendered page has no corresponding separate Welsh page, so 39,
  43 and 44 are satisfied and 42 does not bite. **If Juno ever became a real NHS Wales
  service, a `/cy` route pair would be the safer compliance posture.** For a
  prototype, it is not.

Also note Helo Blod 4.10 talks about the **domain**, not the path: "Either the domain
name should be language-neutral (e.g. a brand name) or there should be a domain name
for each language." A brand domain satisfies it.

### How the locale reaches the ElevenLabs agent

The wiring point exists already. `components/voice/voice-session.tsx` `connect()`
currently hardcodes the language:

```ts
startSession({
  signedUrl,
  overrides: {
    agent: {
      prompt: { prompt: systemPrompt },
      language: "en", // ← line 226: hardcoded
      firstMessage,
    },
    tts: { voiceId: env.NEXT_PUBLIC_XI_VOICE_ID },
  },
});
```

The change is three props, no architectural move:

1. `app/(phone)/check-in/page.tsx` (already a Server Component) awaits `getLocale()`
   and `getDictionary(locale)`, then passes `locale`, `title`, `blurb`,
   `systemPrompt`, `firstMessage` and `suggestedQuestions` from the dictionary.
2. `VoiceSessionProps` gains `locale: Locale`; `connect()` sends
   `language: locale` instead of `"en"`.
3. `lib/check-in-prompt.ts` splits into `checkInPrompt.en` / `checkInPrompt.cy` inside
   the dictionary. **The whole persona block is content that must exist in both
   languages** – including "Explain things at roughly a reading age of nine" and the
   "call 111, or 999 if it sounds severe" line. A Welsh session driven by an English
   system prompt will drift back to English mid-conversation, which is the exact
   failure mode the Welsh Language Commissioner names by name (see Welsh specifics).

**Overrides must be enabled per field, or they are silently ignored.** `CLAUDE.md` and
the README both warn about this for the prompt; the
[overrides docs](https://elevenlabs.io/docs/eleven-agents/customization/personalization/overrides.md)
confirm it applies to every field: "For security reasons, overrides are disabled by
default. Enable the fields you want to allow overriding." So `language` and
`firstMessage` each need enabling in the agent's Security tab alongside `prompt`. The
same page adds a constraint worth knowing: "When using overrides, omit any fields you
don't want to override rather than setting them to empty strings or null values." The
documented shape matches what `voice-session.tsx` already sends
(`agent.prompt.prompt`, `agent.firstMessage`, `agent.language`, `tts.voiceId`; the
prompt object also accepts `llm`).

**Welsh works, but only on one TTS model, and the agent's default path will not use
it.** See the capability table under **Welsh specifics → ElevenLabs Welsh capability**.
The short version: `eleven_v3` lists "Welsh (cym)"; `eleven_multilingual_v2` and
`eleven_flash_v2_5` do not; and the agent's own language docs say "Additional languages
switch the agent to use the v2.5 Multilingual model", which is a model without Welsh.
Confirm the agent is on a v3 conversational model **before** building the Welsh voice
path. Details and the fallback plan are in **Residual risk R1**.

Also localise `SUGGESTED_QUESTIONS` and the `voiceStatusLabel()` strings in
`components/voice/orb.tsx` (`Connecting…`, `Connection error`, `Not connected`,
`Speaking`, `Listening`) – those are read out by `aria-live="polite"` and are exactly
the "conditional or rarely used" chrome that Helo Blod 5.1 says must not leak English.

### How the six showcase-only languages degrade

The rule to design against, verbatim from the Welsh Government's
[Bilingual Technology Toolkit v3](https://www.gov.wales/sites/default/files/publications/2024-11/bilingual-technology-toolkit-for-good-user-experience.pdf)
requirement 5.1:

> "All natural language in the user interface of the application will be exclusively
> in the selected language. … no text in the alternate language should be visible,
> i.e. no 'mixed language' text. … It includes all aspects of the user interface,
> including those that are conditional or rarely used, such as error messages and
> notifications."

So a **silent fallback to English is the one outcome that is forbidden.** Three
options, in order of preference:

**(a) Recommended – an in-language "not yet" notice.** The row stays selectable. On
selection the app does **not** change locale; it shows one short panel written
_entirely in the chosen language_, wrapped in `<div lang="pl">` (WCAG 3.1.2), saying
the app is available in English and Cymraeg today, with two buttons labelled
`English` and `Cymraeg`. Cost: two strings × six languages, roughly 12–16 strings.
This satisfies 5.1 (the panel is wholly monolingual, the chrome never enters a half
state), it is honest, it is cheap, and it is a good demo beat: "we show the reach and
we are straight about what is real tonight." Have a native speaker or an accredited
translator check those twelve strings – they are short and high-visibility.

**(b) Cheaper fallback – disable the six rows** with a visible, non-colour-only
"available soon" affordance and `aria-disabled`. Weaker, because the affordance text
is in the current UI language sitting next to a foreign endonym, which is mild mixed
language.

**(c) Never do this – select the language and fall back to English strings.** Direct
5.1 violation and it is the precise pattern the Welsh Language Commissioner's
[AI regulatory policy statement](https://www.welshlanguagecommissioner.wales/media/hscpv33c/20250722-datganiad-polisi-rheoleiddiol-deallusrwydd-artiffisial-ar-gymraeg-saesneg.pdf)
§5.2 lists as likely non-compliance: chatbots that "initially respond in Welsh but
then switch to say that they do not support the language – creating a confusing and
inadequate experience for the user."

Type-level enforcement: `getDictionary` accepts only `Locale`, never `PickerLocale`.
The showcase branch is handled in the picker and can never reach the dictionary.

### Six required fixes to `components/language-picker.tsx`

The current picker is presentation-only and violates the Welsh Government toolkit in
several specific, citable ways. All quotes are from
[Bilingual Technology Toolkit v3](https://www.gov.wales/sites/default/files/publications/2024-11/bilingual-technology-toolkit-for-good-user-experience.pdf)
(Oct 2023, Welsh Government / Helo Blod, OGL v3, endorsed by
[CDPS](https://digitalpublicservices.gov.wales/guidance-and-standards/recommended-standards/standards-catalogue/bilingual-technology-toolkit)).

| #   | Current behaviour                                                                                      | Requirement                                                                                                                                                                                   | Fix                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | Eight inline national-flag SVGs (`FlagIcon`, lines 81–161)                                             | 4.8: **"National flags or other metaphors for language should not be used."** W3C agrees: ["Don't use flags to indicate languages!"](https://www.w3.org/International/questions/qa-link-lang) | Delete `FlagIcon` and the `FlagCode` type. Endonym text only.                                                                                                                                                              |
| L2  | The list always includes the current language, tagged `"Default"`                                      | 4.9: "Any language list will include the alternate language(s), i.e. it will not include the currently selected language."                                                                    | Filter out the active locale.                                                                                                                                                                                              |
| L3  | `"Default"` badge hard-codes English as the default                                                    | 4.1: **"in no situation should the user interface be allowed to default to a one language or another."**                                                                                      | Remove the badge. Negotiate from `Accept-Language` on first visit instead.                                                                                                                                                 |
| L4  | Selecting a row calls `onClose()` and nothing else                                                     | 4.5: "Switching language should reload the same page", maintaining context; 4.7: the choice persists in "a cookie, device setting, other avenue" and must not sit behind a login              | Call the `setLocale` server action, which sets the cookie and revalidates.                                                                                                                                                 |
| L5  | On `/` the picker is a mid-page row inside scrollable content; only `/check-in` puts a globe top-right | 4.3: selector "immediately, equally and consistently available throughout the application"; 4.4: "in the top right area of the interface"                                                     | Put the same top-right control on every screen. If space forces it, 4.3 permits `CY` / `EN` on small screens **with the exception documented**, and 4.8 requires the full language name to be available to screen readers. |
| L6  | Rows are `px-3 py-2` on `text-sm` ≈ **36px** tall; the `LanguageGlobe` trigger is `size-10` = **40px** | `CLAUDE.md` ≥44px; WCAG 2.5.5 AAA 44×44                                                                                                                                                       | Raise both to ≥44px.                                                                                                                                                                                                       |

Two more, from the same source, that apply once the list is real:

- **3.6 sort order.** The Welsh alphabet has digraphs and the toolkit gives the
  bilingual superset order: `a, b, c, ch, d, dd, e, f, ff, g, ng, h, i, j, k, l, ll,
m, n, o, p, ph, q, r, rh, s, t, th, u, v, w, x, y, z`. A naive `Array.sort()` or
  `localeCompare` mis-orders it. At eight hard-coded rows this is a non-issue; it
  becomes one the moment a medication list is sorted.
- **3.4 diacritics must not affect sort order** – "e, ê, é, è and ë are all
  equivalent when sorting."

---

## Welsh specifics

### The tag

**`cy`.** ISO 639-1 two-letter, registered in the IANA language subtag registry
(`Added: 2005-10-16`, `Suppress-Script: Latn`). `Suppress-Script` means **never write
`cy-Latn`**. Syntax authority is [BCP 47 / RFC 5646](https://www.rfc-editor.org/rfc/rfc5646).
The three-letter forms `cym` / `wel` are not valid BCP-47 primary subtags – RFC 5646
§2.2.1: where a language has an ISO 639-1 code, "only the ISO 639-1 two-character code
is defined in the IANA registry."

Use bare `cy` for `<html lang>`. `cy-GB` appears in the Welsh Language Commissioner's
2015 technology guidance §10.1.1 as a _platform locale identifier_ (paired with
Windows LCIDs), in a document that states on its own front matter that it is not a
statutory code of practice. It is harmless as a backend key; it is not what belongs
in the markup.

Markup rules, from [W3C on HTML language declarations](https://www.w3.org/International/questions/qa-html-language-declarations):

> "Always use a language attribute on the html tag to declare the default language of
> the text in the page. This is inherited by all other elements."

> "You should never use a meta element with the http-equiv attribute set to
> Content-Language to indicate the language of a page."

`app/layout.tsx` currently hardcodes `<html lang="en">`. It must become
`<html lang={locale}>`.

### Font subsets – a real, verified bug

Welsh uses the circumflex ("to bach") plus acute, grave and diaeresis on all seven
vowels `a e i o u w y`, upper and lower case: **56 accented characters**. The
[Bilingual Technology Toolkit](https://www.gov.wales/sites/default/files/publications/2024-11/bilingual-technology-toolkit-for-good-user-experience.pdf)
requirement 3.1 says exactly that, and adds:

> "Good test cases are the ŵ and ŷ characters as these are absent in certain encodings."

Verified first-hand against the live Google Fonts CSS for both faces in this repo:

```
/* latin     */ unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6,
                U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122,
                U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
/* latin-ext */ unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7,
                U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F,
                U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F,
                U+A720-A7FF;
```

**13 of the 56 Welsh accented characters fall outside `latin`:**
`ŵ` U+0175, `Ŵ` U+0174, `ŷ` U+0177, `Ŷ` U+0176, `ẃ` U+1E83, `Ẃ` U+1E82, `ẁ` U+1E81,
`Ẁ` U+1E80, `ỳ` U+1EF3, `Ỳ` U+1EF2, `ẅ` U+1E85, `Ẅ` U+1E84, `Ÿ` U+0178. All 13 are in
`latin-ext`. Both **Hanken Grotesk and Newsreader offer a `latin-ext` subset.**

Today `app/layout.tsx` loads `subsets: ["latin"]` for both. Any Welsh word containing
`ŵ` or `ŷ` – `tŷ` (house), `ŵy` (egg), `gŵr`, `cŵn`, `dŷdd`, `ŷd` – renders those two
glyphs from the fallback (`"Helvetica Neue"` / system sans) with a visible weight and
shape mismatch mid-word.

**Fix: `subsets: ["latin", "latin-ext"]` on both `Hanken_Grotesk(...)` and
`Newsreader(...)`.** Highest-confidence, lowest-cost item in this document. Two
independent routes – the live unicode-ranges and Welsh Government guidance – name the
same two codepoints.

### Text expansion and layout

There is no Welsh-specific empirical expansion figure I could verify against a primary
source (see **Could not confirm**). What _is_ citable:

**The magnitude.** [W3C, "Text size in translation"](https://www.w3.org/International/articles/article-text-size)
gives the standard expansion table, and the key point is that **short strings expand
proportionally most** – which is precisely the button-and-label problem:

| Characters in English | Resulting length after translation |
| --------------------- | ---------------------------------- |
| Up to 10              | 200–300%                           |
| 11–20                 | 180–200%                           |
| 21–30                 | 160–180%                           |
| 31–50                 | 140–160%                           |
| 51–70                 | 151–170%                           |
| Over 70               | 130%                               |

> "the smaller the source message, the higher the likely translation length"
> … short UI elements are "likely to be squeezed into a small space, such as alongside
> a form entry field, or inside a graphic, or a set of width restricted tabs."
> … "Allow text to reflow and avoid small fixed-width containers or tight squeezes
> where possible."

**The requirement.** Bilingual Technology Toolkit 5.4:

> "The user interface arrangement must allow for variance of language length. The
> quality of presentation must be the same in either language. **Truncation and loss
> of content mustn't occur.**"

**What that means concretely inside a 390px phone frame.** Short labels are the risk,
and this app is nothing but short labels:

- `"Back"`, `"Send"`, `"Menu"`, `"Default"`, `"Speaking"`, `"Listening"` are all in the
  ≤10-character band. Budget up to 2–3× width for them.
- Buttons must wrap or grow, never truncate. No `truncate` / `text-ellipsis` /
  `line-clamp` on any button label or nav item. `min-h-[3.25rem] w-full` on the
  primary CTA (as `IdleView` already uses) is the right shape because it grows
  vertically; a fixed-width pill is not.
- The two home action cards put a `text-xl` title next to a fixed `size-10` icon and a
  chevron inside a 390px column. `"Start today's check-in"` in Welsh will be longer.
  Test with the real Welsh strings, not with lorem.
- The composer capsule is `flex-1` with `min-w-0` on the input – correct.
  `SuggestedQuestions` rows already use `min-w-0`. Keep that pattern.
- Acceptance test: render every screen with the Welsh dictionary at 320px width
  (WCAG 1.4.10 Reflow) and confirm nothing truncates and nothing scrolls horizontally.

### Statutory and policy layer (design target, not a legal duty for a prototype)

Juno is a hackathon prototype, not a body designated under a compliance notice, so
none of the below binds it. It is the right standard to design toward and it is what a
judge with an NHS background will recognise.

- **Welsh Language (Wales) Measure 2011 s.1** –
  [legislation.gov.uk](https://www.legislation.gov.uk/mwa/2011/1/section/1) – Welsh has
  official status, effected through "the treatment of the Welsh language no less
  favourably than the English language."
- **Welsh Language Standards (No. 7) Regulations 2018, WSI 2018/441** –
  [Schedule 1](https://www.legislation.gov.uk/wsi/2018/441/schedule/1/made) – applies to
  Local Health Boards and NHS Trusts in Wales. Standard 39: every page's text available
  in Welsh, fully functional, no less favourable. Standard 43: "You must provide the
  interface and menus on every page of your website in Welsh." **Standard 44 is the
  governing clause for an app:** "All apps that you publish must function fully in
  Welsh, and the Welsh language must be treated no less favourably than the English
  language in relation to that app."
- **Separate per-language routes are explicitly lawful and co-location is not
  required.** Sched. 1 Pt. 3 para 49: parity covers "the visual presentation of the
  material … or when material is published", "but it does not mean that Welsh language
  material must appear on the same page as English language material, or on a page
  that a person is likely to find before the English language page when searching."
  The "Welsh positioned to be read first" rule is a physical-signage rule (Standard 48)
  and does **not** carry over to web or app. Do not over-apply it.
- **Digital Service Standard for Wales** –
  [CDPS](https://digitalpublicservices.gov.wales/guidance-and-standards/digital-service-standard-wales)
  – "You need to design and build services that promote and ease the use of Welsh and
  treat those who speak it equally with those who speak English." Point 2 is "be
  bilingual by design". Still in public beta.
- **Bilingual Technology Toolkit v3** (all the 1.x–8.x requirements quoted above) –
  note its Priority column is deliberately blank: the procuring body sets Must/Should/
  Could, so these are contractual-when-imposed rather than self-mandatory.
- **Translation quality.** Toolkit 1.3: "translation should only be provided by an
  accredited translator … the translator must be a member of a recognised translation
  organisation." Toolkit 2.3 detail: "translation is a technical skill and should only
  be undertaken by competent and qualified human translators." Toolkit 1.6: language
  quality testing "should be performed by qualified speakers of each language." The
  Commissioner's
  [bilingual drafting guidance](https://www.welshlanguagecommissioner.wales/media/cdgi5g0i/bilingual-drafting-translation-and-using-welsh-face-to-face.pdf)
  §5.8: "a translation produced by machine should certainly not be published without
  it being edited thoroughly by a human translator." The Commissioner's
  [AI regulatory policy statement](https://www.welshlanguagecommissioner.wales/media/hscpv33c/20250722-datganiad-polisi-rheoleiddiol-deallusrwydd-artiffisial-ar-gymraeg-saesneg.pdf)
  (22 July 2025) §5.2 names three patterns as likely non-compliance, and all three are
  live risks for this build: automated translation without human review; chatbots that
  start in Welsh then switch to say they do not support it; and "monolingual voice
  support: voice recognition or automated response systems that function effectively in
  English only, excluding Welsh-speaking users."

  **Practical instruction for the spec:** LLM-drafted Welsh is fine for a 24h
  prototype, but say so out loud in the pitch and have Raf or any Welsh speaker on site
  eyeball the ~55 strings. Never claim the Welsh is production-ready.

### Plain Welsh is not translated plain English

**Cymraeg Clir** (Cen Williams, 1999; Canolfan Bedwyr, Bangor University; free PDF at
[bangor.ac.uk](https://www.bangor.ac.uk/sites/default/files/2025-05/CymraegClir.pdf),
overview at [bangor.ac.uk/canolfan-bedwyr/cymraegclir](https://www.bangor.ac.uk/canolfan-bedwyr/cymraegclir)).
Twelve rules. The load-bearing ones:

> 3. "Use the natural words, phrases and structure of the Welsh language."
> 4. "Use short sentences. (no more than 25 words per sentence)."
> 5. "Keep to the principle: 'one sentence – one idea'."
> 6. Active verbs — `Dechreuodd y cyngor 50 o brojectau`, not
>    `Dechreuwyd 50 o brojectau gan y cyngor`.

Its own problem statement is exactly this project's risk: "A common complaint in Wales
is that the Welsh versions of these documents are 'too difficult to read and use', and
Welsh speakers often turn to the English versions in despair."

One rule is specifically a UI rule: **on posters and forms, phrase things to avoid
mutation where possible.** That matters the moment you interpolate a variable into a
Welsh string, because Welsh initial-consonant mutation makes naive concatenation
ungrammatical. Practical consequence for the dictionary shape: prefer whole sentences
per key over templated fragments; where a value must be interpolated, put it at the
end or in a separate visual slot.

Cymraeg Clir is a university-published practice standard, not government law. Cite it
as practice. Note also that standard English readability formulas (Flesch, SMOG,
Gunning Fog) are calibrated on English and do not transfer to Welsh – syllable counting
in particular breaks down. Do not run a Flesch score on the Welsh strings and claim a
reading age.

---

## Plain-language & accessibility checklist

Numbered so the spec can reference items directly. Every item is checkable and carries
a source. Where two sources disagree, the stricter is taken and the choice is stated.

### A. Reading level and copy

**1. Target reading age 9, with an explicit fallback for clinical detail.**
[Home Office UCD manual](https://design.homeoffice.gov.uk/accessibility/written-content/readability):
"Usually we recommend writing for a maximum reading age of 9, even if you are writing
for a specialist audience." NHS is slightly softer and more honest about medical
content – [NHS service manual, "How we write"](https://service-manual.nhs.uk/content/how-we-write):
"We aim for a reading age of 9 to 11 years old. But we recognise that, with some
medical information, it's not easy to achieve this. In this case, try to make sure that
an 11 to 14-year old will understand." **Design to 9; accept 11 only where a
medication or red-flag instruction cannot be simplified further without losing
accuracy.** The existing `CHECK_IN_PROMPT` already says "Explain things at roughly a
reading age of nine" – keep it, and translate it.

**2. Sentences ≤20 words in English, ≤25 in Welsh.**
NHS: "We use short sentences of up to 20 words."
[GOV.UK / Inside GOV.UK](https://insidegovuk.blog.gov.uk/2014/08/04/sentence-length-why-25-words-is-our-limit/):
"if you have sentences longer than 25 words, try to break them up or condense them",
with the evidence: "when average sentence length is 14 words, readers understand more
than 90% of what they're reading. At 43 words, comprehension dropped to less than 10%"
and "sentences of 11 words are considered easy to read, while those of 21 words are
fairly difficult. At 25 words, sentences become difficult, and 29 words or longer, very
difficult." Cymraeg Clir rule 4 gives ≤25 for Welsh. **Take NHS's 20 for English as
the stricter number; 25 for Welsh because that is the Welsh-specific guidance.**

**3. Paragraphs ≤3 sentences.** NHS: "We use short paragraphs of up to 3 sentences."

**4. Active voice.** NHS: "We use the active voice, for example 'find a pharmacy'
rather than 'a pharmacy can be found'." Cymraeg Clir rule 6 says the same for Welsh.

**5. Short words over long ones.** NHS: "We use short words. For example, we prefer
'have' or 'get' to 'experience' in phrases like 'if you experience headaches'."

**6. Plain English term first, medical term second – never the other way round.**
NHS: "We avoid medical jargon and technical terms. We do use medical terms to help with
understanding and search, but explain them when they're not commonly known. We use a
plain English term first, then the medical term." For Juno this bans raw NHS discharge
abbreviations (TTO, BD, OD, PRN, DVT, VTE) in the UI. Expand them: "twice a day", not
"BD".

**7. Never use negative contractions. This is a safety rule, not a style rule.**
[NHS punctuation](https://service-manual.nhs.uk/content/punctuation): "We use
contractions like you'll, we'll, you're and what's. … Do not use negative contractions
like can't and don't. When you're telling users not to do something, use 'Do not'
rather than 'Don't'." Rationale, same page: "GDS research shows that many users find
negative contractions harder to read and they sometimes misread them as the opposite of
what they say." For an app that will say "do not take a double dose", this is
load-bearing.

**8. No block capitals.** NHS punctuation: "We do not use block capitals as they're
difficult for people to read." This also kills the `uppercase tracking-[0.18em]` "404"
label in `app/not-found.tsx`, and matches `haider-design-taste` typography.md ("Never
use uppercase or tracking utilities … on any text").

**9. Numerals for numbers, including 1 and 2.**
[NHS numbers, measurements, dates and time](https://service-manual.nhs.uk/content/numbers-measurements-dates-time):
"We use numerals for numbers (including 1 and 2), for example when we're talking about
statistics, time, measurements, lists, points or steps." Exception: "We spell out 'one'
when it means 'a' or to avoid repeating a word" – their own example is straight out of
this problem domain: "Never take 2 doses at the same time to make up for a forgotten
one." Numbers over 999 take a comma.

**10. Times: 12-hour only, in the NHS format.** Use `5pm`, `5:30pm`, `midnight`,
`midday`. Do **not** use `5.00pm`, `1700hrs`, `5.30pm`, `1730hrs`, `00:00`, `12am`,
`12 noon`, `12pm`. The reason is numeracy, not style: the
[NHS Health Literacy Toolkit](https://library.nhs.uk/wp-content/uploads/sites/4/2023/06/Health-Literacy-Toolkit.pdf)
Tool 1 maps numeracy levels to capability, and Entry 3 (age 9–11) is "Able to understand
simple instructions about medicines including dose and timing e.g. take 5ml three times
a day after food" **but not a 24-hour clock**. A 24-hour clock excludes the exact user
this product is for.

**11. Dates spelled out.** "6 August 2018", or "Wednesday 6 August 2018". "As far as
possible, spell out months in full." Generate them with `Intl.DateTimeFormat(locale)`,
not a hardcoded format (Web Interface Guidelines, Locale & i18n).

**12. Doses.** No space between amount and measurement: `250mg to 500mg`. Avoid
adjacent numerals: "one or two 200mg tablets 3 times a day", not "1 or 2 200mg tablets
3 times a day". Use decimals for dosage: `0.5mg`. All from the NHS numbers page.

**13. Risk and quantity: natural frequencies, absolute risk, consistent denominators,
both framings.** [NICE NG197 Shared decision making](https://www.nice.org.uk/guidance/ng197)
§1.4.7–1.4.11: "Use absolute risk rather than relative risk"; "Use natural frequencies
(for example, 10 in 100) rather than percentages (10%)"; "Be consistent when using
data. Use the same denominator when comparing risk"; "Use both positive and negative
framing." NHS agrees on percentages: "it's often better not to use a percentage.
Instead of 50%, for example, you could say '1 in 2' or 'half'." **Corollary: no
percentage-based pain or symptom slider.** The NHS toolkit places "able to give a
percentage of time that they have been pain free in the previous 24 hours" at Level 2
(GCSE grade 4–9), and the same source records that "78 in 100 adults in the UK (78%)
are below numeracy level 2." Use a 3-to-5-point worded scale with icons instead.

**13a. Health-literacy evidence to quote, correctly attributed.** The NHS page states
the figures without a citation; the primary source is
[Rowlands G, Protheroe J, Winkley J, et al., _Br J Gen Pract_ 2015; 65(635): e379–e386](https://bjgp.org/content/65/635/e379):
"2515/5795 participants (43%) were below the text-only threshold, while 2905/4767 (61%)
were below the text + numeracy threshold." The population is **English working-age
adults**, and the same paper found older people (45–65) had higher odds of falling
below the threshold – so 43% is a floor, not an estimate, for a post-discharge elderly
cohort. Cite Rowlands, not "the NHS says".

**14. Precision over vagueness.** NHS "How we write" gives a ready-made rubric for
discharge instructions: say "It takes X weeks to get an appointment", not "It can take
a long time"; "4 out of 5 people recover fully in a week", not "You have a good chance
of recovery"; "stomach ache, cramps, feeling sick, diarrhoea", not "upset stomach".

**15. Age phrasing.** [NHS inclusive content – age](https://service-manual.nhs.uk/content/inclusive-content/age):
"When the exact age is important, do not write 'adults over 50' … Instead, make it
clear who's included, for example: 'adults aged 50 and over'" and "Do not use dashes
between ages. Use 'aged 4 to 16 years', not '4 – 16 years'." Also never "suffering
from", "afflicted by", "victim of", "confined to a wheelchair".

**16. Error messages: what happened plus how to fix it, in plain words.**
[GOV.UK Design System error message](https://design-system.service.gov.uk/components/error-message/):
"explain what went wrong and how to fix it". Banned: technical jargon ("form post
error", "unspecified error", "error 0x0000000643"); "forbidden", "illegal", "you
forgot", "prohibited"; "please" ("because it implies a choice"); "sorry" ("because it
does not help fix the problem"); "valid" and "invalid"; humour and "oops". Also: "Use
the same message next to the field and in the Error summary component so they look,
sound and mean the same, make sense out of context, reduce the cognitive effort needed
to understand what has happened."

Applied to the three error strings already in `voice-session.tsx`: "Microphone access
was blocked. Allow the microphone and try again." is good (names the problem, names the
fix). "Something went wrong starting the conversation." is exactly what both GOV.UK and
`haider-design-taste` copy-voice.md forbid – rewrite to name the object and offer the
action. "Could not start the conversation. Please try again." must drop "Please".

**17. Empty states: one sentence, one action.** `haider-design-taste` patterns.md and
copy-voice.md. `app/(phone)/plan/page.tsx` currently reads "Nothing here yet – this is
where the day-by-day timeline goes", which is developer scaffolding, not an empty
state. Replace it with what belongs there plus one action.

**18. Teach-back, phrased as a check on the explanation.** NICE NG197 defines it: "The
teach back method is a useful way to confirm that the information provided is being
understood by getting people to 'teach back' what has been discussed … This is more
than saying 'do you understand?'" and pairs it with chunk-and-check: "break down
information into smaller, more manageable chunks rather than providing it all at once."
NG197 §1.2.11 requires both. The NHS toolkit gives the phrasing rule – "It's important
to phrase questions in a way that doesn't make people feel they are being 'tested'" –
and the evidence: patients "immediately forget 40-80% of the medical information they've
been given and nearly 50% of the information they do 'remember' is incorrect."

**This is a direct instruction for the voice agent's system prompt in both languages:
after each instruction, ask one teach-back question framed as a check on Juno's own
explanation, not on the patient.** For example: "Just so I know I explained that
clearly, when are you taking the next one?"

**19. Universal precautions.** The WHO framing NHS adopts: "take 'universal
precautions' … offering support to everyone, rather than assuming some people will
understand and others won't." No "simple mode" toggle. The plain version is the only
version.

### B. Structure, density and controls

**20. One thing per screen.** [GOV.UK service manual, form structure](https://www.gov.uk/service-manual/design/form-structure):
split "across multiple pages with each page containing just one thing, for example: one
piece of information you're telling a user, one decision they have to make, one question
they have to answer", because it helps users "focus on the specific question and its
answer", "use the service on a mobile device" and "recover easily from form errors".
For Juno: the check-in is a conversation, which is one-thing-per-turn by nature –
protect that. Do not add a dense multi-field adherence form.

**21. Icon plus word, never icon alone.** [W3C COGA, Making Content Usable](https://www.w3.org/TR/coga-usable/)
Objective 1 pattern "Use Icons that Help the User", with the user quote: "I need symbols
placed above the text to link the meaning of the words with the images." The codebase
mostly gets this right (`SuggestedQuestions` pairs `IconChat` with the question text;
the home cards pair `IconMic`/`IconDoc` with a title). The exceptions are the
icon-only controls: `LanguageGlobe`, `BackButton`, the `Menu` link and the composer's
`IconPlus`/`IconClose` buttons. All have `aria-label`, which satisfies screen readers,
but a globe glyph alone does not communicate "change language" to a low-literacy user
looking at the screen. **Pair the language control with the word `Cymraeg` / `English`**
(which Bilingual Technology Toolkit 4.8 requires anyway) and pair `Back` with a word or
give it a much larger target.

Note the field observation from the second planning meeting supports this: "if it
literally says close and there's like a big cross, you know what to do." Icon plus word
is the design principle that generalises it.

**22. COGA's eight objectives, as the structural frame.**
[w3.org/TR/coga-usable](https://www.w3.org/TR/coga-usable/): (1) Help Users Understand
What Things are and How to Use Them; (2) Help Users Find What They Need; (3) Use Clear
and Understandable Content; (4) Help Users Avoid Mistakes and Know How to Correct Them;
(5) Help Users Focus; (6) Ensure Processes Do Not Rely on Memory; (7) Provide Help and
Support; (8) Support Adaptation and Personalization. The patterns that bind hardest
here: "Use Clear Words", "Use Literal Language" (no metaphor, no idiom, no jokes – COGA
warns users "may misunderstand jokes and metaphors"), "Keep Text Succinct", "Separate
Each Instruction" (one idea per block), "Use White Spacing", "Use a Consistent Visual
Design", "Clearly Identify Controls and Their Use", "Ensure Controls and Content Do Not
Move Unexpectedly", "Let Users Go Back", "Avoid Data Loss and 'Timeouts'", "Provide
Feedback".

**23. Do not rely on memory, and do not impose time limits.** COGA Objective 6 and the
pattern "Avoid Data Loss and 'Timeouts'". Concretely: never require the patient to
remember what the agent said two turns ago; keep the transcript visible (it already is);
never auto-end a session on inactivity without warning; never make the user hold a
number in their head between screens.

**24. Left-align. No justified text.** [NHS formatting](https://service-manual.nhs.uk/content/formatting):
"Left-align text in English. Some people with cognitive differences have difficulty
with blocks of text that are justified."

**25. Bullets: one sentence each, never ending in "and"/"or". Avoid links that open new
tabs.** NHS formatting: "Do not include more than 1 sentence at each bullet point";
"Avoid ending a bullet point with 'and' and 'or'"; "Avoid using links or buttons that
open new tabs or windows" (two exceptions only, and if unavoidable the link text must
include "(opens in new tab)"). Also: `<b>`/`<strong>`/`<i>`/`<em>` are not announced
differently by default, so "users may miss anything you wanted to express by using
them" – never carry meaning by weight or italics alone.

### C. WCAG 2.2 conformance floors

WCAG 2.2 became a W3C Recommendation on 5 October 2023
([What's New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)).
SC 4.1.1 Parsing was made obsolete and removed. The nine new criteria are 2.4.11, 2.4.12,
2.4.13, 2.5.7, 2.5.8, 3.2.6, 3.3.7, 3.3.8, 3.3.9.

**26. `lang` on `<html>`, and `lang` on any foreign-language part.** WCAG 3.1.1
Language of Page (A) and 3.1.2 Language of Parts (AA). Today `app/layout.tsx` is
`<html lang="en">` unconditionally. It must track the locale. And when the Welsh UI
shows an English word – a drug brand name, "NHS", "111" – or when the showcase panel
shows Polish, wrap it: `<span lang="en">` / `<div lang="pl">`. Related, from the Web
Interface Guidelines: put `translate="no"` on brand names and identifiers ("Juno",
"NHS", "111", "999", medication names) so browser auto-translate does not garble them.

**27. Target size.** Two criteria, both cited exactly:
[SC 2.5.8 Target Size (Minimum), **Level AA**](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html):
"The size of the target for pointer inputs is at least **24 by 24 CSS pixels**", with
five exceptions (Spacing, Equivalent, Inline, User Agent Control, Essential).
[SC 2.5.5 Target Size (Enhanced), **Level AAA**](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html):
"at least **44 by 44 CSS pixels**", with four exceptions (Equivalent, Inline, User Agent
Control, Essential). **`CLAUDE.md` already mandates ≥44px, which is the AAA bar. Hold
it.** Current violations found in the repo:

| Control                   | File                      | Size                            | Verdict  |
| ------------------------- | ------------------------- | ------------------------------- | -------- |
| `LanguageGlobe` trigger   | `language-picker.tsx:324` | `size-10` = 40px                | under 44 |
| Language menu rows        | `language-picker.tsx:218` | `px-3 py-2` on `text-sm` ≈ 36px | under 44 |
| "See more languages"      | `language-picker.tsx:234` | `py-2` on `text-sm` ≈ 36px      | under 44 |
| `BackButton`              | `back-button.tsx`         | `size-10` = 40px                | under 44 |
| `Menu` link               | `voice-session.tsx:292`   | `size-10` = 40px                | under 44 |
| Composer submit           | `composer.tsx:69`         | `size-9` = 36px                 | under 44 |
| End-session X             | `composer.tsx:82`         | `size-11` = 44px                | passes   |
| Home action cards         | `page.tsx:41`             | `px-5 py-4` on `text-xl`        | passes   |
| `SuggestedQuestions` rows | `suggested-questions.tsx` | `min-h-[3.25rem]` = 52px        | passes   |
| Primary CTA               | `voice-session.tsx:392`   | `min-h-[3.25rem]` = 52px        | passes   |
| "Type instead"            | `voice-session.tsx:400`   | `min-h-11` = 44px               | passes   |

**28. Contrast.** [SC 1.4.3 Contrast (Minimum), AA] 4.5:1 for normal text, 3:1 for
large text (≥18.66px bold or ≥24px). SC 1.4.6 (AAA) is 7:1 / 4.5:1. SC 1.4.11 Non-text
Contrast (AA) is 3:1 for UI components and graphical objects.
[W3C older-users guidance](https://www.w3.org/WAI/older-users/developing/) points
explicitly at the AAA 7:1 figure for this cohort. Given the audience, **target 7:1 for
body copy where the palette allows** – `ink` (17.1:1) and `ink-muted` (8.8:1) both clear
it. Do not use `ink-faint` for text at all (2.74:1). See the measured table under
Existing design vocabulary.

**29. Colour is never the only carrier.** WCAG 1.4.1 Use of Color. Medication state
("taken", "due", "missed") must be a word plus a shape, not a green or amber dot. This
also lands on `/design-taste-frontend` §9.F, which bans decorative status dots outright.

**30. Text resize and reflow.** SC 1.4.4 Resize Text (AA): 200% without loss of content
or functionality. SC 1.4.10 Reflow (AA): usable at **320 CSS px** width without
two-dimensional scrolling. SC 1.4.12 Text Spacing (AA), verbatim: "no loss of content or
functionality occurs by setting … Line height (line spacing) to at least 1.5 times the
font size; Spacing following paragraphs to at least 2 times the font size; Letter
spacing (tracking) to at least 0.12 times the font size; Word spacing to at least 0.16
times the font size."
([w3.org](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html)) The body
`line-height: 1.6` in `globals.css` already clears the 1.5 floor. The 320px reflow test
is the one that will bite: it is also the Welsh-expansion acceptance test.

**31. Minimum text size for this audience.** No WCAG SC sets an absolute minimum, but
`text-xs` (12px) is used today for the "Default" label, the `VoiceStatusLine`, and the
status-bar time. **Set a floor of 16px for anything a patient must read, and 14px for
incidental chrome.** Never 12px. The body base is already 17px; the gap is that no
`--text-*` tokens exist so Tailwind stock sizes take over. Consider defining
`--text-*` in the `@theme` block so the scale is deliberate rather than inherited.

**32. Focus.** SC 2.4.7 Focus Visible (AA); SC 2.4.11 Focus Not Obscured (Minimum) (AA,
new in 2.2) – "Ensure when an item gets keyboard focus, it is at least partially
visible"; SC 2.4.13 Focus Appearance (AAA) – "Use a focus indicator of sufficient size
and contrast". The repo is inconsistent: `page.tsx` and the language trigger use
`focus-visible:outline-2 outline-offset-2 outline-accent` (good); `SuggestedQuestions`
uses only `focus-visible:border-accent`, a 1px colour change (weak, and under the AAA
2px perimeter); `BackButton`, `LanguageGlobe`, the `Menu` link and the composer buttons
have no focus style at all and fall back to the UA default. **Standardise one
`focus-visible` treatment across every interactive element**, and never `outline-none`
without a replacement (Web Interface Guidelines, Focus States).

**33. Reduced motion.** `prefers-reduced-motion` appears **nowhere in the repo**, yet
`animate-pulse` runs on an infinite loop on the orb's three blobs and glow
(`orb.tsx`), the six listening dots, the three thinking dots (`transcript.tsx`) and the
live caret. Web Interface Guidelines: "Honor `prefers-reduced-motion` (provide reduced
variant or disable)". `/design-taste-frontend` §6.B calls it non-negotiable above
MOTION_INTENSITY 3. WCAG 2.3.3 Animation from Interactions is AAA, and WCAG 2.2.2
Pause, Stop, Hide (A) applies to content that "starts automatically, lasts more than 5
seconds, and is presented in parallel with other content". **The orb is a persistent
auto-animating element next to text the user is reading.** Add a
`@media (prefers-reduced-motion: reduce)` block in `globals.css` that stops the pulse
and keeps the state legible through the existing text label (`Speaking` / `Listening`),
which already exists via `aria-live="polite"` and covers the information need.

**34. Other WCAG 2.2 additions that apply.** 3.2.6 Consistent Help (A) – put the
"call 111" / "call your care team" escape in the same place on every screen; the
planning docs already call this "universal fallback always one tap". 3.3.7 Redundant
Entry (A) – never ask the patient for something they already told the voice agent.
2.5.7 Dragging Movements (AA) – no drag-only interaction; if a slider appears, give it
tap targets. 3.3.8/3.3.9 Accessible Authentication – not applicable, there is no login,
and note Bilingual Technology Toolkit 4.7 forbids putting the language preference
behind a login anyway.

**35. Screen-reader and semantic basics already in place – keep them.** Every icon-only
button carries `aria-label`; every decorative glyph carries `aria-hidden`; the voice
status uses `aria-live="polite"`; errors use `role="alert"`; navigation uses `<Link>`
and actions use `<button>`; the transcript uses semantic `<p>`; the menu uses
`role="menu"` / `role="menuitem"`. Two gaps: there is no skip link, and the language
menu is `role="menu"` without arrow-key navigation (it renders `<button>`s in a `<ul>`,
so Tab works but the ARIA contract implies arrow keys).

### D. Showcase-only languages

**36.** See **i18n RECOMMENDATION → How the six showcase-only languages degrade**.
Summarised as a checkable rule: _no screen may ever contain two languages at once; a
showcase language must produce a wholly in-language panel offering the two real
locales; a silent English fallback is forbidden._ Source: Bilingual Technology Toolkit
5.1, reinforced by the Welsh Language Commissioner's named non-compliance pattern for
chatbots that "initially respond in Welsh but then switch to say that they do not
support the language".

---

## Merged anti-slop checklist

`CLAUDE.md`'s banned list, enumerated from the source (not paraphrased), merged with
the three design skills. **Where they conflict, `CLAUDE.md` wins and the conflict is
named.**

### `CLAUDE.md`, "UI & Design → Banned (these are the AI tells)", verbatim

> Inter / Geist / Roboto / Open Sans — _and_ Satoshi / General Sans / Clash Display /
> Bricolage Grotesque / Fraunces; any monospace in the UI; gradients as decoration;
> `rounded-xl` everything; glassmorphism / `backdrop-blur`; drop-shadow soup;
> three-feature-cards-with-icons grids; Heroicons; emoji bullets.

Plus, from the same section and the Frontend section, the rules that function as bans:
raw hex in components; `"use client"` on a page or layout; `as` to silence type errors;
`useEffect` data fetching; barrel `index.ts` re-export files; `any`; `dvh`/`vh` inside
the phone shell; premature abstraction.

### The merged list

| #   | Rule                                                                                                                                                                                                                         | Source                                                                                                                         | Conflict note                                                                                                                                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | **Fonts: Hanken Grotesk only, with Newsreader italic held for editorial accents.** No Inter, Geist, Roboto, Open Sans, Satoshi, General Sans, Clash Display, Bricolage Grotesque, Fraunces.                                  | `CLAUDE.md`                                                                                                                    | **Overrides** `haider-design-taste` non-negotiables ("Inter/Geist as the practical default") and typography.md, and **overrides** `/design-taste-frontend` §4.1 (which recommends Geist, Outfit, Cabinet Grotesk, Satoshi). Both agree on banning Fraunces.                                                                |
| S2  | **No monospace anywhere in the UI.** Tabular figures come from `.tnum`.                                                                                                                                                      | `CLAUDE.md`                                                                                                                    | **Overrides** `haider-design-taste` typography.md Stack ("A monospace … for code, IDs, and technical values") and `/design-taste-frontend` §7 ("VISUAL_DENSITY 8-10: Mandatory `font-mono` for all numbers").                                                                                                              |
| S3  | **No gradients as decoration.** The orb's radial gradient in `orb.tsx` is the single sanctioned exception.                                                                                                                   | `CLAUDE.md`                                                                                                                    | Agrees with `haider-design-taste` ("No gradients in chrome") and `/design-taste-frontend` §4.2 (the LILA rule, no AI-purple glows). No conflict.                                                                                                                                                                           |
| S4  | **No glassmorphism, no `backdrop-blur`.**                                                                                                                                                                                    | `CLAUDE.md`                                                                                                                    | **Overrides** `/design-taste-frontend` §5 and Appendix C, which offer a glassmorphism / "Liquid Glass approximation" recipe for premium-consumer briefs. Do not import it.                                                                                                                                                 |
| S5  | **No drop-shadow soup.** One shadow token: `shadow-card`.                                                                                                                                                                    | `CLAUDE.md`                                                                                                                    | **Partial conflict** with `haider-design-taste` "Border or shadow?", which says in-flow cards get a hairline border and **never** a shadow. `globals.css` says the opposite in its own comment: "cards are shadow-defined, not ruled". `CLAUDE.md` wins; cards use `shadow-card`.                                          |
| S6  | **No `rounded-xl` everything.** Use the three named radii: `rounded-tactile` 12, `rounded-card`/`rounded-bubble` 16, `rounded-pill` for capsules and the orb.                                                                | `CLAUDE.md`                                                                                                                    | **Overrides** `haider-design-taste` density-layout.md ("Radii 4–8px … No pills except avatars and count badges; `9999px` on anything else is a violation"). Satisfies `/design-taste-frontend` §4.4 Shape Consistency Lock.                                                                                                |
| S7  | **No three-feature-cards-with-icons grid.**                                                                                                                                                                                  | `CLAUDE.md`                                                                                                                    | Reinforced by `/design-taste-frontend` §9.C ("NO 3-column equal feature cards"). No conflict.                                                                                                                                                                                                                              |
| S8  | **No Heroicons, and no icon library at all.** Extend `components/icons.tsx` in its existing register: 16px grid, `strokeWidth` 1.4–1.75, `currentColor`, `aria-hidden`, round caps and joins.                                | `CLAUDE.md` + the file's own comment                                                                                           | **Overrides** `/design-taste-frontend` §3.C, which says "NEVER hand-roll SVG icons" and prescribes Phosphor / HugeIcons / Radix / Tabler. Adding a library here would be scope creep and would drag in a house style.                                                                                                      |
| S9  | **No emoji, anywhere – bullets, UI chrome, copy.**                                                                                                                                                                           | `CLAUDE.md` + `haider-design-taste` copy-voice.md + `/design-taste-frontend` §3.D                                              | All three agree.                                                                                                                                                                                                                                                                                                           |
| S10 | **No `dvh`/`vh` inside the phone shell.** Fill with `flex min-h-0 flex-1 flex-col`.                                                                                                                                          | `CLAUDE.md` "The phone shell"                                                                                                  | **Directly overrides** `/design-taste-frontend` §3.E: "NEVER use `h-screen` … ALWAYS use `min-h-[100dvh]`". Following the skill here would push content through the bezel. This is the single most dangerous skill/project conflict in the set.                                                                            |
| S11 | **No raw hex in a component.** Semantic tokens only.                                                                                                                                                                         | `CLAUDE.md`                                                                                                                    | Agrees with `haider-design-taste` ("Components reference semantic tokens … never raw palette values"), but the **token vocabulary is Juno's** (`surface`, `ink`, `rule`, `accent`), **not** shadcn's (`--background`, `--foreground`, `--muted-foreground`, `--border`).                                                   |
| S12 | **No component library.** No shadcn, no Radix Themes, no Base UI, no Material.                                                                                                                                               | Track constraint + `CLAUDE.md` "follow the patterns already here"                                                              | **Overrides** `haider-design-taste` non-negotiables ("Base UI primitives first for any new interactive component") and its `haider-ui-components` pointer, and `/design-taste-frontend` §2.A.                                                                                                                              |
| S13 | **Motion: 120–200ms, ease-out, opacity and small translate only.** Nothing else animates.                                                                                                                                    | `CLAUDE.md`                                                                                                                    | Tighter than `haider-design-taste`'s table (which allows 240ms for modals). Take 200ms. **Overrides** all of `/design-taste-frontend` §5 (GSAP, ScrollTrigger, sticky-stacks, horizontal pans, marquees, magnetic physics, spring overshoot) – none of which belongs in a phone product UI and none of which is installed. |
| S14 | **No `transition: all`. List properties.** No built-in `ease-in`. No bouncy overshoot.                                                                                                                                       | Web Interface Guidelines + `haider-design-taste`                                                                               | The repo currently uses bare `transition` (which is `transition: all`-adjacent shorthand) in `page.tsx:41` and `language-picker.tsx:265`. Narrow both to the properties actually changing.                                                                                                                                 |
| S15 | **Honour `prefers-reduced-motion`.**                                                                                                                                                                                         | Web Interface Guidelines + `/design-taste-frontend` §6.B + checklist item 33                                                   | **Not satisfied anywhere in the repo today.** Highest-priority motion fix given the audience.                                                                                                                                                                                                                              |
| S16 | **Sentence case everywhere** – titles, buttons, menu items, tabs, labels.                                                                                                                                                    | `haider-design-taste` copy-voice.md + NHS + GOV.UK style                                                                       | **Directly overrides** the Web Interface Guidelines rule "Title Case for headings/buttons (Chicago style)". That is Vercel house style and it loses to both NHS content style and the project's own taste skill.                                                                                                           |
| S17 | **No uppercase, no letter-spacing utilities on text.**                                                                                                                                                                       | `haider-design-taste` typography.md + NHS punctuation ("We do not use block capitals as they're difficult for people to read") | `app/not-found.tsx` currently has `uppercase tracking-[0.18em]` on "404". Fix. Also kills every "eyebrow" pattern `/design-taste-frontend` rations – here they are banned outright, not rationed.                                                                                                                          |
| S18 | **British English. No em-dashes (U+2014).** Spaced en-dash for a break, closed en-dash for a range.                                                                                                                          | `haider-design-taste` copy-voice.md; `/design-taste-frontend` §9.G bans em-dash and en-dash-as-separator                       | **The two skills conflict** on the en-dash. Resolution: **prefer a full stop.** At a reading age of 9, two short sentences beat one dash-joined clause, which makes the conflict moot. If a dash is genuinely needed, use the spaced en-dash per `haider-design-taste`. Never U+2014.                                      |
| S19 | **No ampersands in prose or UI copy.** "Terms and conditions", not "Terms & Conditions".                                                                                                                                     | `haider-design-taste` copy-voice.md                                                                                            | **Overrides** the Web Interface Guidelines rule "`&` over 'and' where space-constrained". "and" is also the plainer word.                                                                                                                                                                                                  |
| S20 | **No exclamation marks. No "Oops", "Uh oh", "Whoops". No "please", "sorry", "successfully", "simply", "just".**                                                                                                              | `haider-design-taste` copy-voice.md + GOV.UK error-message guidance                                                            | Both agree. GOV.UK's reason for banning "please": "it implies a choice".                                                                                                                                                                                                                                                   |
| S21 | **Person: UI chrome is second person; Juno's own speech is first person.** "Your recovery plan" (chrome) vs "I'll talk you through it" (Juno).                                                                               | Deliberate persona split, already in the codebase                                                                              | **Qualifies** the Web Interface Guidelines rule "Second person; avoid first person". Juno is a named companion; its first person is the product. Keep the split consistent and do not let it blur.                                                                                                                         |
| S22 | **No decorative status dots.** A coloured dot conveys nothing on its own.                                                                                                                                                    | `/design-taste-frontend` §9.F + WCAG 1.4.1                                                                                     | The six pulsing `bg-ink-faint` dots in `OrbDock` and the three in `TypingBubble` are a listening/thinking _state_ indicator, which is a legitimate semantic use, and they sit beside a text label. Keep them, but they must stop under reduced motion (S15). Do not add dots elsewhere.                                    |
| S23 | **No fabricated precision, no generic names, no "Acme".**                                                                                                                                                                    | `/design-taste-frontend` §9.D                                                                                                  | Use realistic UK names. The planning doc already does (Margaret, 74; Priya). For the Welsh demo, use a plausible Welsh name and a plausible Welsh place.                                                                                                                                                                   |
| S24 | **No div-based fake screenshots, no hand-rolled decorative SVG illustrations.**                                                                                                                                              | `/design-taste-frontend` §4.8 / §9.E                                                                                           | Applies fully. Note this does **not** extend to the icon set (S8) or the iPhone bezel, which is sanctioned device chrome.                                                                                                                                                                                                  |
| S25 | **Density: this is not a Linear-register data app.** Use the "focused moment" row of `haider-design-taste`'s own density table – generous whitespace, ≥44px controls, 16px+ body – not the 13px / 36px-row compact register. | Audience + `CLAUDE.md` ≥44px                                                                                                   | **Overrides** `haider-design-taste`'s "Compact: ~36px data rows, 32px default controls" and "13px UI / 14px inputs". The skill's own framework licenses this override; state it explicitly so nobody "corrects" the density later.                                                                                         |
| S26 | **Emphasis by weight and colour, not by size or bold.**                                                                                                                                                                      | `haider-design-taste` "How do I emphasise this?"                                                                               | **Live inconsistency to resolve:** `globals.css` sets `h1`–`h4` to weight 600, but `page.tsx`, `plan/page.tsx` and `voice-session.tsx` all override with `font-bold` (700). The skill says 700 is "never in UI chrome". Pick one and apply it across all screens.                                                          |
| S27 | **Light theme only, stated as a scope decision.**                                                                                                                                                                            | `CLAUDE.md` by omission                                                                                                        | **Knowingly violates** `haider-design-taste` ("Light AND dark are first-class from day one … never 'dark mode later'") and `/design-taste-frontend` §6.C / §8. No dark tokens exist in `@theme`. Do not attempt dark mode inside 24 hours; do say it is a deliberate cut.                                                  |
| S28 | **No barrel `index.ts` re-export files. No `any`. Zod only at trust boundaries. `satisfies`, not `as`.**                                                                                                                     | `CLAUDE.md` Frontend                                                                                                           | Applies to the i18n module as designed above.                                                                                                                                                                                                                                                                              |
| S29 | **Long content must handle itself:** `min-w-0` on flex children, no `truncate` on button labels or nav items, wrap rather than clip.                                                                                         | Web Interface Guidelines + Bilingual Technology Toolkit 5.4 ("Truncation and loss of content mustn't occur")                   | Doubly required once Welsh strings land.                                                                                                                                                                                                                                                                                   |
| S30 | **`Intl.*` for every date, time, number and list. Never a hardcoded format.** `translate="no"` on brand names and identifiers.                                                                                               | Web Interface Guidelines, Locale & i18n                                                                                        | Verified working for `cy` in Node 26.                                                                                                                                                                                                                                                                                      |

---

## What changed vs the prior assumption

Deltas against `plan/initial-idea.md`. Meeting 2 in `plan/raw-transcript.md` supersedes
meeting 1 and supersedes the initial-idea doc where they conflict.

1. **Urdu is out. English and Welsh are in. This is the headline change.**
   `plan/initial-idea.md` line 9 pitches "An Urdu-speaking grandmother … gets a phone
   call every morning **in Urdu**", and line 129 makes Urdu the hero-moment demo
   language. Meeting 2 replaces it outright:

   > "what I'm planning to do is actually have two languages completely mapped up with
   > the app. **So English and Welsh** I'm thinking so the idea is like the entire app
   > could be like whatever language you want."

   Urdu survives only as a hypothetical in the same passage ("if you I don't know make
   it urdu … Someone would be if someone only knows Urdu but then I have to read it they
   can still navigate it if the UI itself is clean enough"). **Every UI string and every
   voice interaction must work end to end in `en` and `cy`. Nothing needs to work in
   `ur`.** The initial-idea demo script's step 3 ("the app calls Margaret, in Urdu …
   Priya's phone lights up, in Urdu") must be rewritten for Welsh, including the
   patient and next-of-kin names.

   Welsh is also a materially _better_ choice for a UK health demo than Urdu: it comes
   with a statutory framework (Welsh Language Standards), an official bilingual design
   toolkit, and an NHS Wales context, all of which are cited above. Urdu had none of
   that. Say so in the pitch.

2. **The other six languages are showcase-only, and that must be visible in the
   design, not just in a README.** `components/language-picker.tsx` already carries
   `pl, ro, tr, pt, es, fr` alongside `en, cy`, with a comment that "English + Cymraeg
   are real; the rest signal multilingual reach for the demo". The delta is that a
   silent English fallback is now explicitly ruled out (item 36 / Toolkit 5.1) and a
   concrete degradation design is specified.

3. **"Multilingual by ElevenLabs" is no longer a free assumption.**
   `plan/initial-idea.md` line 3 says the agent "calls the patient in their own
   language" as though language were a parameter. It is a parameter
   (`overrides.agent.language`), but which languages the Agents Platform and the
   underlying TTS/STT models actually support is a hard constraint, and Welsh is not a
   safe assumption for a small language. This is now the top project risk (see
   **Residual risk**).

4. **The voice agent's system prompt is content, not code.** `lib/check-in-prompt.ts`
   holds an English-only persona block that is sent as a per-session override. Under
   the en/cy requirement it becomes a _pair_ of localised documents, and the pair has to
   stay in sync with whatever plan data gets appended to it.

5. **The medic's contribution changed the safety design.** Meeting 2 adds the BNF
   (British National Formulary) as the drug side-effect and red-flag reference, and Raf
   generates the synthetic discharge bundle. The agreed red-flag behaviour is to
   **advise contact, never to act**: "just say, like, we're strongly advising to see
   follow-up". `initial-idea.md`'s "shall I help you call?" offer is at the edge of that
   line. Every red-flag string is high-stakes copy and must clear the plain-language
   checklist in **both** languages.

6. **User education is out of scope and the UI carries the load instead.** Meeting 1
   and meeting 2 both raise elderly onboarding and both resolve it the same way: no
   tutorial, no onboarding videos, a clean enough UI plus translated labels. That
   decision puts the entire usability burden on items 20–25 and 27–33 of the checklist.
   It is a defensible decision only if those items are actually met.

7. **No database, mock data only.** Unchanged from `initial-idea.md` line 109, and
   consistent with the track constraint. Nothing in the i18n recommendation needs
   storage beyond one cookie.

---

## Could not confirm

1. **A Welsh-specific text-expansion figure from a primary source.** A WebFetch summary
   of the Bilingual Technology Toolkit PDF returned "typically 10-15% longer", but I
   read the actual PDF pages and **that figure is not in the document** – it was a
   summarisation artefact. Do not cite it. The document's real requirement is 5.4
   ("Truncation and loss of content mustn't occur"). Industry lists commonly put Welsh
   somewhere around +10–20% against English, but I found no primary source for it in the
   time available. **Use the W3C short-string table instead** (up to 200–300% for
   ≤10-character strings) and treat 5.4 as the acceptance test. A parallel research
   thread separately suggested "~+60%" for short strings; its source was not supplied,
   so it is not published here.
2. **ElevenLabs Welsh support.** Whether `cy` appears in the Agents Platform supported
   language list, and separately in `eleven_multilingual_v2` / `eleven_turbo_v2_5` /
   `eleven_flash_v2_5` / the v3 conversational models, and in Scribe STT. The docs URL I
   tried (`/docs/agents-platform/customization/language`) 404s. **This must be checked
   in the ElevenLabs dashboard before any Welsh voice work starts.** See Residual risk.
3. **Whether `overrides.agent.language` requires the language to be pre-added to the
   agent's "additional languages" list**, and the exact shape and capabilities of
   ElevenLabs `language_presets` (whether they can carry a per-language first message
   and prompt, and whether the dashboard auto-translates the first message).
4. **The NHS Accessible Information Standard.** NHS England states that since August
   2016 all publicly funded health and adult social care services have been required to
   meet it ([england.nhs.uk](https://www.england.nhs.uk/personalisedcare/health-literacy/)),
   but the specification itself was not read. Likely relevant; verify separately.
5. **`hreflang` guidance.** W3C is lukewarm on link-level `<a hreflang>`
   ([qa-link-lang](https://www.w3.org/International/questions/qa-link-lang)) and that
   article does **not** cover `<link rel="alternate" hreflang>` in `<head>`, which is a
   search-engine convention with no W3C or UK primary source behind it. Do not cite W3C
   for the `<head>` form.
6. **Whether Welsh Language Standard 44 would actually be imposed** on any particular
   NHS Wales body – standards bind only via a Commissioner's compliance notice. Moot
   for a prototype; recorded because the pitch may claim compliance.
7. **`next/root-params`** (the Next 16.2 escape hatch for reading a root dynamic
   segment under Cache Components) resolves only on `preview.nextjs.org`, not the stable
   docs. Treat as unstable. It does not help a cookie-only design in any case.
8. **No NHS Wales equivalent of the NHS England content style guide exists.** The Welsh
   stack is Welsh Language Standards (law) → Digital Service Standard for Wales (CDPS,
   beta) → Bilingual Technology Toolkit → Yr Arddulliadur / Cymraeg Clir. For _health
   content style_ you will still be falling back on the England service manual. Flag
   this gap in the spec rather than pretending parity.
9. **Whether Hanken Grotesk's `latin-ext` subset actually contains well-drawn `ŵ`/`ŷ`
   glyphs** (as opposed to merely declaring the range). Visual check required once the
   subset is added.

---

## Residual risk

**R1 – ElevenLabs may not support Welsh, and the failure mode is the worst one
available.** This is the top risk in this track. If `overrides.agent.language: "cy"` is
sent to a model that does not support Welsh, the likely outcome is an agent that opens
in Welsh and degrades to English mid-conversation – precisely the pattern the Welsh
Language Commissioner's AI policy statement §5.2 names as likely non-compliance:
chatbots that "initially respond in Welsh but then switch to say that they do not
support the language – creating a confusing and inadequate experience for the user."
That is also a demo that fails in front of judges. **Mitigation, in order:** (a) check
the supported-language list in the ElevenLabs dashboard _before_ building any Welsh
voice path; (b) if Welsh is supported, run one real end-to-end call early, with the
Welsh system prompt, and listen to it; (c) if Welsh is not supported or the audio is
poor, **do not ship a Welsh voice option at all** – ship Welsh UI plus an honest
in-Welsh note that the voice check-in is English today. A missing feature is
recoverable; a broken bilingual promise is not. Bilingual Technology Toolkit 5.2 puts
this squarely in scope: "Any integrated language support capabilities must have
equivalent resources in each language … screen readers, voice recognition, voice."

**R2 – LLM-drafted Welsh will read as translated English.** Cymraeg Clir's own problem
statement is that Welsh speakers abandon badly-translated Welsh documents "in despair",
and the Commissioner names unreviewed machine translation as likely non-compliance.
Mitigation: keep the string count small (≈55), get a Welsh speaker to read all of them,
and be explicit in the pitch that production would use an accredited translator (Toolkit
1.3). Do not claim the Welsh is production-quality.

**R3 – Welsh text expansion breaks the 390px frame.** The phone shell is fixed-width
and this app is almost entirely short labels, which is the worst case per the W3C table.
Mitigation: build the Welsh dictionary early (not last), and run the 320px reflow test
(WCAG 1.4.10) with real Welsh strings before polishing anything. Never `truncate` a
button label.

**R4 – the `ink-faint` contrast failure is systemic, not local.** It appears in six
places and is 2.74:1 against white. Fixing it means either demoting the token or
darkening it, and darkening it changes the look of every screen. Decide once, early;
do not patch it per-component.

**R5 – reduced motion is entirely absent and the orb is the product's signature.**
Adding `prefers-reduced-motion` late risks either breaking the orb or being skipped.
Do it as a single `@media` block in `globals.css` at the same time the orb is next
touched.

**R6 – the language picker is presentation-only today and six separate changes are
needed to make it real** (flags out, current locale filtered out, "Default" badge out,
server action wired in, top-right placement everywhere, 44px targets). It looks finished
and it is not. Budget for it explicitly rather than treating it as a five-minute wire-up.

**R7 – locale must be threaded into the ElevenLabs session inside the user gesture.**
`CLAUDE.md` is emphatic that the start chain `getUserMedia → fetchSignedUrl →
startSession` stays inside the direct tap. The locale and localised prompt must
therefore already be in props before the tap, resolved server-side at render. Do not
fetch or resolve the dictionary inside `connect()`, and do not introduce an effect or a
router transition to pick up a language change; Safari will refuse the mic.

**R8 – cookie reads make every route dynamic.** Accepted, and free at this scale, but
it means no page in the app is statically prerendered. If a later track adds something
that depends on static generation, it will conflict. Recorded so nobody is surprised.

**R9 – two-person build, four grading axes, one of them UI/UX.** The checklist above is
long. If time runs out, the ordered priority is: (1) the `latin-ext` font fix, (2)
`<html lang>` tracking the locale, (3) the 44px target fixes, (4) `ink-faint` contrast,
(5) `prefers-reduced-motion`, (6) the showcase-language degradation panel. Items 1–3
are each under fifteen minutes and each is individually visible to a judge.
