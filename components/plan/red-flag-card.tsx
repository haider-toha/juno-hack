import { IconAlert } from "@/components/icons";
import type { DrugGuidance } from "@/lib/drugs/lookup";
import type { Contact, RedFlag, SourceDocument } from "@/lib/plan/schema";

export type MedicineGuidance = { name: string; guidance: DrugGuidance };

type Props = {
  flag: RedFlag;
  contacts: Contact[];
  document: SourceDocument | undefined;
  patientId: string;
  medicines: MedicineGuidance[];
  locale: "en" | "fr";
};

// The safety-netting line off the letter, and the one card where visual
// precedence is a safety property rather than a style choice: the doctor's
// words are primary and anything NHS-derived is visibly secondary, so a patient
// can always tell who said what.
export function RedFlagCard({
  flag,
  contacts,
  document,
  patientId,
  medicines,
  locale,
}: Props) {
  return (
    <section
      aria-labelledby={`flag-${flag.id}`}
      className="rounded-card bg-surface shadow-card"
    >
      <div className="flex items-start gap-3 px-5 pt-4">
        <span aria-hidden className="mt-0.5 shrink-0 text-error">
          <IconAlert className="size-5" />
        </span>
        <h2
          id={`flag-${flag.id}`}
          className="font-display text-lg font-semibold tracking-tight text-ink"
        >
          {locale === "fr" ? "Demandez de l’aide si" : "Get help if"}
        </h2>
      </div>

      <div className="px-5 pb-4 pt-2">
        {/* `lang` and `translate="no"` so a screen reader pronounces the
            clinician's English correctly and browser auto-translate cannot
            rewrite a clinical instruction behind the patient's back. */}
        <blockquote lang="en" translate="no" className="max-w-[46ch]">
          <p className="text-lg font-semibold leading-snug text-ink">
            {flag.triggerVerbatim}
          </p>
          <p className="mt-2 text-base leading-relaxed text-ink">
            {flag.actionVerbatim}
          </p>
        </blockquote>

        {locale === "fr" ? <FrenchRendering flag={flag} /> : null}

        <Recipients flag={flag} contacts={contacts} locale={locale} />

        <SourceTrace
          flag={flag}
          document={document}
          patientId={patientId}
          locale={locale}
        />
      </div>

      {medicines.length === 0 ? null : (
        <div className="border-t border-rule bg-mist px-5 py-4">
          <h3 className="text-sm font-semibold text-ink-muted">
            {locale === "fr"
              ? "À propos de vos médicaments"
              : "About your medicines"}
          </h3>
          <ul className="mt-2 flex flex-col gap-3">
            {medicines.map((medicine) => (
              <li key={medicine.name}>
                <Medicine medicine={medicine} locale={locale} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// Locked D7: the translation and the doctor's exact English, side by side, with
// the English labelled as the original. Never a replacement, and never a silent
// English fallthrough when no French has been authored — the card says so, in
// French.
function FrenchRendering({ flag }: { flag: RedFlag }) {
  const translated = flag.triggerFr !== null && flag.actionFr !== null;

  return (
    <div className="mt-4 rounded-tactile bg-lavender px-4 py-3">
      <p className="text-sm font-semibold text-accent">En français</p>
      {translated ? (
        <div className="mt-1 max-w-[46ch]" lang="fr">
          <p className="text-base font-semibold leading-snug text-ink">
            {flag.triggerFr}
          </p>
          <p className="mt-1 text-base leading-relaxed text-ink">
            {flag.actionFr}
          </p>
        </div>
      ) : (
        <p lang="fr" className="mt-1 max-w-[46ch] text-base text-ink">
          Cette consigne n’a pas encore été traduite. Le texte ci-dessus est
          celui de votre médecin, en anglais.
        </p>
      )}
      <p lang="fr" className="mt-2 text-sm text-ink-muted">
        Le texte en anglais ci-dessus est celui de votre médecin.
      </p>
    </div>
  );
}

function Recipients({
  flag,
  contacts,
  locale,
}: {
  flag: RedFlag;
  contacts: Contact[];
  locale: "en" | "fr";
}) {
  const named = contacts.filter((contact) =>
    flag.contactIds.includes(contact.id),
  );

  // The letter names no recipient on three of the five corpus letters. Saying
  // so is the honest render; upgrading it to 999 would be us speaking, not the
  // doctor.
  if (named.length === 0) {
    return (
      <p className="mt-4 max-w-[46ch] text-sm leading-relaxed text-ink-muted">
        {locale === "fr"
          ? "Votre lettre ne précise pas qui contacter dans ce cas."
          : "Your letter does not say who to contact for this."}
      </p>
    );
  }

  return (
    <ul className="mt-4 flex flex-col gap-2">
      {named.map((contact) => (
        <li key={contact.id}>
          {contact.phone === null ? (
            <span className="text-base text-ink">{contact.labelVerbatim}</span>
          ) : (
            <a
              href={`tel:${contact.phone.replace(/\s/g, "")}`}
              className="flex min-h-11 items-center rounded-tactile bg-lavender px-4 text-base font-semibold text-accent transition-opacity duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-70"
            >
              {contact.labelVerbatim}
              <span className="tnum ml-2 font-normal text-ink-muted">
                {contact.phone}
              </span>
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function SourceTrace({
  flag,
  document,
  patientId,
  locale,
}: {
  flag: RedFlag;
  document: SourceDocument | undefined;
  patientId: string;
  locale: "en" | "fr";
}) {
  if (document === undefined) return null;

  const page = flag.source.page;
  const href = `/api/blob/source/${document.blobPathname
    .split("/")
    .map(encodeURIComponent)
    .join("/")}?patientId=${encodeURIComponent(patientId)}${
    page === null ? "" : `#page=${page}`
  }`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="mt-4 flex min-h-11 items-center text-base font-semibold text-accent underline underline-offset-4 transition-opacity duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-70"
    >
      {locale === "fr" ? "Voir où c’est écrit" : "See where it says that"}
      {page === null
        ? ""
        : ` — ${locale === "fr" ? "page" : "page"} ${String(page)}`}
    </a>
  );
}

function Medicine({
  medicine,
  locale,
}: {
  medicine: MedicineGuidance;
  locale: "en" | "fr";
}) {
  const { name, guidance } = medicine;

  switch (guidance.kind) {
    case "found":
      return (
        <div>
          <p className="text-sm font-semibold text-ink">{name}</p>
          {guidance.match === "partial" ? (
            <p className="mt-0.5 max-w-[46ch] text-sm leading-relaxed text-ink-muted">
              {locale === "fr"
                ? `Le NHS ne décrit que le composant « ${guidance.slug} » de ce médicament.`
                : `The NHS page covers only the ${guidance.slug} part of this medicine.`}
            </p>
          ) : null}
          <ul className="mt-1 flex flex-col gap-2">
            {guidance.urgent.map((block) => (
              <li key={`${block.aspect}-${block.headline}`}>
                {/* Unmodified English, so it is attributed to the NHS and
                    carries the date it was read. A translation would be adapted
                    content, which may not name them at all. */}
                <p
                  lang="en"
                  className="max-w-[46ch] text-sm leading-relaxed text-ink-muted"
                >
                  <span className="font-semibold">{block.headline}</span>{" "}
                  {block.text}
                </p>
              </li>
            ))}
          </ul>
          <Attribution provenance={guidance.provenance} />
        </div>
      );
    case "no-urgent-guidance":
      return (
        <div>
          <p className="text-sm font-semibold text-ink">{name}</p>
          <p className="mt-0.5 max-w-[46ch] text-sm leading-relaxed text-ink-muted">
            {locale === "fr"
              ? "La page du NHS pour ce médicament ne contient pas de consigne d’urgence."
              : "The NHS page for this medicine carries no urgent advice."}
          </p>
          <Attribution provenance={guidance.provenance} />
        </div>
      );
    case "absent":
      return (
        <div>
          <p className="text-sm font-semibold text-ink">{name}</p>
          <p className="mt-0.5 max-w-[46ch] text-sm leading-relaxed text-ink-muted">
            {locale === "fr"
              ? "Ce médicament ne figure pas dans l’index des médicaments du NHS."
              : "This medicine is not in the NHS medicines A to Z."}
          </p>
        </div>
      );
    // Never rendered as "not listed": a failed lookup and a drug with no page
    // are different facts, and only one of them is about the medicine.
    case "unavailable":
      return (
        <div>
          <p className="text-sm font-semibold text-ink">{name}</p>
          <p className="mt-0.5 max-w-[46ch] text-sm leading-relaxed text-ink-muted">
            {locale === "fr"
              ? "Nous n’avons pas pu joindre le NHS pour ce médicament."
              : "We could not reach the NHS for this medicine just now."}
          </p>
        </div>
      );
  }
}

// The licence requires attribution on every separate appearance of NHS content,
// with an "as at" date on anything not being refreshed. A cached or seeded copy
// is dated; a live read is not.
function Attribution({
  provenance,
}: {
  provenance: { origin: "nhs" | "cache" | "seed"; retrievedOn: string };
}) {
  return (
    <p lang="en" className="mt-1.5 text-xs leading-relaxed text-ink-muted">
      Information from the NHS website
      {provenance.origin === "nhs"
        ? ""
        : `, as at ${asAt(provenance.retrievedOn)}`}
      , licensed under the{" "}
      <a
        href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2"
      >
        Open Government Licence v3.0
      </a>
      .
    </p>
  );
}

function asAt(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}
