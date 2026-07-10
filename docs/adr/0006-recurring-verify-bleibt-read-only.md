# Recurring-Verify bleibt read-only — die ADR-0005-DB-Flags gelten nur für Staging-Zeilen

**Datum:** 2026-07-10 · **Status:** angenommen · entschieden beim Port von
Recurring-Verify (grill-with-docs-Session), nachdem ADR 0005 am selben Tag die
Read-only-Invariante von Scraped-Verify aufgeweicht hatte.

## Kontext

Recurring-Verify wird laut ADR 0004 als vierter model-freier Sibling gebaut,
Kopiervorlage ist `scraped_verify_scheduler.py`. Diese Vorlage hat seit ADR 0005
(gleicher Tag) eine **DB-Schreibstelle**: `flag_in_db` schreibt pro Event die
`verify_*`-Spalten auf `venue_events_staging`, `list` überspringt geflaggte
Zeilen, und der Admin-Auto-Approve gibt nur noch `confirmed` frei. Beim Port
stellt sich damit eine Frage, die es zum 2026-07-07-Plan noch nicht gab: Erbt
Recurring-Verify dieselbe Flag-Maschinerie?

## Entscheidung

**Nein.** Recurring-Verify bleibt strikt **read-only** — `list` + `report`, wie
der JS-Workflow und `verify_recurring_helper.py` es schon sind. Kein
`flag_in_db`, kein `flag`-Subcommand, kein `--recheck-all`, keine neuen
`verify_*`-Spalten auf `events`. Das Ergebnis ist allein der Markdown-Report; der
Admin handelt daran von Hand.

Der Grund ist kein Zufall, sondern der andere Zweck des Sweeps:

- **Serien-Roots sind LIVE-`events` (approved)**, keine pending Staging-Zeilen
  vor der Freigabe. ADR 0005 löst „Verify-**vor**-Approve" — ein Problem, das es
  bei schon-live Roots gar nicht gibt. Ein `confirmed`-Flag auf einem Root würde
  nichts freigeben (er ist bereits live).
- Der Recurring-Sweep zeigt in die **umgekehrte** Richtung: `not_found`/`changed`
  sichtbar machen, damit der Admin eine LEBENDE Serie entfernt oder korrigiert —
  ein Report-and-act-by-hand-Flow, kein Freigabe-Flow. Es gibt keinen
  Auto-Approve-Button, den ein Flag schärfen könnte.
- Parität kostete neue `verify_*`-Spalten auf `events` **plus** ein Admin-UI-Badge
  für Serien. ADR 0005 war bewusst staging-only; diese Grenze wird nicht ohne Not
  überschritten.

## Bewusst NICHT gemacht

- **Keine `verify_*`-Spalten an `events`** und kein Serien-Badge im Dashboard —
  das wäre der Scope, den ADR 0005 für Staging aufmachte, ohne den passenden
  Approve-Flow hier.
- **Kein `--recheck-all`** — es gibt keinen DB-Flag, den ein „Komplett-Check"
  überspringen müsste. Re-Check-Semantik bleibt einfach: JSONL-`--fresh`.

## Consequences

Ohne DB-Flag gibt es keinen **persistenten** Skip: jeder frische Sweep prüft alle
Roots erneut (JSONL-Resume fängt nur Crashes innerhalb eines Laufs ab, `--fresh`
erzwingt den Neulauf). Bei ~2 Dutzend Roots ist das billig — der 0005-Skip zahlt
sich bei ~346 Staging-Events aus, hier nicht. Konkret fürs Skelett heißt das: der
`recurring_verify_scheduler.py` ist effektiv die **Pre-ADR-0005-Form** von
`scraped_verify_scheduler.py` — beim Kopieren fallen `flag_in_db`,
`--recheck-all` und die Datumsfilter (`--min-date`/`--skip-today`, Roots haben
kein „kommendes Datum") wieder heraus. Wer den Verify-Code später vereinheitlichen
will, muss diese Asymmetrie kennen: **Staging flaggt, `events` nicht.**
