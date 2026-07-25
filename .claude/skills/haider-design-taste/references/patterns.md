# Interaction Patterns

Contents: command menu and keyboard-first · inline everything · optimistic and instant · quiet empty/edge states.

## Command menu, keyboard-first

⌘K is a primary surface. Design it like Linear's: an action layer over the whole product.

- Every action reachable by keyboard; every list navigable with ↑↓, actionable with ↵, escapable with Esc.
- Shortcuts rendered in the UI: right edge of menu items, inside tooltips (`kbd` chips: 11–12px, 4px radius, `--muted` fill, `--muted-foreground` text).
- The palette opens with **no animation** – it's a keyboard-initiated action used hundreds of times a day (see the motion table in `haider-design-taste`: never animate keyboard actions). Results update instantly as you type.
- Context-aware: with a record selected, its actions rank first.
- Single-key shortcuts for the hot paths on data surfaces (Linear register: `c` to create, `e` to edit, `x` to select).
- Focus management is part of the design: what's focused when the palette closes, where focus lands after an action, visible focus ring on everything interactive.

## Inline everything

The record is the form. Never navigate away to edit; never a separate edit mode.

- **Click-to-edit fields**: at rest they render as text; hover shows an affordance (`--accent` fill); click swaps to an input in place, same size and alignment – zero layout shift.
- **Commit semantics**: save on blur and on ↵; revert on Esc. No Save button for single-field edits.
- **Popover pickers** for constrained values (status, assignee, dates, labels): anchored popover with a filter input, not a page or modal.
- **Modals are for creation and destruction**, not edits – new record, confirm delete.
- Failed saves revert the value and show why, inline next to the field.

## Optimistic and instant

Perceived latency is a design defect. Target <100ms perceived response for every interaction.

- **Optimistic by default**: mutations apply to the UI immediately and reconcile in the background. On failure: revert, and say what happened and what to do (see `copy-voice.md`).
- **Skeletons over spinners**: skeleton shapes match the real layout – same row heights, same column widths – so content replaces placeholder without shift. Spinners only for actions inside a control (a 16px spinner in a busy button).
- **Never block the whole screen** for a partial load; load regions independently.
- Stale-while-revalidate feel: show the cached view instantly, refresh quietly.
- Don't animate what should be instant – an optimistic update landing in a list doesn't need an entrance; new-from-elsewhere items can fade in quietly using these durations from `haider-design-taste` (120–240ms, ease-out).

## Quiet empty and edge states

Loading, empty, and error are designed with the happy path, as one state set. A component isn't done until all four exist.

- **Empty states**: say what belongs here, offer exactly one action. Centred in the content area, `--muted-foreground`, 13px, optional single quiet glyph. No illustrations, no confetti. First-run empties may add one short sentence of orientation; filtered-to-empty says so and offers to clear filters.
- **Error states**: what happened + what to do, inline where the failure occurred, not a global toast (rules in `copy-voice.md`).
- **Hover reveals**: secondary actions (row menus, copy buttons, drag handles) appear on row hover, keeping the resting UI quiet. They must remain keyboard-reachable when not hovered – hover-reveal is progressive disclosure, not the only path.
- **Progressive disclosure**: advanced options behind "Show more", secondary metadata one level down. The resting state of every surface shows only what earns its place.

## State set checklist

Every data surface ships with:

| State      | Requirement                                |
| ---------- | ------------------------------------------ |
| Loading    | Skeleton matching real layout              |
| Empty      | One sentence + one action                  |
| Error      | What happened + what to do, inline         |
| Partial    | Regions load independently                 |
| Optimistic | Instant apply, revert + message on failure |
