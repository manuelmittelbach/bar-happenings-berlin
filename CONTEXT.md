# Inside-Bars — Scrape-Pipeline

Die gemeinsame Sprache der Scrape-/Verify-Pipeline: die Begriffe, mit denen wir
über das Einsammeln von Venue-Events reden. Nur Domänen-Vokabular, keine
Implementierungsdetails (die stehen in den ADRs unter `docs/adr/`).

## Scrape-Pipeline

**Sweep**:
Ein Lauf, der die komplette Work-Liste einer Quelle von vorn bis hinten
abarbeitet.
_Avoid_: Durchlauf, Batch-Run.

**Scheduler**:
Der modell-freie Python-Orchestrator eines Sweeps — baut die Work-Liste, taktet,
ruft pro Venue (bzw. Event) einen Worker, hält bei Infra-Ausfall an und zählt am
Ende zusammen. Kennt das „Modell" bewusst nicht.
_Avoid_: Orchestrator, Runner.

**Worker Adapter** (kurz: Worker):
Das austauschbare, modell-spezifische Mittelstück, das GENAU EINE Venue/ein Event
bearbeitet. Solange er die Naht spricht, „klickt" er in die Pipeline. Der
`claude`-Adapter ist Adapter A (heutiger Pfad); ein Nicht-Claude-Modell wäre
Adapter B.
_Avoid_: Agent, Sub-Agent, Backend.

**Naht** (engl. Seam):
Der schmale Input/Output-Contract zwischen Scheduler und Worker. Der einzige
Berührungspunkt — daran hängt die Modell-Austauschbarkeit.
_Avoid_: Interface, Schnittstelle, API.

**Work-Liste**:
Die vom Helper gebaute Liste der zu bearbeitenden Venues (bzw. Events) einer
Quelle. Die portablen, modell-freien Enden der Pipeline.
_Avoid_: Queue, Job-Liste.

**Quelle** (engl. Source):
Woher Events stammen — `website`, `instagram`, `telegram`. Jede Quelle hat ihren
EIGENEN Scheduler, teilt sich aber Importer und Placeholder.
_Avoid_: Kanal, Provider.

**Fenster** (engl. Window):
Der Event-Zeitraum `[today, windowEnd]`, den ein Scrape behält (Standard: today
bis today + 14 Tage).
_Avoid_: Zeitraum, Range.

**Lookback**:
NUR bei Feed-Quellen (Instagram): wie viele Tage rückwärts im
reverse-chronologischen Feed gelesen werden, bevor abgebrochen wird. Beim
Website-Scrape bedeutungslos — eine Event-Seite hat keinen Feed.

**Placeholder**:
Eine leere Staging-Zeile für eine Venue, bei der nichts extrahiert wurde — als
weiche Admin-Erinnerung, mit einem Grund-Code (`no_events` / `unreachable` /
`blocked` / `unparseable`).
_Avoid_: Dummy, Leerzeile, Stub.

**Preflight** vs **Reachability-Check**:
Zwei verschiedene Vor-dem-Sweep-Prüfungen — nicht verwechseln. **Preflight** =
Login-Prüfung (nur Instagram; ohne Login bricht der Sweep ab).
**Reachability-Check** = fragt nur, ob das geteilte 9222-Chrome DA ist
(Website + Verify, read-only, kein Login) und failt früh mit „starte den
Browser" statt N `unreachable`.

**Scraped-Verify**:
Der Verify-Sweep über **einmalige (one-off), noch nicht freigegebene** Events im
Staging: prüft vor der Freigabe read-only, ob jedes Event an seinem
gespeicherten Datum wirklich noch auf der Quell-Seite steht. Ergebnis ist ein
Report für den Admin, keine DB-Änderung. Nicht verwechseln mit
Recurring-Verify.
_Avoid_: Verify (unqualifiziert), Event-Check.

**Recurring-Verify**:
Der Verify-Sweep über **wiederkehrende Serien** (deren Wurzel-Events, bereits
freigegeben): prüft read-only, ob die Serie noch regelmäßig stattfindet.
Eigenständiger Geschwister-Workflow von Scraped-Verify mit eigenen Dateien.
_Avoid_: Serien-Check.

**Serien-Root** (engl. root):
Das freigegebene Wurzel-Event einer wiederkehrenden Serie, aus dem die
Kind-Termine abgeleitet werden. Recurring-Verify prüft NUR Roots — steht die
Serie nicht mehr auf der Seite, sind alle Kinder mit-veraltet.
_Avoid_: Serie (unqualifiziert), Parent-Event, Mutter-Event.

**Kadenz** (engl. cadence):
Die menschenlesbare Wiederholungsregel einer Serie („2. Samstag im Monat"),
gegen die Recurring-Verify die Quell-Seite prüft.
_Avoid_: Rhythmus, Frequenz, Turnus.

**Infra-Halt** (Exit 75):
Ein Worker meldet einen SWEEP-WEITEN Infrastruktur-Ausfall (Token-/Usage-Limit,
Netz weg, CLI fehlt) über Exit-Code 75 und schreibt KEIN Ergebnis. Der Scheduler
hält daraufhin an, behält den Fortschritt und nennt den `--offset` zum
Weitermachen. Ausdrücklich KEIN Urteil über die Seite — „gar nicht erst
versucht". Siehe `docs/adr/0002-…` und `docs/adr/0003-…`.
_Avoid_: Crash, Absturz, Fehler.
