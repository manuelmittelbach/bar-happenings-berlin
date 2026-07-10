# Der Verify-Sweep flaggt Staging-Zeilen in der DB (Aufweichung der Read-only-Invariante)

**Datum:** 2026-07-10 · **Status:** angenommen · nach Grill-Session, alle Fragen
entschieden.

## Kontext

Scraped-Verify war bis hierher strikt read-only: Ergebnis war ein Markdown-Report
unter `/tmp` plus JSONL-Zwischenstände — `scraped_verify_helper.py` trug die
Invariante „NEVER writes to the database" wörtlich im Docstring. Das hatte drei
praktische Löcher:

1. Der Admin sieht die Verdikte **nicht dort, wo er entscheidet** (Dashboard,
   Scraped-Tab) — er müsste den Report neben dem Browser offen halten.
2. **Auto-Approve ist blind**: der Button gibt ungeprüfte und sogar als
   `not_found` beurteilte Events genauso frei wie bestätigte.
3. Nach einem vollen Sweep löscht `cleanup()` das JSONL — der nächste Sweep
   **prüft alle ~346 Events erneut** (je eine Claude-Session), obwohl sich die
   meisten nicht geändert haben.

## Entscheidung

Der Sweep **flaggt** jede geprüfte Staging-Zeile in `venue_events_staging`:
Verdikt + Evidence + Prüfzeitpunkt (drei `verify_*`-Spalten, Werte verbatim aus
dem bestehenden Vier-Wort-Vokabular). Die Invariante wird präzisiert, nicht
verworfen:

> Der Verify-Pfad schreibt **ausschließlich die `verify_*`-Flag-Spalten** —
> nie Event-Daten, nie Freigaben, nie Löschungen.

Arbeitsteilung bleibt wie gehabt: **nur der Helper** berührt die DB (neues
`flag`-Subcommand); der Scheduler ruft es pro Event direkt nach dem
JSONL-Append (crash-sicher, best-effort — ein Flag-Fehler stoppt den Sweep
nicht); Worker und Naht bleiben **unverändert**, Adapter B ist nicht betroffen.

Konsequenzen im Modell (alle in der Grill-Session entschieden):

- **Flag erlischt bei Refresh**: aktualisiert der Importer eine geflaggte Zeile
  (Felder vom neuen Scrape), werden die `verify_*`-Spalten geleert — ein
  Verdikt gilt nur für den Zeilenstand, den es geprüft hat.
- **Work-Liste schrumpft**: `list` überspringt geflaggte Events, außer
  `unreachable` (ergebnislos → nächster Lauf probiert erneut). `--recheck-all`
  erzwingt den Komplett-Check.
- **Auto-Approve gibt nur `confirmed` frei** — neue Zeilen wie Update-Zeilen.
  `confirmed_weak` (Datum unbestätigt) bleibt bewusst draußen: das
  unbestätigte Datum ist genau das Risiko, das der Sweep abfangen soll.

## Bewusst NICHT gemacht

- **Worker schreibt nicht selbst in die DB** — das würde die Naht verletzen und
  jeden Adapter B zwingen, Supabase-Logik zu duplizieren.
- **Kein Batch-Flush am Sweep-Ende** — bei einem harten Absturz stünde trotz
  vollem JSONL nichts in der DB; pro Event sofort ist derselbe
  Crash-Sicherheits-Baustein wie der JSONL-Append (ADR 0002).
- **Kein Flag an `venues`** — ein Verdikt gehört zu genau einem Event; eine
  Venue mit fünf Events hat fünf Verdikte.
- **Kein neues Verdikt-Vokabular** — die vier Werte bleiben verbatim
  (`confirmed`, `confirmed_weak`, `not_found`, `unreachable`), Report und
  Keep-Bias-Normalisierung unangetastet.

## Consequences

Der Betriebsablauf bekommt eine feste Reihenfolge: **scrape → verify →
auto-approve**. Direkt nach einem Scrape sind neue/refreshte Zeilen ungeflaggt,
der Button gibt dann (korrekt) nichts frei, bis der Verify-Sweep gelaufen ist.
Wer künftig im Helper-Code eine DB-Schreibstelle findet, soll sie an der
präzisierten Invariante messen: `verify_*`-Spalten ja, alles andere nein.
