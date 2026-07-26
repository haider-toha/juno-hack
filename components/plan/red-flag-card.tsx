import { secondaryButton } from "@/components/button-styles";
import { IconAlert, IconChevron } from "@/components/icons";
import type { DrugGuidance, Provenance } from "@/lib/drugs/lookup";
import type { Dictionary } from "@/lib/i18n/en";
import type { Locale } from "@/lib/i18n/locales";
import type { Contact, RedFlag, SourceDocument } from "@/lib/plan/schema";

export type MedicineGuidance = { name: string; guidance: DrugGuidance };

type Strings = Dictionary["redFlag"];
type NhsStrings = Dictionary["nhs"];

type Props = {
  flag: RedFlag;
  contacts: Contact[];
  document: SourceDocument | undefined;
  patientId: string;
  medicines: MedicineGuidance[];
  locale: Locale;
  t: Strings;
  nhs: NhsStrings;
};

// The safety-netting line off the letter, and the one card where visual
// precedence is a safety property rather than a style choice: the doctor's
// words are primary and anything NHS-derived is visibly secondary, so a patient
// can always tell who said what. Precedence is height as well as weight — the
// NHS block is a closed disclosure, because a screen of it above today's doses
// is the secondary thing being primary.
export function RedFlagCard({
  flag,
  contacts,
  document,
  patientId,
  medicines,
  locale,
  t,
  nhs,
}: Props) {
  return (
    <section
      // Named by the heading AND the trigger: a letter with several red flags
      // would otherwise give every card the identical name "Get help if", and a
      // list of identically-named regions is no help at all.
      aria-labelledby={`flag-${flag.id} flag-${flag.id}-trigger`}
      // `error-soft`, not `surface`. Every other block on this screen is a white
      // or lavender card, and the one that says get help was the same shape and
      // the same colour as the one listing tomorrow's statin — it had to be read
      // to be found. Colour is the only thing that works before reading.
      className="rounded-card bg-error-soft shadow-card"
    >
      <div className="flex items-center gap-2.5 px-5 pt-4">
        <span aria-hidden className="shrink-0 text-error">
          <IconAlert className="size-5" />
        </span>
        {/* A step below the trigger, not level with it: this is the card's
            frame and the clinician's sentence is its content. */}
        <h2
          id={`flag-${flag.id}`}
          className="font-display text-base font-semibold tracking-tight text-ink"
        >
          {t.getHelpIf}
        </h2>
      </div>

      <div className="px-5 pb-4 pt-1.5">
        {/* `lang` and `translate="no"` so a screen reader pronounces the
            clinician's English correctly and browser auto-translate cannot
            rewrite a clinical instruction behind the patient's back. */}
        <blockquote lang="en" translate="no">
          <p
            id={`flag-${flag.id}-trigger`}
            className="text-xl font-semibold leading-snug text-ink"
          >
            {flag.triggerVerbatim}
          </p>
          {/* No size class: the app's 17px body baseline. What to do about it
              is the second-loudest thing on the card, under what to watch for
              and above everything we added around them. */}
          <p className="mt-2 leading-relaxed text-ink">{flag.actionVerbatim}</p>
        </blockquote>

        {locale === "fr" ? <FrenchRendering flag={flag} t={t} /> : null}

        <Recipients flag={flag} contacts={contacts} t={t} />

        <SourceTrace
          flag={flag}
          document={document}
          patientId={patientId}
          t={t}
        />
      </div>

      {medicines.length === 0 ? null : (
        <details className="group rounded-b-card border-t border-rule bg-mist">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-5 py-2.5 transition-opacity duration-150 ease-out hover:opacity-90 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent active:opacity-80 [&::-webkit-details-marker]:hidden">
            <h3 className="text-base font-semibold text-ink-muted">
              {nhs.heading}
            </h3>
            <IconChevron className="size-4 shrink-0 text-ink-faint group-open:rotate-90" />
          </summary>
          <ul className="flex flex-col gap-3 px-5 pb-4">
            {medicines.map((medicine) => (
              <li key={medicine.name}>
                <Medicine medicine={medicine} t={nhs} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

// Locked D7: the translation and the doctor's exact English, side by side, with
// the English labelled as the original. Never a replacement, and never a silent
// English fallthrough when no French has been authored — the card says so, in
// French.
function FrenchRendering({ flag, t }: { flag: RedFlag; t: Strings }) {
  const translated = flag.triggerFr !== null && flag.actionFr !== null;

  return (
    <div className="mt-4 rounded-tactile bg-mist px-4 py-3">
      <p className="text-sm font-semibold text-ink-muted">
        {t.translationHeading}
      </p>
      {translated ? (
        <div className="mt-1" lang="fr">
          <p className="text-base font-semibold leading-snug text-ink">
            {flag.triggerFr}
          </p>
          <p className="mt-1 text-base leading-relaxed text-ink">
            {flag.actionFr}
          </p>
        </div>
      ) : (
        <p className="mt-1 text-base leading-relaxed text-ink">
          {t.untranslated}
        </p>
      )}
      <p className="mt-2 text-sm text-ink-muted">{t.originalNote}</p>
    </div>
  );
}

function Recipients({
  flag,
  contacts,
  t,
}: {
  flag: RedFlag;
  contacts: Contact[];
  t: Strings;
}) {
  const named = contacts.filter((contact) =>
    flag.contactIds.includes(contact.id),
  );

  // The letter names no recipient on three of the five corpus letters. Saying
  // so is the honest render; upgrading it to 999 would be us speaking, not the
  // doctor.
  if (named.length === 0) {
    return (
      <p className="mt-4 text-base leading-relaxed text-ink-muted">
        {t.noRecipient}
      </p>
    );
  }

  return (
    <ul className="mt-4 flex flex-col gap-2">
      {named.map((contact) => (
        <li key={contact.id}>
          {contact.phone === null ? (
            <span lang="en" className="text-base text-ink">
              {contact.labelVerbatim}
            </span>
          ) : (
            // The one accent-coloured thing on the card. Everything else is
            // either the doctor's words or the trail back to them.
            <a
              href={`tel:${contact.phone.replace(/\s/g, "")}`}
              className={`${secondaryButton} bg-mist`}
            >
              <span lang="en">{contact.labelVerbatim}</span>
              <span className="tnum ml-auto text-ink-muted">
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
  t,
}: {
  flag: RedFlag;
  document: SourceDocument | undefined;
  patientId: string;
  t: Strings;
}) {
  if (document === undefined) return null;

  const page = flag.source.page;
  // In-app viewer (not a raw PDF tab): the page resolves this flag's quote and
  // highlights the glyphs. `document` is only a presence check here — the
  // letter route re-reads the plan so a rewritten query cannot point elsewhere.
  const href = `/letter?patientId=${encodeURIComponent(patientId)}&flag=${encodeURIComponent(flag.id)}`;

  // Provenance, not an action: it is the quietest thing that still reads as a
  // link, so it cannot compete with the number a frightened patient should be
  // ringing.
  return (
    <a
      href={href}
      className="mt-2 flex min-h-11 items-center text-base text-ink-muted underline underline-offset-4 transition duration-150 ease-out hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-80"
    >
      {t.viewSource}
      {page === null ? "" : t.sourcePage.replace("{page}", String(page))}
    </a>
  );
}

function Medicine({
  medicine,
  t,
}: {
  medicine: MedicineGuidance;
  t: NhsStrings;
}) {
  const { name, guidance } = medicine;

  switch (guidance.kind) {
    case "found":
      return (
        <div>
          <p lang="en" className="text-base font-semibold text-ink">
            {name}
          </p>
          {guidance.match === "partial" ? (
            <p className="mt-0.5 text-base leading-relaxed text-ink-muted">
              {t.partialMatch.replace("{part}", guidance.slug)}
            </p>
          ) : null}
          <ul className="mt-1 flex flex-col gap-2">
            {/* Index in the key: two blocks can share an aspect and a headline
                ("Call NHS 111 if:" appears twice on amlodipine), and on their
                own those two fields are not a key. */}
            {guidance.urgent.map((block, index) => (
              <li key={`${index}-${block.aspect}-${block.headline}`}>
                {/* Unmodified English, so it is attributed to the NHS and
                    carries the date it was read. A translation would be adapted
                    content, which may not name them at all — which is why the
                    frame around it is translated and this is not. */}
                <p
                  lang="en"
                  className="text-base leading-relaxed text-ink-muted"
                >
                  <span className="font-semibold">{block.headline}</span>{" "}
                  {block.text}
                </p>
              </li>
            ))}
          </ul>
          <Attribution provenance={guidance.provenance} t={t} />
        </div>
      );
    case "no-urgent-guidance":
      return (
        <div>
          <p lang="en" className="text-base font-semibold text-ink">
            {name}
          </p>
          <p className="mt-0.5 text-base leading-relaxed text-ink-muted">
            {t.noUrgent}
          </p>
          <Attribution provenance={guidance.provenance} t={t} />
        </div>
      );
    case "absent":
      return (
        <div>
          <p lang="en" className="text-base font-semibold text-ink">
            {name}
          </p>
          <p className="mt-0.5 text-base leading-relaxed text-ink-muted">
            {t.notListed}
          </p>
        </div>
      );
    // Never rendered as "not listed": a failed lookup and a drug with no page
    // are different facts, and only one of them is about the medicine.
    case "unavailable":
      return (
        <div>
          <p lang="en" className="text-base font-semibold text-ink">
            {name}
          </p>
          <p className="mt-0.5 text-base leading-relaxed text-ink-muted">
            {t.unreachable}
          </p>
        </div>
      );
  }
}

// The licence requires attribution on every separate appearance of NHS content,
// with an "as at" date on anything not being refreshed. A cached or seeded copy
// is dated; a live read is not. A `stale` copy is a third thing — the live read
// failed and this stood in for it — and it says so, because an outage rendered
// as a healthy cache hit is the one reading a patient must not be given.
function Attribution({
  provenance,
  t,
}: {
  provenance: Provenance;
  t: NhsStrings;
}) {
  const dated = asAt(provenance.retrievedOn);

  return (
    <>
      {provenance.stale ? (
        <p className="mt-1.5 text-sm font-medium leading-relaxed text-ink-muted">
          {t.stale.replace("{date}", dated)}
        </p>
      ) : null}
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
        {provenance.origin === "nhs"
          ? t.attribution
          : t.attributionDated.replace("{date}", dated)}{" "}
        <a
          href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 transition duration-150 ease-out hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-80"
        >
          {/* The licence's legal name, never translated — the same class of
              proper noun as "NHS" and "Portico", so it stays out of the
              dictionary where a translator would be invited to change it. */}
          <span lang="en">Open Government Licence v3.0</span>
          <span className="sr-only">{t.newTab}</span>
        </a>
        .
      </p>
    </>
  );
}

// dd/mm/yyyy reads the same way in both languages, so the one formatter serves
// both.
function asAt(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}
