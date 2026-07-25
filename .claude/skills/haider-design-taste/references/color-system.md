# Colour System

Contents: token architecture · neutral scale · semantic tokens · status hues · category colours · rules.

All values are starting points calibrated to the Linear/Attio register – tune against real screens, but keep the relationships (which step maps to which token) stable.

The token names are shadcn's theme vocabulary (`--background`, `--foreground`, `--card`, `--primary`, `--muted`, `--accent`…), extended where the system needs more (`--subtle`, `--active`, `--selection`, the sidebar family). One vocabulary, so a stock shadcn component and a project component read from the same tokens with no bridge. Note the shadcn meaning of two names: `--accent` is the **hover surface** (not the brand), and the brand is `--primary`.

## Token architecture

Every token is a light/dark pair, defined together. Components reference semantic tokens only – never raw scale steps, never hex. Derived tokens (a `-foreground` that equals `--foreground`, `--popover` that equals `--card`) are authored as `var()` refs so there is one value to tune.

```css
:root {
  --background: var(--neutral-1);
  --foreground: var(--neutral-12);
  /* ... */
}
.dark {
  --background: var(--neutral-1-dark);
  --foreground: var(--neutral-12-dark);
}
```

Dark is not inverted light. In dark themes, elevation lightens surfaces (a popover is lighter than the page) and borders brighten; shadows nearly disappear, so separation leans on surface tone and border.

## Neutral scale

12 steps, Radix-gray register (slate cast). Steps have fixed roles:

| Step | Role                          | Light     | Dark      |
| ---- | ----------------------------- | --------- | --------- |
| 1    | App background                | `#fcfcfd` | `#111113` |
| 2    | Subtle background, sidebar    | `#f9f9fb` | `#18191b` |
| 3    | Surface, hover background     | `#f0f0f3` | `#212225` |
| 4    | Active/selected background    | `#e8e8ec` | `#272a2d` |
| 5    | Strong selected background    | `#e0e1e6` | `#2e3135` |
| 6    | Border                        | `#d9d9e0` | `#363a3f` |
| 7    | Border strong, control border | `#cdced6` | `#43484e` |
| 8    | Border on hover/focus edge    | `#b9bbc6` | `#5a6169` |
| 9    | Placeholder, disabled text    | `#8b8d98` | `#696e77` |
| 10   | Subtle text                   | `#80838d` | `#777b84` |
| 11   | Muted text (secondary)        | `#60646c` | `#b0b4ba` |
| 12   | Text (primary)                | `#1c2024` | `#edeef0` |

## Semantic tokens

Three text tiers (`foreground` / `muted-foreground` / `subtle-foreground` = steps 12 / 11 / 9) and the surfaces they sit on.

| Token                                                                                                                        | Maps to                                          | Use                                                           |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| `--background`                                                                                                               | step 1                                           | App canvas                                                    |
| `--foreground`                                                                                                               | step 12                                          | Primary text                                                  |
| `--card`                                                                                                                     | step 2 (light) / step 3 (dark)                   | Cards, inputs                                                 |
| `--card-foreground`                                                                                                          | → foreground                                     | Text on cards                                                 |
| `--popover`                                                                                                                  | → card                                           | Popover, menu, tooltip surface                                |
| `--popover-foreground`                                                                                                       | → foreground                                     | Text in popovers                                              |
| `--muted`                                                                                                                    | step 2                                           | Sidebars, wells, table headers, subtle fills                  |
| `--muted-foreground`                                                                                                         | step 11                                          | Secondary text, labels                                        |
| `--subtle` _(extension)_                                                                                                     | → muted                                          | Subtle surface, paired with subtle-foreground                 |
| `--subtle-foreground` _(extension)_                                                                                          | step 9                                           | Placeholders, disabled, meta – faintest text tier             |
| `--accent`                                                                                                                   | step 3                                           | Hover on rows, menu items _(shadcn hover surface, not brand)_ |
| `--accent-foreground`                                                                                                        | → foreground                                     | Text on the hover surface                                     |
| `--active` _(extension)_                                                                                                     | step 4                                           | Selected rows, pressed state                                  |
| `--border`                                                                                                                   | step 6                                           | Default hairline                                              |
| `--input`                                                                                                                    | step 7                                           | Inputs, controls (stronger border)                            |
| `--secondary`                                                                                                                | → muted                                          | Secondary buttons and fills                                   |
| `--secondary-foreground`                                                                                                     | → foreground                                     | Text on secondary                                             |
| `--sidebar`, `--sidebar-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring` | → muted / foreground / accent / border / primary | Sidebar surfaces (shadcn sidebar family)                      |

