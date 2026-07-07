# Der Website-Scrape bekommt einen eigenen model-freien Scheduler (spiegelt Verify), statt den IG-Scheduler zu generalisieren

**Datum:** 2026-07-06 · **Status:** angenommen · nach Grill-Session, alle Fragen
entschieden. **Umgesetzt am 2026-07-07** (Phase 0–3 + MCP-Config; Adapter B / Phase 4
bewusst offen, End-to-End-Scrape steht aus). Bau-Details:
`scripts/website_scrape/WEBSITE_SCRAPE_SCHEDULER_HANDOFF.md` → „Umsetzungsstand".

## Kontext

Der Website-(„visual"-)Scrape läuft heute als JS-Workflow
(`scripts/website_scrape/website-scrape.workflow.js`): ein Sub-Agent pro Venue, sequenziell,
jeder schreibt selbst in die DB. Wir wollten ihn — wie zuvor den IG-Scrape
(`scrape_scheduler.py`) und Verify (`verify_scheduler.py`) — **modell-frei**
machen: ein Python-Scheduler + ein austauschbarer Worker-Adapter, lauffähig auf
`python3` ohne Claude-Runtime.

Der entscheidende Fund: Der Website-Scrape teilt seine **portablen Enden** schon
heute mit dem IG-Scrape — `import_visual_events.py` (Importer) und
`stage_visual_placeholder.py` (Placeholder) sind dieselben, quellen-agnostischen
Skripte, und `visual_scrape_helper.py list` (wird zu `website_scrape_helper.py`
umbenannt) baut die Work-Liste bereits. Nur die
**Mitte** (der eigentliche Scrape pro Venue) steckt noch im JS-Workflow.

Kernfrage: den bestehenden `scrape_scheduler.py` **generalisieren**
(`--source instagram|website`), oder einen **eigenen** Scheduler bauen?

## Entscheidung

Ein **eigener** `website_scrape_scheduler.py` + `website_workers/`
(`__init__.py`, `claude.py` = Adapter A, `other.py` = Gerüst), der das
**Verify-Muster spiegelt** — nicht den IG-Scheduler generalisiert. Er teilt die
portablen Enden (Helper, Importer, Placeholder, die Field-Rules-Manuale)
unverändert mit dem JS-Workflow.

**Namensschema (festgelegt 2026-07-07):** alle NEUEN Artefakte heißen
`website_scrape_*` / `website_*` (nicht „visual" — historisch, nichtssagend). Der
Helper wird **mit umbenannt**: `visual_scrape_helper.py` → `website_scrape_helper.py`
samt Aufrufern. Die breit geteilten `import_visual_events.py` +
`stage_visual_placeholder.py` behalten ihren Namen (sie hängen an IG/Telegram/
Verify — Umbenennen schlüge dort überall rein).

**Warum eigener Scheduler statt `--source`:** konsistent mit dem etablierten
„ein Scheduler pro Job" (IG, Verify, jetzt Website); der laufende IG-Sweep bleibt
unangetastet; die vielen Verhaltens-Unterschiede würden sonst zu if-Zweigen in
einer Datei. Preis: das Scheduler-Skelett (Slicing / Summary / Exit-75) existiert
dreifach — bewusst in Kauf genommen.

Die konkreten Abweichungen vom IG-Scheduler (alle einzeln gegrillt):

- **Browser/Auth = Verify, nicht IG.** Read-only öffentliche Seiten, **kein
  Login.** Adapter A dockt ans geteilte, echte Chrome auf CDP-Port 9222 an
  (eigene Sibling-Config `scripts/website_scrape/playwright-website.mcp.json`, `--output-dir
  /tmp/playwright-website`) — Anti-Bot-403 trifft beliebige Venue-Domains hart,
  das gepinnte Chrome kommt durch. Der Scheduler macht **keinen Login-Preflight**,
  sondern den nativen `ensure_cdp_browser`-Check (HTTP-Ping auf
  `localhost:9222/json/version`), gated auf CDP-Worker, mit `--skip-preflight`.
  Der Worker hat **keinen `--preflight`-Modus**, und der `not-logged-in`-Abbruch
  (Exit 2) des IG-Schedulers **entfällt**. Sequenziell bleibt **zwingend**
  (geteilter Tab — dieselbe Logik wie ADR 0001).

- **Kein Pacing.** Viele verschiedene Domains → **kein** Ein-Plattform-Bann.
  Also **keine** Batch- oder Handoff-Pausen (anders als IG, das 10-Min-Pausen
  gegen instagram.com hat). `--offset` / `--max-venues` bleiben nur zum Stückeln.

- **Kein `lookbackDays`.** Kein Feed — man liest eine Event-Seite. Der Input
  trägt `website_events` + optionales `scrape_prompt` statt `instagram`; das
  eigene `website_workers/__init__.py.load_input` verlangt `venue.website_events`.

- **Crash-Recovery = IG-Exit-75 + Offset-Resume.** 1:1 übernommen wie gerade im
  IG-Scrape gebaut (ADR 0002): der Worker meldet einen Sweep-weiten Infra-Fehler
  (Token-/Usage-Limit, kein API-Kontakt, CLI fehlt) per **Exit 75** und schreibt
  kein Ergebnis; der Scheduler **hält an**, macht **kein** Cleanup, druckt Teil-
  Report + `--offset <start+venue_pos>`-Resume-Hinweis. `124` (Einzel-Timeout
  einer lahmen Seite) und `126` (transient während CLI-Auto-Update) → bleiben
  per-Venue-Fehler + weiter. Da Login wegfällt, ist Exit 75 der **einzige**
  Halt-Weg.

**Output + Result unverändert:** `events.json` in der Form, die
`import_visual_events.py` erwartet (geteilt); Result `{venue_name, status,
usage?}` wie IG, nur ohne `reason:"not-logged-in"`.

## Bewusst NICHT gemacht

- **Keine Generalisierung** von `scrape_scheduler.py` (`--source`) — die
  Unterschiede sind zu groß, der laufende IG-Pfad bleibt so risikofrei.
- **Kein Login-Preflight, keine Pausen, kein Lookback** — siehe oben.
- **Kein neuer Importer / Placeholder / Helper** — die portablen Enden sind schon
  quellen-agnostisch und werden geteilt (der Helper wird nur umbenannt, nicht neu
  gebaut).
- **Kein Ledger-Resume** (wie Verifys id-Resume) — der Scrape schreibt direkt in
  die DB und ist über den Importer-Dedup idempotent; Offset-Resume nach Exit-75
  reicht.

## Consequences

Wer künftig einen dritten, fast baugleichen Scheduler sieht, soll ihn **nicht**
zu einem generischen `--source`-Monolithen „aufräumen" — die Trennung ist
gewollt (Robustheit des IG-Sweeps + saubere, quellen-spezifische Defaults). Der
Website-Scraper ist im Kern **ein Verify-Scheduler mit dem Importer/Placeholder-
Ende des IG-Schedulers**: Verify-Browser-Modell (9222, kein Login), IG-Crash-
Recovery (Exit 75), keine Pausen. Der JS-Workflow `website-scrape.workflow.js`
bleibt vorerst als Referenz für die Sub-Agent-Prozedur (`subAgentPrompt()` →
`venue_prompt()` des neuen Adapters, verbatim gespiegelt).
