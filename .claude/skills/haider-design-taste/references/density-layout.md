# Density, Layout, Depth

Contents: spacing scale · component heights · layout metrics · borders · shadows · radii.

## Spacing scale

4px base. Legal values: 2, 4, 6, 8, 12, 16, 20, 24, 32. Off-scale values (5px, 10px, 14px…) are violations.

| Step  | Use                                                   |
| ----- | ----------------------------------------------------- |
| 2     | Icon-to-text inside chips, kbd hint gaps              |
| 4     | Inside compact chips/badges                           |
| 6–8   | Icon-to-label, cell padding, control internal padding |
| 12    | Between related controls, list item padding           |
| 16    | Between groups, page gutter (compact)                 |
| 20–24 | Between sections, page gutter (default)               |
| 32    | Major section breaks, focused moments                 |

## Component heights

| Height | Use                                                                   |
| ------ | --------------------------------------------------------------------- |
| 24px   | Chips, tags, inline badges                                            |
| 28px   | Compact controls – toolbar buttons, filters, table-header controls    |
| 32px   | **Default control** – buttons, inputs, selects                        |
| 36px   | **Data row** and prominent controls (primary CTA in a focused moment) |
| 40px   | Maximum. Rare – hero-level inputs only                                |

Data rows at 36px with 8–12px horizontal cell padding. Menu items 28–32px. Nothing in product chrome exceeds 40px.

## Layout metrics

- Sidebar: 220–260px, `--muted`, 1px `--border` on its edge.
- Page gutters: 16–24px; content areas in a data app run full-width.
- Reading/settings content: max-width 640–720px.
- Modals: 400px (confirm), 480–560px (form), 720px (rich). Never full-screen on desktop.
- List/detail splits: list 320–400px, detail takes the rest.

## Borders

Hairlines do the structural work. 1px only.

**Preferred recipes** – alpha borders (layer cleanly over tinted surfaces):

| Token                        | Light                 | Dark                        |
| ---------------------------- | --------------------- | --------------------------- |
| `--border`                   | `rgba(0, 0, 0, 0.08)` | `rgba(255, 255, 255, 0.08)` |
| `--input` (inputs, controls) | `rgba(0, 0, 0, 0.13)` | `rgba(255, 255, 255, 0.14)` |

Solid equivalents are neutral steps 6–7 in `color-system.md` (`#d9d9e0` / `#363a3f` and `#cdced6` / `#43484e`). Prefer the alpha versions above; solids are fine when the surface is already a flat neutral and you want an opaque token.

- Prefer a border to a background-tone change when separating regions.
- Never 2px borders. Never borders as decoration.
- Focus rings: 2px `--ring` (the brand) with 2px offset – the one place a heavier line is right.

## Shadows

Floating elements only – popovers, dropdowns, modals, toasts. In-flow elements (cards, panels) never cast shadows.

```css
/* Popover, dropdown, tooltip */
--shadow-float:
  0 0 0 1px var(--border), 0 4px 8px rgba(0, 0, 0, 0.04),
  0 12px 24px rgba(0, 0, 0, 0.06);

/* Modal – one step stronger */
--shadow-modal:
  0 0 0 1px var(--border), 0 8px 16px rgba(0, 0, 0, 0.06),
  0 24px 48px rgba(0, 0, 0, 0.1);
```

Dark theme: shadows read as near-invisible – keep them (they still ground the element) but lean on a lighter surface (neutral step 3–4) and a brightened border for separation. Never compensate with heavier shadow opacity in dark.

## Radii

| Radius | Use                                  |
| ------ | ------------------------------------ |
| 4px    | Checkboxes, tags, chips, kbd hints   |
| 6px    | Buttons, inputs, selects, menu items |
| 8px    | Cards, popovers, modals, panels      |

Nested radii: inner = outer − padding (a 6px control inside an 8px card with 2px gap). No pills except avatars and count badges; `9999px` on anything else is a violation.