Only `-foreground`-suffixed names (and `foreground`/`primary-foreground`/`destructive-foreground`) are text colours – `text-muted`, `bg-foreground`, `text-subtle` compile but are footguns; use the paired names.

## Brand and status

One brand, `--primary`. Monochrome – the primary text step (neutral.12) inverts to carry primary actions, focus rings, active nav, links. Near-black on light, near-white on dark; the interface stays greyscale and the brand reads as weight, not hue. There is no `--primary-hover` token; darken with `hover:bg-primary/90`.

| Token                                         | Light     | Dark      | Maps to                          |
| --------------------------------------------- | --------- | --------- | -------------------------------- |
| `--primary`                                   | `#1c2024` | `#edeef0` | neutral.12                       |
| `--primary-foreground` (on primary)           | `#ffffff` | `#111113` | –                                |
| `--ring`                                      | → primary | –         |
| `--selection` _(extension, ::selection wash)_ | `#f0f0f3` | `#272a2d` | neutral.3 light / neutral.4 dark |

Status hues – `destructive` carries a paired `-foreground` (→ primary-foreground); `success`/`warning` are extensions:

| Hue         | Base light | Base dark | Meaning                               |
| ----------- | ---------- | --------- | ------------------------------------- |
| Success     | `#30a46c`  | `#3dd68c` | Completed, healthy, positive delta    |
| Warning     | `#e2a336`  | `#ffca16` | Attention, degraded, pending risk     |
| Destructive | `#e5484d`  | `#ec5d5e` | Destructive actions, errors, failures |

Warning text on light backgrounds needs the darkened `--warning-foreground` (`#9e6c00` / `#ffca16`) to hit contrast – never yellow text on white.

## Category colours

For user data: tags, labels, project/status chips. Linear-style – desaturated fills, readable foregrounds, never as loud as the accent. Eight hues:

| Hue    | Light bg / fg         | Dark bg / fg          |
| ------ | --------------------- | --------------------- |
| Gray   | `#f0f0f3` / `#60646c` | `#2e3135` / `#b0b4ba` |
| Blue   | `#e6edfe` / `#3a5ccc` | `#1d2a52` / `#93b4ff` |
| Teal   | `#e1f6f4` / `#107a6c` | `#11342f` / `#5fd4c4` |
| Green  | `#e3f3e8` / `#2e7854` | `#17342a` / `#66caa0` |
| Yellow | `#fbf0d4` / `#8f6400` | `#3a2e14` / `#d9b13a` |
| Orange | `#ffe8d7` / `#b44700` | `#3d2314` / `#f0925c` |
| Red    | `#fde5e5` / `#c62a2f` | `#411b1c` / `#f28b8b` |
| Purple | `#f1e9fc` / `#794ec6` | `#2d2145` / `#b79bee` |

Category colours identify, they don't alert – status meaning always comes from the status hues above.

## Rules

- **Neutral-dominant.** The brand is monochrome, so the only colour on screen is status and category. Those appear in under 5% of any screen. If a screen feels colorful, it's wrong.
- **Contrast floors.** 4.5:1 for body text, 3:1 for large text, 3:1 for borders on interactive controls and for focus indicators.
- **No gradients in chrome.** Buttons, cards, nav – flat fills only.
- **Colour is information.** Greyscale by default; action is carried by the monochrome `--primary`, so a hue must mean state (status) or identity (category).
- **Test both themes together.** A change that ships in one theme only is incomplete.
