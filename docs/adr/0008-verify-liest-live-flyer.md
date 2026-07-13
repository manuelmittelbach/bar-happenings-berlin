# Verify liest den Live-Flyer der Quell-Seite (nicht den gespeicherten), wenn der Text allein nur schwach reicht

**Datum:** 2026-07-13 · **Status:** angenommen · nach Grill-Session, alle Fragen
entschieden.

## Kontext

Die Scraper von IG und Telegram ziehen die Event-Wahrheit **primär aus dem
Flyer-Bild** — Datum/Zeit/Lineup steckt oft nur dort, nicht in der Caption; die
Field-Rules weisen ausdrücklich an, den Flyer per Vision zu lesen (Screenshot +
`Read`) und mit dem Text zu kombinieren.

Der Verify-Worker las bisher nur den **Seitentext** (`document.body.innerText`)
plus Embeds/iframes. Das angehängte Post-Bild las er nur, wenn die **ganze
Seite** ein Bild war. Bei einem IG-/Telegram-Post steht die Caption aber als Text
da → der `content is an image`-Zweig greift nie → **der Flyer wird nie gelesen**.

Folge: Was der Scraper aus dem Flyer extrahiert hat (z. B. „Copa Karaoke –
Semifinal Edition", 15.07), kann Verify nicht gegenprüfen. Buchstabiert die
Caption Titel/Datum nicht aus, landet ein **echtes** Event auf `confirmed_weak`
statt `confirmed`; Auto-Approve greift dann nicht und es wandert unnötig in die
manuelle Freigabe.

## Entscheidung

Der Verify-Worker liest den Flyer — aber den **Live-Flyer der Quell-Seite**, nicht
den gespeicherten, rehosteten `image` aus dem Staging.

Gate (Kosten **und** Semantik), proaktiv in den bestehenden „Titel nicht im Text →
schau tiefer"-Zweig (Step 2) eingefaltet:

- Flyer wird **nur** gelesen, wenn die Seite geladen hat **und** der Text (inkl.
  Embeds) den Titel für sein Datum nicht bestätigt — also der Fall, der sonst
  `confirmed_weak`/`not_found` würde.
- Text bestätigt Titel + Datum → `confirmed`, **kein** Flyer-Read.
- Seite lädt nicht (404/Timeout/Login-Wall/Anti-Bot) → terminal `unreachable`,
  **kein** Flyer-Versuch.

Der Verifier bleibt **quellen-agnostisch**: die Regel lautet schlicht „Titel nicht
im Text bestätigt **und** Seite zeigt ein Event-/Cover-Bild → lies es". Kein
Verzweigen nach Quelle.

Das feste **Vier-Wort-Vokabular bleibt unangetastet**; der Flyer speist nur die
bestehenden Signale:

- Flyer zeigt Titel **und** das gespeicherte Datum explizit → `confirmed`
  (→ Auto-Approve).
- Flyer zeigt nur den Titel (kein Abgleich aufs gespeicherte Datum möglich) →
  `confirmed_weak`.
- `not_found` ist **erst erlaubt, nachdem der Flyer gelesen wurde** — Seite
  geladen, Text **und** Flyer zeigen den Titel nicht. Das macht `not_found`
  seltener, aber belastbarer.

### Warum Live statt gespeichert

Der gespeicherte `image` ist **genau das Bild, das der Scraper bereits gelesen
hat**, um Titel/Datum zu erzeugen. Ein Re-Read wäre tautologisch (prüft den
Scraper gegen sich selbst) und — entscheidend — **kein Lebendigkeits-Check**: ein
längst gelöschter Post würde über den eingefrorenen Flyer trotzdem `confirmed`
und auto-approved. Der Live-Flyer bewahrt die Kern-Invariante von Scraped-Verify
(„steht das Event noch auf der Quell-Seite?"): kein Post → kein Flyer → korrekt
`not_found`/`unreachable`.

## Bewusst NICHT gemacht

- **Kein Plumbing der `image`-Spalte** in Work-Liste/Naht. Live-Flyer heißt: der
  Verifier ist ohnehin schon auf der Seite. Scheduler, Helper, Naht und Adapter B
  bleiben unberührt — es ist eine **reine Prompt-Änderung**.
- **Kein neues Verdikt-Wort** (kein `confirmed_via_flyer`) — der Flyer ist nur
  eine weitere Evidenz-Quelle für die vorhandenen Signale (a)/(b).
- **Kein Deckeln auf `confirmed_weak`** — der Live-Flyer ist ein echter
  Lebendigkeits-Check, also gleichwertig zum Text-Confirm: voll `confirmed` +
  Auto-Approve.
- **`unreachable` eskaliert nicht** — eine nicht-ladende Seite hat keinen
  lesbaren Flyer; ein Versuch würde nur Tokens kosten.
- **Flyer vorhanden, aber nicht lesbar** (Bild kaputt / OCR gescheitert) →
  `unreachable`, **nie** `not_found` (Keep-Bias bleibt).
- **Recurring-Verify bleibt unberührt** — der Geschwister-Workflow (ADR 0006,
  read-only) hat dieselbe Prompt-Struktur, aber eigenen Scope. Eine spätere
  Übernahme der Flyer-Regel ist denkbar, hier bewusst nicht mitgemacht.

## Consequences

- Der Flyer-Read (1 Screenshot + 1 Vision-`Read`, ein paar Tausend Tokens) feuert
  nur im schmalen Band „Seite geladen, Text reicht nicht" — nie bei `unreachable`,
  nie bei text-`confirmed` (der IG-Mehrheit). Die Mehrkosten bleiben auf die
  mehrdeutige Minderheit begrenzt.
- Der Verify-Prompt hat nur **eine** Quelle der Wahrheit: `verify_prompt` in
  `scraped_verify_workers/claude.py`. Der frühere JS-Zwilling
  (`scraped-verify.workflow.js`, `subAgentPrompt()`) wurde am 2026-07-13 entfernt
  — es gibt keinen Sync-Zwang mehr; die Änderung geschieht in dieser einen Datei.
