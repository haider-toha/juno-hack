import type { ReactNode } from "react";
import { z } from "zod";

import { BackButton } from "@/components/back-button";
import { LetterViewer } from "@/components/letter/letter-viewer";
import { getDictionary, getLocale } from "@/lib/i18n/dictionary";
import { readPlan } from "@/lib/store/plan";

export async function generateMetadata() {
  const t = getDictionary(await getLocale());
  return { title: t.letter.metaTitle };
}

export const dynamic = "force-dynamic";

const Params = z.object({
  patientId: z.string().min(1),
  flag: z.string().min(1),
});

// "See where it says that" — resolve the flag's SourceRef on the server, then
// hand the blob URL + quote to the client viewer so the highlight cannot be
// pointed at a different sentence by rewriting the query string.
export default async function LetterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const raw = await searchParams;
  const parsed = Params.safeParse({
    patientId: singular(raw.patientId),
    flag: singular(raw.flag),
  });

  if (!parsed.success) {
    return (
      <Shell backHref="/plan" backLabel={t.common.back}>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
          {t.letter.title}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-ink-muted">
          {t.letter.missing}
        </p>
      </Shell>
    );
  }

  const { patientId, flag: flagId } = parsed.data;
  const bundle = await readPlan(patientId);
  const flag = bundle?.redFlags.find((entry) => entry.id === flagId);
  const document = bundle?.documents.find(
    (entry) => entry.id === flag?.source.documentId,
  );

  if (bundle === null || flag === undefined || document === undefined) {
    return (
      <Shell backHref="/plan" backLabel={t.common.back}>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
          {t.letter.title}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-ink-muted">
          {t.letter.missing}
        </p>
      </Shell>
    );
  }

  const sourceUrl = `/api/blob/source/${document.blobPathname
    .split("/")
    .map(encodeURIComponent)
    .join("/")}?patientId=${encodeURIComponent(patientId)}`;

  const page = flag.source.page;

  return (
    <Shell backHref="/plan" backLabel={t.common.back}>
      <header className="shrink-0 pb-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
          {t.letter.title}
        </h1>
        <p className="mt-1 text-base text-ink-muted">
          {page === null
            ? t.letter.blurb
            : t.letter.blurbPage.replace("{page}", String(page))}
        </p>
      </header>

      {document.capture === "pdf" ? (
        <LetterViewer
          url={sourceUrl}
          page={page}
          quote={flag.source.quote}
          t={t.letter}
        />
      ) : (
        <LetterPhoto src={sourceUrl} alt={document.displayName} />
      )}
    </Shell>
  );
}

function Shell({
  children,
  backHref,
  backLabel,
}: {
  children: ReactNode;
  backHref: string;
  backLabel: string;
}) {
  return (
    <main className="flex min-h-0 flex-1 flex-col bg-mist px-6 pb-6">
      <div className="-ml-2.5 shrink-0 pt-2">
        <BackButton href={backHref} label={backLabel} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col pt-2">{children}</div>
    </main>
  );
}

function singular(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

// Photographs and scans have no text layer to highlight — show the page
// itself and let the patient find the line by eye. Plain <img>: the bytes
// come through the private blob proxy, which next/image cannot optimise.
function LetterPhoto({ src, alt }: { src: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- authenticated blob proxy
    <img
      src={src}
      alt={alt}
      className="w-full rounded-tactile bg-surface shadow-card"
    />
  );
}
