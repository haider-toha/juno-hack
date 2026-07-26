"use client";

import { useEffect, useRef, useState } from "react";

import type { Dictionary } from "@/lib/i18n/en";

type Strings = Dictionary["letter"];

type Props = {
  url: string;
  page: number | null;
  quote: string;
  t: Strings;
};

type Highlight = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type Phase =
  | { kind: "loading" }
  | { kind: "ready"; highlights: Highlight[] }
  | { kind: "error"; message: string };

// In-app letter view: render the page the quote lives on, then paint a soft
// highlight over the glyphs that match `SourceRef.quote`. Native PDF viewers
// can jump to `#page=N` but cannot highlight a sentence from a URL — that is
// why this is a client leaf rather than a bare link to the blob route.
export function LetterViewer({ url, page, quote, t }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  useEffect(() => {
    const surface = canvasRef.current;
    if (surface === null) return;

    const ac = new AbortController();
    let destroyLoad: (() => void) | null = null;

    async function render(canvas: HTMLCanvasElement) {
      setPhase({ kind: "loading" });
      try {
        // Served from /public — Turbopack cannot reliably bundle the pdf.js
        // worker via `new Worker(new URL(...))`, which is what webpack.mjs does.
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        // Fetch the bytes ourselves. The blob proxy streams without
        // Accept-Ranges, and pdf.js's ranged/streamed fetch aborts against it.
        const bytes = await fetch(url, { signal: ac.signal }).then(
          (response) => {
            if (!response.ok) throw new Error(`letter ${response.status}`);
            return response.arrayBuffer();
          },
        );
        if (ac.signal.aborted) return;

        const loadingTask = pdfjs.getDocument({ data: bytes });
        destroyLoad = () => {
          void loadingTask.destroy();
        };
        const doc = await loadingTask.promise;
        if (ac.signal.aborted) return;

        const pageNumber = Math.min(Math.max(page ?? 1, 1), doc.numPages);
        const pdfPage = await doc.getPage(pageNumber);
        if (ac.signal.aborted) return;

        // Fit the page to the column's CSS width, then paint into a backing
        // store scaled by devicePixelRatio. Without that, a 1× canvas is
        // stretched across a 2×/3× phone screen and the letter goes soft.
        const cssWidth = canvas.parentElement?.clientWidth ?? 360;
        const unscaled = pdfPage.getViewport({ scale: 1 });
        const scale = cssWidth / unscaled.width;
        const viewport = pdfPage.getViewport({ scale });
        const pixelRatio = Math.max(window.devicePixelRatio || 1, 1);

        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const context = canvas.getContext("2d");
        if (context === null) {
          setPhase({ kind: "error", message: t.failed });
          return;
        }

        const renderTask = pdfPage.render({
          canvas,
          canvasContext: context,
          viewport,
          transform:
            pixelRatio === 1
              ? undefined
              : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        });
        await renderTask.promise;
        if (ac.signal.aborted) return;

        const text = await pdfPage.getTextContent();
        if (ac.signal.aborted) return;

        const highlights = locateQuote(
          text.items,
          quote,
          viewport.transform,
          scale,
          pdfjs.Util.transform,
        );

        setPhase({ kind: "ready", highlights });
      } catch (error) {
        if (ac.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setPhase({ kind: "error", message: t.failed });
      }
    }

    void render(surface);
    return () => {
      ac.abort();
      destroyLoad?.();
    };
  }, [url, page, quote, t.failed]);

  useEffect(() => {
    if (phase.kind !== "ready" || phase.highlights.length === 0) return;
    const first = document.getElementById("letter-highlight-0");
    first?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [phase]);

  return (
    <div className="relative w-full">
      <canvas
        ref={canvasRef}
        className="block max-w-full rounded-tactile bg-surface shadow-card"
        aria-label={t.pageLabel.replace("{page}", String(page ?? 1))}
      />
      {phase.kind === "ready"
        ? phase.highlights.map((box, index) => (
            <div
              key={`${box.left}-${box.top}-${box.width}`}
              id={index === 0 ? "letter-highlight-0" : undefined}
              aria-hidden
              className="pointer-events-none absolute rounded-sm bg-accent/40 mix-blend-multiply"
              style={{
                left: box.left,
                top: box.top,
                width: box.width,
                height: box.height,
              }}
            />
          ))
        : null}
      {phase.kind === "loading" ? (
        <p className="mt-3 text-base text-ink-muted">{t.loading}</p>
      ) : null}
      {phase.kind === "error" ? (
        <p className="mt-3 text-base text-ink-muted">{phase.message}</p>
      ) : null}
      {phase.kind === "ready" && phase.highlights.length === 0 ? (
        <p className="mt-3 text-base text-ink-muted">{t.notFound}</p>
      ) : null}
    </div>
  );
}

type TextRow = {
  str: string;
  width: number;
  transform: number[];
};

type CharRef = { row: number; offset: number };

// Join text items the way the page reads (spaces between runs), find the
// quote with flexible whitespace, then map the match back onto glyph boxes —
// including partial runs when the quote sits inside a longer line.
function locateQuote(
  items: ReadonlyArray<object>,
  quote: string,
  viewportTransform: number[],
  viewportScale: number,
  transform: (m1: number[], m2: number[]) => number[],
): Highlight[] {
  const rows: TextRow[] = [];
  for (const item of items) {
    if (!isTextRow(item)) continue;
    rows.push(item);
  }

  let haystack = "";
  // Per character in `haystack`: which row and which offset inside that row,
  // or null for a synthetic space we inserted between items.
  const map: Array<CharRef | null> = [];

  for (let row = 0; row < rows.length; row += 1) {
    const text = rows[row]?.str;
    if (text === undefined) continue;
    if (haystack.length > 0) {
      haystack += " ";
      map.push(null);
    }
    for (let offset = 0; offset < text.length; offset += 1) {
      haystack += text[offset];
      map.push({ row, offset });
    }
  }

  const pattern = quote.trim().split(/\s+/).map(escapeRegExp).join("\\s+");
  if (pattern.length === 0) return [];

  const match = new RegExp(pattern, "i").exec(haystack);
  if (match === null) return [];

  const from = match.index;
  const to = from + match[0].length;
  const highlights: Highlight[] = [];

  for (let i = from; i < to; ) {
    const anchor = map[i];
    if (anchor === null || anchor === undefined) {
      i += 1;
      continue;
    }

    const { row } = anchor;
    const start = anchor.offset;
    let end = start;
    while (i < to) {
      const next = map[i];
      if (next === null || next === undefined || next.row !== row) break;
      end = next.offset + 1;
      i += 1;
    }

    const textRow = rows[row];
    if (textRow === undefined) continue;
    const box = glyphBox(
      textRow,
      start,
      end,
      viewportTransform,
      viewportScale,
      transform,
    );
    if (box !== null) highlights.push(box);
  }

  return mergeTouches(highlights);
}

function isTextRow(item: object): item is TextRow {
  return (
    "str" in item &&
    typeof item.str === "string" &&
    item.str.length > 0 &&
    "width" in item &&
    typeof item.width === "number" &&
    "transform" in item &&
    Array.isArray(item.transform)
  );
}

function glyphBox(
  row: TextRow,
  start: number,
  end: number,
  viewportTransform: number[],
  viewportScale: number,
  transform: (m1: number[], m2: number[]) => number[],
): Highlight | null {
  if (end <= start || row.str.length === 0) return null;

  const tx = transform(viewportTransform, row.transform);
  const x = tx[4];
  const y = tx[5];
  const c = tx[2];
  const d = tx[3];
  if (
    x === undefined ||
    y === undefined ||
    c === undefined ||
    d === undefined
  ) {
    return null;
  }

  // `row.width` is already in PDF user space; only the viewport scale maps it
  // to CSS pixels. Multiplying by the text-matrix scale (font size) double-
  // counts and paints a wash wider than the page.
  // Fit-width on a phone shrinks 10pt type to a few CSS pixels; floor the
  // wash so the mark still reads as a highlighter, not a hairline.
  const fontHeight = Math.max(Math.hypot(c, d), 10);
  const fullWidth = row.width * viewportScale;
  const left = x + fullWidth * (start / row.str.length);
  const width = fullWidth * ((end - start) / row.str.length);
  const pad = fontHeight * 0.25;

  return {
    left,
    top: y - fontHeight - pad,
    width,
    height: fontHeight + pad * 2,
  };
}

function mergeTouches(boxes: Highlight[]): Highlight[] {
  if (boxes.length === 0) return boxes;
  const sorted = [...boxes].sort((a, b) => a.top - b.top || a.left - b.left);
  const first = sorted[0];
  if (first === undefined) return boxes;
  const out: Highlight[] = [{ ...first }];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = out[out.length - 1];
    const next = sorted[i];
    if (prev === undefined || next === undefined) continue;
    // Only glue fragments on the same baseline that continue to the right —
    // never a lower line back into a higher one, or the wash becomes a
    // full-width bar across the whole paragraph.
    const sameLine = Math.abs(prev.top - next.top) <= 2;
    const continues =
      next.left <= prev.left + prev.width + 2 && next.left >= prev.left;
    if (sameLine && continues) {
      const right = Math.max(prev.left + prev.width, next.left + next.width);
      prev.width = right - prev.left;
      prev.height = Math.max(prev.height, next.height);
    } else {
      out.push({ ...next });
    }
  }
  return out;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
