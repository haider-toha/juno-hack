---
name: haider-ui-components
description: React/shadcn/Base UI composition, variants, tables, cell renderers, AG Grid theming. Use when writing/reviewing React UI components or data grids.
---

# UI Components

Composition rules for product UIs: shadcn-style part families on Base UI, small semantic variants, reusable cell renderers, and a two-tier table stack. Tokens, density, type, motion, and copy: `haider-design-taste`. This skill covers how components are built and assembled, not how they look.

## Composition

Build shadcn-style composed components, not configured monoliths. A component is a family of small parts the consumer assembles; the shape of the JSX mirrors the shape of the UI.

- Prefer children and part-components over `title` / `footer` / `renderX` props.
- Components own styling and behaviour; consumers own arrangement and content.
- Expose `className` on every part and merge with `cn()` – consumers adjust without forking.
- Use the Base UI `render` prop so consumers can swap the rendered element (button → link) without prop-forwarding hacks. `asChild` is the legacy Radix equivalent in older projects – do not mix the two in one codebase.

Full composition examples and props discipline: `references/react-components.md`.

## Base UI first

When crafting a new interactive component, reach for `@base-ui/react` before writing behaviour by hand. It supplies focus management, keyboard interaction, ARIA wiring, portals, and dismissal. Styling is always ours.

- Exists in Base UI → wrap and style the primitive.
- Exists as a shadcn / project-registry component → install via the shadcn CLI or the project's component registry, then restyle to semantic tokens. Never ship a stock shadcn component untouched.
- No primitive fits → compose from Base UI parts (`useRender`, Portal) before a bespoke implementation.
- Animate through Base UI state attributes: `data-starting-style` / `data-ending-style` for CSS transitions (preferred), `data-open` / `data-closed` for keyframes. Motion durations and ease come from the motion table in `haider-design-taste`.
- Use popup CSS variables where they exist (`--transform-origin`, `--available-height`, `--anchor-width`).

## Variants (`cva`)

Define variants with `cva` at the top of the file. Keep the set small and semantic: a `variant` says what it means (`danger`), never what it looks like (`red`). Sizes map to the component-height table in `haider-design-taste` → `references/density-layout.md` (28 / 32 / 36px).

## State styling

- Style state through data attributes, not JS-driven class swapping: `data-open:…`, `data-disabled:…`, `aria-expanded:…`. Base UI emits these; Radix-era projects use `data-[state=open]`.
- All colours through semantic tokens (`bg-card`, `text-muted-foreground`, `border-border`) – raw palette values in a component are a violation (`haider-design-taste` → `references/color-system.md`).
- The full state set is part of the component: hover, focus-visible, active, disabled, loading, empty, error.

## Tables (two tiers)

Pick by interaction depth – never build table machinery by hand:

| Tier                 | When                                                                             | Stack                                                                          |
| -------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Low interaction      | Display, sorting, simple selection, pagination                                   | shadcn Table + TanStack Table, restyled to semantic tokens                     |
| Advanced interaction | Inline cell editing, grouping, pivoting, virtualised large datasets, column drag | AG Grid Community, themed only through CSS variables mapped to semantic tokens |

Shared look: 36px rows, 8–12px cell padding, hairline row borders, tabular numerals right-aligned, sentence-case headers at 11–12px weight 500. Full AG Grid override: `references/ag-grid-theme.md`.

## Cell renderers

Cell renderers live in their own file (e.g. `components/cell-renderers/`), one per file, decoupled from any table library. A renderer takes a typed value and renders the cell – it must not reach into AG Grid's `ICellRendererParams` or TanStack's cell context. Adapt at the call site with a thin wrapper so the same component drops into either tier unchanged.

## Props and files

- No boolean prop explosions – use a variant, a part-component, or composition.
- Explicit interfaces extending the element's props + `VariantProps`.
- Forward refs on every part; spread rest props onto the root. Never `any`.
- One component family per file under `components/ui/` for primitives; product compositions live beside their feature. Named exports; PascalCase names; kebab-case files.

## Install path

Install primitives with the **shadcn CLI** or the project's component registry. Restyle to semantic tokens before shipping.

## References

| File                             | Load when                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| `references/react-components.md` | Writing or reviewing React components – composition, Base UI, variants, props, files |
| `references/ag-grid-theme.md`    | Theming or reviewing AG Grid – full CSS variable override                            |

For colour, type, density, patterns, copy, and motion: load `haider-design-taste`.
