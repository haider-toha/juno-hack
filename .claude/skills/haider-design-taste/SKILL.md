---
name: haider-design-taste
description: Haider's product UI taste – dense Linear/Attio-register interfaces; use when building/reviewing UI, choosing tokens, scaffolding components/screens, applying "my taste".
---

# Design taste

Build product interfaces in the Linear/Attio register: information-dense, quiet, keyboard-first, instant. ElevenLabs is a further reference point for the same register. Whitespace is earned, not default. Restraint is the baseline – every visual element must justify itself, and emphasis is spent like money. The interface should feel like a precision tool, not a brochure.

When something is ambiguous, choose the quieter option.

**Out of scope:** marketing sites, landing pages, and promotional surfaces. Those are a different discipline. This skill covers product UI only (app chrome, data surfaces, settings, dialogs, command menus).

Component composition: `haider-ui-components`.

## Quiet-default doctrine

The resting UI is greyscale, compact, and quiet. Colour, motion, weight, and space are spent only when they carry information or focus. Prefer borders over shadows, de-emphasis of neighbours over amplification of the subject, and skeletons over spinners. If removing a visual treatment does not hurt understanding or interaction, remove it.

## Non-negotiables

These hold on every product screen, every time. No context overrides them.

| Concern    | Rule                                                                                                                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Theme      | Light AND dark are first-class from day one. Every token is defined as a pair. Never "dark mode later".                                                                                                                             |
| Type       | Inter/Geist as the practical default. Target 13px UI / 14px inputs. Until custom `--text-*` are set, Tailwind stock may render UI at 14px – target remains 13px. Emphasis is weight 500 – never bold. Tabular numbers for all data. |
| Density    | Compact: ~36px data rows, 32px default controls. Lots of data per viewport.                                                                                                                                                         |
| Depth      | Hairline 1px low-contrast borders do the structural work. Shadows are whisper-quiet, layered, and reserved for floating elements only.                                                                                              |
| Radii      | 4–8px. Small radii; never pill-shaped chrome.                                                                                                                                                                                       |
| Motion     | Durations and ease below are canonical. Never animate keyboard-driven actions.                                                                                                                                                      |
| Copy       | British English (en-GB), sentence case everywhere including buttons and titles. En-dashes, never em-dashes (U+2014). No exclamation marks, no emoji, no ampersands.                                                                 |
| Tokens     | Components reference semantic tokens on the shadcn vocabulary (`--background`, `--foreground`, `--muted-foreground`, `--border`), never raw palette values.                                                                         |
| Components | Composed shadcn-style part families. Base UI primitives first for any new interactive component; styling always ours. Details in `haider-ui-components`.                                                                            |

## Decision Frameworks

Answer these before writing styles.

### Border or shadow?

Is the element floating above the page (popover, dropdown, modal, toast)?

- **Yes** → hairline border + whisper shadow (recipes in `references/density-layout.md`)
- **No, it sits in the page flow** (card, panel, table, sidebar) → hairline border only. Never a shadow.

If a border and a background-tone shift would both work, prefer the border. If neither is needed, use neither – proximity and alignment separate content for free.

### How do I emphasise this?

In order. Stop at the first step that works:

1. **Weight**: 400 → 500. This handles most emphasis in a dense UI.
2. **Colour**: `--muted-foreground` → `--foreground`. De-emphasise neighbours instead of amplifying the subject.
3. **Size**: one step up the type scale. Rare – dense UIs have a flat hierarchy.

Never: bold (700), a second accent colour, decorative icons, uppercase, widened letter-spacing, or background fills to make text "pop".

### How dense should this surface be?

| Surface                                                | Density                                               |
| ------------------------------------------------------ | ----------------------------------------------------- |
| Data surface (table, list, board, tree)                | Compact: 36px rows, 8–12px cell padding               |
| Form / settings / reading surface                      | One step looser: 32px controls, 16–20px group spacing |
| Focused moment (empty state, confirmation, onboarding) | Generous – this is where whitespace is earned         |
| Marketing / landing                                    | Out of scope for this skill                           |

### Does this need colour?

Default is no. The interface is greyscale; colour is information. Accent marks the primary action and focus. Semantic hues (success/warning/danger) mark state. Category colours mark user data (tags, labels). If a colour isn't carrying one of those meanings, remove it.

## Signature Patterns

Four patterns define how these interfaces behave. Summaries here; full specs in `references/patterns.md`.

**Command menu, keyboard-first.** ⌘K is a primary surface, not an easter egg. Every action is keyboard-reachable, shortcuts are rendered in the UI (menu right-edges, tooltips), and the palette opens with no animation – it's used hundreds of times a day.

**Inline everything.** The record is the form. Click-to-edit fields, popover pickers, save-on-blur – never navigate away to edit, never a separate "edit mode". Attio's record page is the benchmark.

**Optimistic and instant.** Perceived latency is a design defect. Update optimistically and reconcile; skeletons over spinners, and skeletons match the real layout. Target <100ms perceived response for every interaction.

