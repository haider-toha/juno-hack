# Typography

Contents: faces · stack · scale · weights · tracking · numerals · casing.

## Faces

**Practical default:** Inter or Geist for product UI. Pick one per project and commit to it. Licensed foundry faces below are an optional catalogue when a product needs a more distinctive voice – not required, and never a blocker.

Optional licensed catalogue:

| Face                 | Foundry           | Licence     | Weights held       | Character                                  | Best for                                                           |
| -------------------- | ----------------- | ----------- | ------------------ | ------------------------------------------ | ------------------------------------------------------------------ |
| Untitled Sans        | Klim              | Licensed    | 400                | Deliberately plain, self-effacing          | Product UI that should disappear into the work                     |
| Graphik              | Commercial Type   | Licensed    | 400                | Warm, compact, quietly confident           | Product UI and brand needing a touch more voice                    |
| Scto Grotesk (Light) | Schick Toikka     | Licensed    | 300                | Crisp Swiss grotesk; Light weight licensed | Display and headline moments, not body UI                          |
| IBM Plex Sans        | IBM / Bold Monday | Open source | All (Google Fonts) | Engineered grotesque with a technical edge | Technical, data-heavy products; anywhere the face must ship freely |

Rules: one face per project for UI; Scto Grotesk Light is display-only (a single light weight cannot carry the 400/500 UI system). Licensed font files are project-managed and never committed to public repos; IBM Plex, Inter, and Geist are open / freely shippable and can be bundled anywhere.

Single-weight licences are absorbed honestly, not faked: set `font-synthesis-weight: none` so browsers never synthesise a Medium, and hierarchy comes from colour (`--foreground` vs `--muted-foreground`) instead of weight – per `haider-design-taste` "How do I emphasise this?". Do not pretend at 500 with a Regular-only face.

## Stack

Inter or Geist is the default workhorse. A monospace (IBM Plex Mono, Geist Mono, Berkeley Mono register) for code, IDs, and technical values only – pair IBM Plex Mono with IBM Plex Sans when that family is the pick.

```css
font-family:
  "Inter",
  -apple-system,
  sans-serif;
font-feature-settings:
  "cv05", "cv09"; /* Inter: disambiguated l, curved y – optional, taste */
```

All data displays get tabular numbers:

```css
font-variant-numeric: tabular-nums;
```

## Scale

Small and flat. Dense UIs don't need many sizes – hierarchy comes from weight and colour first (see `haider-design-taste`, "How do I emphasise this?").

| Size     | Line height | Use                                              | Tailwind class |
| -------- | ----------- | ------------------------------------------------ | -------------- |
| 11px     | 16px        | Micro labels, table headers, meta chips          | `text-xs`      |
| 12px     | 16px        | Secondary text, timestamps, badges, kbd hints    | `text-xs`      |
| **13px** | 20px        | **UI default** – body, menus, list rows, buttons | `text-sm`      |
| 14px     | 20px        | Inputs, emphasised body, dialog text             | `text-sm`      |
| 16px     | 24px        | Section titles, card titles                      | `text-base`    |
| 20px     | 28px        | Page titles                                      | `text-xl`      |

Anything above 20px belongs to marketing, not product UI.

**Honest Tailwind note.** The column above is the _target_ scale. Until the project defines custom `--text-*` tokens, `text-xs` / `text-sm` / `text-base` / `text-lg` / `text-xl` render at Tailwind stock px (12 / 14 / 16 / 18 / 20). Use the nearest stock class; the UI default therefore often lands at **14px**, not 13px, until overrides land. Prefer documenting the target scale in project tokens when density is finessed.

## Weights

| Weight  | Use                                                         |
| ------- | ----------------------------------------------------------- |
| 400     | Base text                                                   |
| **500** | Emphasis, headings, buttons, selected items – the workhorse |
| 600     | Only at 20px+, and only when 500 genuinely isn't enough     |
| 700     | Never in UI chrome                                          |

Bold is a shout; a dense interface full of shouts reads as noise. If 500 doesn't create enough hierarchy, fix it with colour (`--foreground` vs `--muted-foreground`), not weight.

## Tracking

Never use uppercase or tracking utilities (`tracking-*`, `letter-spacing`) on any text unless explicitly requested – no uppercase overlines, no letterspaced labels, no uppercase table headers. The only letter-spacing in the system is the defined tight heading tracking below.

| Context        | Letter spacing              |
| -------------- | --------------------------- |
| 13px and below | 0 (Inter is tuned for this) |
| 16px titles    | -0.01em                     |
| 20px+ titles   | -0.02em                     |

## Numerals

- `tabular-nums` in tables, stats, timers, prices, diffs – anywhere numbers stack or update.
- Right-align numeric columns.
- Keep units in `--muted-foreground` at one size smaller when the number is the point (`128 ms`, `42 %` patterns).

## Casing

- Sentence case for everything: titles, buttons, menu items, table headers, tabs.
- Product nouns keep their capitalisation ("Connect to GitHub").
- No uppercase, anywhere, unless explicitly requested. Table headers in particular are sentence case at 11–12px, weight 500, normal tracking – never uppercase, never letterspaced.
- Full casing and voice rules: `copy-voice.md`.
