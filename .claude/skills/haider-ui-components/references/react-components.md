# React Components

Contents: composition model · Base UI first · variants · state styling · tables · props discipline · file conventions · install path.

## Composition model

Build shadcn-style composed components, not configured monoliths. A component is a family of small parts the consumer assembles; the shape of the JSX mirrors the shape of the UI.

```tsx
<Card>
  <CardHeader>
    <CardTitle>Usage</CardTitle>
    <CardAction>
      <Button variant="ghost" size="icon-sm">
        <Ellipsis />
      </Button>
    </CardAction>
  </CardHeader>
  <CardContent>…</CardContent>
</Card>
```

- Prefer children and part-components over `title`/`footer`/`renderX` props.
- Components own their styling and behaviour; consumers own arrangement and content.
- Expose `className` on every part and merge with `cn()` – consumers must be able to adjust without forking.
- Use the `render` prop (Base UI) so consumers can swap the rendered element (button → link) without prop forwarding hacks. `asChild` is the legacy Radix equivalent in older projects – do not mix the two in one codebase.

## Base UI first

When crafting a new interactive component, reach for the Base UI primitive (`@base-ui/react`) before writing behaviour by hand. It supplies focus management, keyboard interaction, ARIA wiring, portals, and dismissal – the parts that are invisible when right and broken when improvised. Styling is always ours.

- Exists in Base UI (dialog, popover, menu, select, tabs, tooltip, toast, slider, switch…) → wrap and style the primitive.
- Exists in the project registry / shadcn set → install via the shadcn CLI or project registry, then restyle to semantic tokens. Never ship a stock shadcn component untouched.
- No primitive fits → compose from Base UI parts (`useRender`, Portal) before reaching for a bespoke implementation.
- Animate through the state attributes Base UI emits: `data-starting-style`/`data-ending-style` for CSS transitions (preferred – interruptible), `data-open`/`data-closed` for keyframes. For JS animation, compose `motion` through the `render` prop; motion durations and ease are canonical in `haider-design-taste` (≤300ms, ease-out, transform/opacity).
- Use the popup CSS variables where they exist – `--transform-origin` for origin-aware scaling, `--available-height` for constrained lists, `--anchor-width` for matched-width popovers.

## Variants

Define variants with `cva` at the top of the file – variants are the component's public vocabulary, so keep the set small and semantic.

```tsx
const buttonVariants = cva(baseClasses, {
  variants: {
    variant: { default: "…", ghost: "…", danger: "…" },
    size: { sm: "h-7 …", default: "h-8 …", lg: "h-9 …" },
  },
  defaultVariants: { variant: "default", size: "default" },
});
```

Sizes map to the component-height table in `haider-design-taste` → `references/density-layout.md` (28/32/36px). A `variant` says what it means (`danger`), never what it looks like (`red`).

## State styling

- Style state through data attributes, not JS-driven class swapping: `data-open:…`, `data-disabled:…`, `aria-expanded:…`. Base UI emits these for free (Radix-era projects use `data-[state=open]`).
- All colours through semantic tokens (`bg-card`, `text-muted-foreground`, `border-border`) – a raw palette value in a component is a violation (`haider-design-taste` → `references/color-system.md`).
- The full state set is part of the component, not the page: hover, focus-visible, active, disabled, loading, empty, error.

## Tables

Two tiers, picked by interaction depth – never build table machinery by hand:

- **Low interaction** (display, sorting, simple selection, pagination): the shadcn Table implementation of TanStack Table. Restyle to semantic tokens as with every shadcn component.
- **Advanced interaction** (inline cell editing, grouping, pivoting, virtualised large datasets, column drag): AG Grid Community. Theme it exclusively through CSS variables mapped to the semantic tokens – never AG Grid's stock theme as shipped. The full override lives in `ag-grid-theme.md` – load it whenever theming or reviewing an AG Grid surface.

Either way: 36px rows, 8–12px cell padding, hairline row borders, tabular numerals right-aligned, and headers in sentence case at 11–12px weight 500 – never uppercase, never tracking utilities (`haider-design-taste` → `references/typography.md`).

**Cell renderers** live in their own file (e.g. `components/cell-renderers/`), one per file, decoupled from any table library. A renderer takes a typed value and renders the cell content – it must not reach into AG Grid's `ICellRendererParams` or TanStack's cell context. Adapt at the call site: a thin wrapper passes `params.value` into the renderer, so the same component drops into a shadcn/TanStack cell or an AG Grid `cellRenderer` unchanged. This keeps the visual layer library-agnostic across both table tiers and reviewable in isolation.

## Props discipline

- No boolean prop explosions (`compact`, `bordered`, `elevated`…) – reach for a variant, a part-component, or composition instead.
- Type props with explicit interfaces extending the element's own props: `interface ButtonProps extends React.ComponentProps<'button'>, VariantProps<typeof buttonVariants>`.
- Forward refs on every part; spread rest props onto the root element.
- Never `any`. Unknown external data is `unknown`, then narrowed.

## File conventions

- One component family per file: `components/ui/card.tsx` exports `Card`, `CardHeader`, `CardTitle`, `CardContent`…
- shadcn's `components/ui/` layout for primitives; product-specific compositions live beside their feature, not in `ui/`.
- Named exports only. Component names in PascalCase; files in kebab-case.

## Install path

- Install from the **shadcn CLI** or the project's component registry – the shadcn set on Base UI, then restyle to semantic tokens. Reach for the registry before writing a primitive-wrapping component yourself.
- For components the registry does not cover, author a family that conforms to these rules (composition, `cva`, state attributes, full state set).
- Calibrate token changes on real screens in both themes before shipping – a type specimen / theme playground route in the project is useful when available.