**Quiet empty and edge states.** Loading, empty, and error are designed together with the happy path, as one state set. Empty states say what belongs here and offer exactly one action. Secondary actions reveal on hover. No illustration spam.

## Motion (canonical)

| Interaction        | Duration |
| ------------------ | -------- |
| Hover transitions  | 120ms    |
| Press feedback     | 160ms    |
| Tooltips, popovers | 160ms    |
| Dropdowns, selects | 200ms    |
| Modals, drawers    | 240ms    |

Ease-out: `cubic-bezier(0.23, 1, 0.32, 1)`. Prefer transform and opacity. Springs only for gesture-driven motion. Never animate keyboard-driven actions – the command palette opens instantly. Cap UI chrome at 300ms; no `transition: all`, no built-in `ease-in`, no bouncy overshoot on chrome.

## Taste Violations – Always Flag

Flag these on sight, in reviews and in code being written.

### Visual noise

- Heavy or mid-opacity shadows; shadows on in-flow elements
- Borders thicker than 1px; high-contrast borders doing decoration
- Gradient buttons or gradient chrome of any kind
- More than one accent colour competing for attention
- Decorative icons scattered through the UI; icons that repeat the label's meaning
- Uppercase text or tracking utilities anywhere they weren't explicitly requested – including table headers

### Default-library look

- Untouched shadcn/Tailwind defaults shipped as final UI
- Stock `ring` focus styles, default radii, default shadows left as-is
- Every component customisation-free – shipping without a taste pass is shipping unfinished work

### Sloppy motion

- `transition: all`
- Bouncy overshoot on UI chrome
- Durations over 300ms on UI elements
- Animating keyboard-initiated or page-level actions
- Built-in `ease-in` anywhere

### Lazy states and copy

- Spinner-only loading where a skeleton belongs
- Barren empty states ("No items")
- "Something went wrong" or any error that names neither the problem nor the next step
- Title Case Labels And Buttons
- Exclamation marks, "Oops", emoji in UI, ampersands, em-dashes (U+2014), American spellings in product copy
- Page descriptions under titles that restate the obvious ("Manage your settings" under "Settings")

## Review Format (Required)

When reviewing UI code or designs against this skill, output findings as a markdown table – never a list:

| Violation                             | Fix                           | Rule                                   |
| ------------------------------------- | ----------------------------- | -------------------------------------- |
| `font-weight: 700` on list item title | `font-weight: 500`            | typography.md – weights                |
| `box-shadow` on in-flow card          | Hairline border, no shadow    | Border or shadow?                      |
| Button label "Save Changes!"          | "Save changes"                | copy-voice.md – casing, no exclamation |
| Spinner while table loads             | Skeleton rows matching layout | patterns.md – optimistic and instant   |

One row per violated rule (a snippet breaking two rules gets two rows), ordered most-severe first – structural problems (noise, depth, density, tokens) before motion before copy. The Rule column cites the section or reference file so the fix is traceable.

Wrong format (never do this):

```
Violation: font-weight: 700
Fix: font-weight: 500
──────────────
Violation: box-shadow on card
Fix: remove shadow
```

Motion findings appear in the main table like everything else, and are then repeated in a supplementary table where the fix can be shown as actual code:

| Before                               | After                                                      | Why                                    |
| ------------------------------------ | ---------------------------------------------------------- | -------------------------------------- |
| `transition: all 400ms ease-in`      | `transition: opacity 160ms cubic-bezier(0.23, 1, 0.32, 1)` | Motion – opacity only, 160ms, ease-out |
| Command palette `animate-in` on open | Instant open, no entrance                                  | Never animate keyboard-driven actions  |

Those are the only two tables a review produces.

## References

Load these as the task requires:

| File                           | Load when                                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| `references/color-system.md`   | Choosing or reviewing any colour, theming, tokens, tag/label colours                            |
| `references/typography.md`     | Type sizes, weights, tracking, numerals, casing in type                                         |
| `references/density-layout.md` | Spacing, control/row heights, borders, shadow recipes, radii, layout metrics                    |
| `references/patterns.md`       | Building flows, command menus, inline editing, loading/empty/error states, keyboard UX          |
| `references/copy-voice.md`     | Writing any user-facing string – labels, errors, empty states, confirmations, page descriptions |

React composition, Base UI usage, variants, cell renderers, and the AG Grid theme override live in the `haider-ui-components` skill (`references/react-components.md`, `references/ag-grid-theme.md`). Load that skill when writing or reviewing components or data grids; visual tokens still come from this skill.

## Workflow notes

- **Done means the full state set**, or explicitly mark the work incomplete. Loading, empty, error, and happy path ship together for every data surface.
- **Light and dark are the same change.** A token or style that ships in one theme only is incomplete.
- **Taste wins conflicts** with library defaults, stock shadcn look, and "we'll polish later".
- **Greyscale-first for visual specs.** Design and review in greyscale; add status and category colour only when meaning requires it.
