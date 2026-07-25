import { BackButton } from "@/components/back-button";
import { DemoModeBadge } from "@/components/demo-mode-badge";
import { UploadPanel } from "@/components/upload/upload-panel";
import { DEMO_PATIENT_ID } from "@/lib/store/keys";

export const metadata = { title: "Add your letter" };

export default function UploadPage() {
  return (
    <main className="flex min-h-0 flex-1 flex-col px-5">
      <div className="-ml-2.5 shrink-0 pt-2">
        <BackButton href="/plan" />
      </div>

      <div className="flex flex-1 flex-col pt-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          Add your discharge letter
        </h1>
        <p className="mt-3 max-w-[42ch] text-base leading-relaxed text-ink-muted">
          Photograph each page, or choose the file if you already have it. We
          read the medicines, dates and advice off it and build your plan from
          what the letter actually says.
        </p>

        <div className="mt-6 empty:mt-0">
          <DemoModeBadge />
        </div>

        <div className="mt-6">
          <UploadPanel patientId={DEMO_PATIENT_ID} />
        </div>
      </div>
    </main>
  );
}
