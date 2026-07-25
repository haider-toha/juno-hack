---
name: haider-icon-geometry
description: Authoring and extending a 15px Radix-style stroke icon set – grid, weight, terminals, joins, snap. Use when drawing or extending stroke icons in that register.
---

# Icon geometry

Author as **strokes** (a single centreline), not the filled outlines Radix ships. A 1px round-capped stroke reproduces Radix's terminal and join geometry, and is far easier to write and edit. If byte-identical filled paths are ever needed, outline the strokes in one pass – see `references/radix-icon-spec.md` (load when converting to fills or auditing fidelity against real Radix source).

## The five rules

Measured from real Radix source (full analysis in the reference):

1. **Grid** – `viewBox="0 0 15 15"`. Keep a 1–2px margin: content lives roughly in 2–13, corner glyphs reach 3.5, full-bleed arrows reach 13.
2. **Weight** – 1px optical stroke. Icons scale from 15px, so the weight scales too (like Radix); do not pin it.
3. **Terminals** – round caps (`stroke-linecap="round"`), radius 0.5.
4. **Joins** – round (`stroke-linejoin="round"`).
5. **Snap** – land coordinates on .0, .25, .5, .75. Geometric, not hand-drawn.

## Stroke or fill

- **Stroke** for line icons – the default (arrows, chevrons, box glyphs, the magnifier).
- **Fill** for genuinely solid shapes – dots, filled badges, solid triangles. Author directly with `fill="currentColor"`.

Everything paints with `currentColor`, so colour and size come from CSS.

A heavier glyph like a caret is still a stroke, just a thicker one: a short chevron at ~1.2px. Carry that weight as `stroke-width` **on the path element**, not the root – codegen that reapplies a global 1px weight to the root will wipe a root-level override; a per-icon weight only survives on the inner element. A pure `fill` cannot round its corners; a round-capped stroke gives rounded terminals for free, which is why Radix's own carets read as rounded wedges, not sharp triangles.

## Authoring workflow

Package-agnostic pipeline: `svg/` → codegen → typed map / manifest → preview.

1. Add `svg/<name>.svg`. Kebab-case; reuse Radix's name when an analogue exists (`arrow-top-left`, `chevron-down`, `caret-up`) so the two sets read as one.

   Stroke template:

   ```svg
   <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="…"/></svg>
   ```

   Fill template: same, but `fill="currentColor" stroke="none"` and no stroke-\* attributes.

2. Regenerate the typed map, manifest, and preview data from `svg/`.

3. Eyeball it in the preview: split against the Radix original, overlay for sub-pixel drift, grid toggle for snapping.

4. Guard the grid and map/source sync with package tests.

Elements may be `<path>`, `<circle>`, `<rect>`, `<line>` – whatever is cleanest. Stroke attributes on the root `<svg>` inherit, so children stay bare.

## Family conventions

Match these control points so a new arrow lines up with the shipped ones:

- **Cardinal arrows** – shaft on the centre axis (7.5); tip at 2 or 13; head wings ±4 from the tip, dropped 4.5. Draw the head as a separate subpath (`M{wing} L{tip} L{wing}`), like Lucide.
- **Diagonal arrows** – corner-L head at one corner (legs to 9 and to 6), diagonal shaft across to the opposite corner (3.5↔11.5).
- **Chevrons** – wings ±4, apex 3.5 deep (e.g. up: `M3.5 8.5 7.5 5 11.5 8.5`). Double = two chevrons 5.5 apart.
- **Carets** – a short round-capped chevron at `stroke-width="1.1"` (on the path), wings ±3, apex 2.9 deep (e.g. down: `M4.5 6.5 7.5 9.4 10.5 6.5`). Heavier than a chevron so the two read differently; the spread matches Radix's wedge centreline.

## Checklist before shipping an icon

- Reads at 15px, not just at 48px.
- Optically 1px throughout – no accidental double weight where a stroke doubles back.
- Balanced in the box; consistent margin with its neighbours.
- Both themes: it is `currentColor`, so this is free – but check dark mode in the preview anyway.
- Split and Overlay against the Radix original (if one exists) show no real drift.

Product UI icon spam rules: [haider-design-taste](../haider-design-taste/SKILL.md).
