import { BackButton } from "@/components/back-button";
import { DemoModeBadge } from "@/components/demo-mode-badge";
import { UploadPanel } from "@/components/upload/upload-panel";
import { getDictionary, getLocale } from "@/lib/i18n/dictionary";
import { DEMO_PATIENT_ID } from "@/lib/store/keys";

export async function generateMetadata() {
  const t = getDictionary(await getLocale());
  return { title: t.upload.metaTitle };
}

// Instruction, then action, then explanation — in that order and nothing
// between the first two. The paragraph about what we do with the pages is true
// and worth saying, but it is not what the patient has to do, so it sits at the
// foot with the other admissions rather than in front of the control.
export default async function UploadPage() {
  const t = getDictionary(await getLocale());

  return (
    <main className="flex min-h-0 flex-1 flex-col px-6">
      <div className="-ml-2.5 shrink-0 pt-2">
        <BackButton href="/" label={t.common.back} />
      </div>

      <div className="shrink-0 pt-4">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          {t.upload.title}
        </h1>
        <p className="mt-3 max-w-[36ch] text-lg leading-relaxed text-ink-muted">
          {t.upload.blurb}
        </p>
      </div>

      <div className="mt-7 shrink-0">
        {/* Only the panel's own strings cross the client boundary — the page
            keeps the rest of the dictionary on the server. */}
        <UploadPanel patientId={DEMO_PATIENT_ID} t={t.upload.panel} />
      </div>

      <footer className="mt-auto flex shrink-0 flex-col items-start gap-3 pt-10 pb-6">
        <DemoModeBadge text={t.common.demoMode} />
        <p className="max-w-[42ch] text-sm leading-relaxed text-ink-muted">
          {t.upload.footnote}
        </p>
      </footer>
    </main>
  );
}
