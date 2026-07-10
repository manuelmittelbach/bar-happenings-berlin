# Recurring-Verify bekommt einen eigenen model-freien Scheduler (vierter Sibling), statt scraped_verify_scheduler.py zu generalisieren

**Datum:** 2026-07-07 · **Status:** angenommen — **noch nicht umgesetzt**
(nach Grill-Session, alle Fragen entschieden; Bau-Plan:
`~/.claude/plans/verify-recurring-scheduler-port.md`).

## Kontext

Recurring-Verify (Serien-Roots read-only gegen ihre Quell-Seite prüfen: läuft
die Serie noch in ihrer Kadenz?) ist der letzte Sweep, der noch als JS-Workflow
über das Claude-Workflow-Tool läuft (`scripts/recurring-verify.workflow.js`).
IG-Scrape, Scraped-Verify und Website-Scrape sind bereits model-frei
(Python-Scheduler + Worker-Naht). Kernfrage wie in ADR 0003: den bestehenden
`scraped_verify_scheduler.py` generalisieren (`--mode scraped|recurring`) oder einen
eigenen Scheduler bauen?

## Entscheidung

Ein **eigener** `verify_recurring_scheduler.py` + `verify_recurring_workers/`
(`claude.py` = Adapter A, `other.py` = Gerüst) +
`verify_recurring_worker_contract.md` — „ein Scheduler pro Job" (ADR 0003).
Preis: das Scheduler-Skelett existiert damit bewusst **vierfach**; dafür bleibt
der e2e-getestete `scraped_verify_scheduler.py` unangetastet und der Contract muss
keine zwei Input-Formen beschreiben.

Details (alle einzeln gegrillt):

- **Naming `verify_recurring_*`** — gruppiert im Verzeichnis bei der
  Verify-Familie und dem bestehenden `verify_recurring_helper.py`, obwohl Doku
  und JS-Workflow „recurring-verify" heißen. Keine symmetrische Umbenennung von
  `scraped_verify_scheduler.py` (fasst Getestetes an, bringt nichts).
- **Worker-Infra geteilt mit Scraped-Verify** (anders als der Website-Port,
  der eigene Siblings bekam): dieselbe `playwright-verify.mcp.json`, dasselbe
  `/tmp/verify-screenshots`, dieselben `VERIFY_CLAUDE_*`-Env-Knobs. Beide
  Verify-Sweeps sind read-only gegen öffentliche Seiten am selben
  9222-Chrome und laufen nie gleichzeitig — eigene Kopien wären reiner
  Pflegeaufwand.
- **CLI = `scraped_verify_scheduler.py` minus Datumsfilter:** `--min-date`/
  `--skip-today` entfallen (Serien-Roots haben kein „kommendes Datum", nur
  Anker + Kadenz); `--roots-file` statt `--events-file`, `--max-series` statt
  `--max-events`. Keine neuen Filter-Flags.
- **Judging-Regeln haben weiterhin EINE Quelle:** `subAgentPrompt()` in
  `recurring-verify.workflow.js`, verbatim in den claude-Adapter gespiegelt
  (Sync-Pflicht, gleiches Muster wie beim Scraped-Verify-Port). Das
  Verdikt-Vokabular (inkl. `changed`) ist authoritative im Konsumenten
  `verify_recurring_helper.py`.
- **Der JS-Pfad bleibt dormant liegen** (nicht löschen); der Scheduler wird der
  dokumentierte Standardpfad. `RECURRING_VERIFY_WORKFLOW.md` wird zum
  Human-Explainer umgeschrieben; kein HANDOFF-Dokument (Design + Bau in
  Grill-Session + Plan-Datei festgehalten).
- Sequenziell-zwingend (ADR 0001) und Exit-75-Infra-Halt (ADR 0002) gelten
  unverändert.

## Konsequenzen

- Skelett-Fixes (Slicing, Summary, Exit-75-Handling, Telemetrie) müssen künftig
  in **vier** Schedulern nachgezogen werden — bewusst in Kauf genommen.
- Änderungen an den Judging-Regeln erfordern das Nachziehen des gespiegelten
  Worker-Prompts (ein Sync-Hinweis steht an beiden Stellen).

## Nachtrag 2026-07-10 (Umsetzung)

- **Naming revidiert:** Nicht `verify_recurring_*` (wie oben), sondern
  `recurring_verify_*` im eigenen Ordner `scripts/recurring_verify/` —
  Sibling-Konvention „Ordnername = Dateipräfix" (wie `scraped_verify/`). Der
  geteilte Helper bleibt flach als `scripts/verify_recurring_helper.py` (hängt an
  `recurring-images.workflow.js`), der Scheduler referenziert ihn eine Ebene höher.
- **Read-only bestätigt:** Die seit ADR 0005 in der Kopiervorlage vorhandene
  DB-Flag-Maschinerie wird NICHT übernommen — siehe ADR 0006.
