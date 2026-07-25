# Radix icon spec (measured)

Measured from real Radix source (`radix-ui/icons`, MIT). Load when auditing a new icon against Radix fidelity, or when converting centreline strokes to filled outlines.

## What Radix actually ships

Every Radix icon is a **filled path**, never a stroke:

```svg
<svg width="15" height="15" viewBox="0 0 15 15" fill="none" ...><path d="…" fill="currentColor"/></svg>
```

A line icon is drawn as two parallel contours (outer clockwise, inner counter-clockwise) with even-odd fill, producing a 1px band. That is why hand-typing Radix-style path data is painful, and why stroke-authored sets use centreline strokes instead.

| Property       | Value                                             | Evidence                                                           |
| -------------- | ------------------------------------------------- | ------------------------------------------------------------------ |
| Canvas         | `viewBox="0 0 15 15"`, `width/height="15"`        | every file                                                         |
| Paint          | `<svg fill="none">`, `<path fill="currentColor">` | every file                                                         |
| Optical weight | 1px                                               | `plus` arm spans 7→8; `trash` wall is 1u; magnifier band r4.5→r3.5 |
| Terminals      | round, radius 0.5                                 | `plus`/`cross`/`check` ends curve on a 0.25–0.5 radius             |
| Joins          | round                                             | arrow tips and box corners                                         |
| Margin         | ~1–2px inside the box                             | `plus` 2.25–12.75; `gear` 0.65–14.35; `heart` 1.35–13.65           |
| Construction   | geometric, snapped                                | coordinates land on clean fractions                                |

## Why a stroke reproduces it

A 1px stroke with `stroke-linecap="round"` produces a semicircular terminal of radius `strokeWidth / 2 = 0.5` – identical to Radix's rounded filled terminals. `stroke-linejoin="round"` matches its corners. So at any size and colour the two are visually indistinguishable; the only difference is structural (stroke vs fill), which never renders.

The one caveat: Radix icons that are genuinely solid (dots, filled variants) are fills, not bands. Author those as fills too. Radix's carets look solid but are rounded wedges – reproduce them as a heavier round-capped stroke chevron (~1.2px), not a sharp filled triangle, so the terminals round the way Radix's do.

## Tier B: byte-identical filled output

Only needed if something requires actual filled paths (e.g. a consumer that recolours by `fill` and ignores `stroke`, or shipping into a set that must match Radix's structure exactly). Author the stroke as normal, then outline it once:

- **Figma / Illustrator** – "Outline stroke" / "Expand", then export.
- **Programmatic** – `svg-outline-stroke` (paper.js under the hood) or a paper.js `PaperOffset` script. Run it as a build step over `svg/`, emit to a `dist/filled/` set.

Keep the stroke sources as the editable source of truth either way; the filled set is derived, never hand-maintained.

## Naming

Reuse Radix's names wherever an analogue exists so the combined set reads as one vocabulary: `arrow-{up,down,left,right}`, `arrow-{top,bottom}-{left,right}`, `chevron-*`, `double-arrow-*`, `caret-*`, `magnifying-glass`, `cross`. Radix ships `cross-2` for the standalone X; prefer the name `cross` for a stroke-authored set's equivalent.
