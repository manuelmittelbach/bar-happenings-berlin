# Inside-Bars

Die gemeinsame Sprache des Projekts: die Begriffe, mit denen wir über das
Einsammeln und Anzeigen von Venue-Events reden. Nur Domänen-Vokabular, keine
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
Staging: prüft vor der Freigabe, ob jedes Event an seinem gespeicherten Datum
wirklich noch auf der Quell-Seite steht. Ergebnis ist ein Report für den Admin
plus ein Flag an jeder geprüften Staging-Zeile; Event-Daten ändert der Sweep
nie. Bereits geflaggte Events überspringt der nächste Sweep — außer
`unreachable` (ergebnislos, wird erneut versucht). Nicht verwechseln mit
Recurring-Verify.
_Avoid_: Verify (unqualifiziert), Event-Check.

**Verdikt** (engl. verdict):
Das Urteil des Verify-Workers über GENAU EIN Event, aus einem festen Vokabular:
`confirmed` (Titel UND Datum auf der Quell-Seite bestätigt), `confirmed_weak`
(Titel gefunden, Datum nicht explizit), `not_found` (Seite geladen, Event fehlt),
`unreachable` (Prüfung ergebnislos — Seite kaputt/blockiert). Ein Verdikt gehört
zum Event, nie zur Venue. Keep-Bias: alles außerhalb des Vokabulars wird zu
`unreachable`, nie zu `not_found`.
_Avoid_: Status, Ergebnis, Confirmation.

**Flag** (Verb: flaggen):
Das an der Staging-Zeile persistierte Verify-Ergebnis: Verdikt + Begründung
(Evidence) + Prüfzeitpunkt. Flaggen markiert nur — es ändert nie Event-Daten und
gibt nie frei; die Freigabe-Entscheidung bleibt beim Admin bzw. Auto-Approve.
Ändert der Scraper eine geflaggte Zeile, erlischt ihr Flag (wieder ungeprüft).
Auto-Approve gibt AUSSCHLIESSLICH `confirmed` geflaggte Zeilen frei — auch
Update-Zeilen.
_Avoid_: Markierung, Verify-Status.

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

## Event-Anzeige

**Tages-Leiste** (engl. day strip):
Die Reihe aus 7 gleichrangigen, einzeln wählbaren Tages-Chips (Tonight,
Tomorrow, dann 5 Wochentage) über der Events-Liste und der Map — beide Seiten
teilen sich dieselbe Leiste und dieselbe Auswahl. Jeder Chip meint GENAU EINEN
Tag; einen Sammel-Bucket über mehrere Tage gibt es nicht mehr. Leere Tage
bleiben wählbar und zeigen einen Empty-State.
_Avoid_: Upcoming, Kalender, Datums-Tabs.

**Sichtfenster** (engl. visible horizon):
Die 7 Tage, die die Tages-Leiste anzeigt — bewusst kürzer als das
Scrape-**Fenster** (14 Tage). Events dazwischen existieren in der DB, sind aber
unsichtbar, bis sie ins Sichtfenster hineinrollen (Best-Effort, akzeptiert).
_Avoid_: Horizont, Upcoming-Window.

**Tonight** / **Tomorrow**:
Die ersten beiden Chips der Tages-Leiste — benannt statt datiert, weil sie
RELATIV gemeint sind: Bleibt die Seite über Mitternacht offen, meint „Tonight"
weiterhin den (neuen) heutigen Abend. Konkrete Tage dahinter sind absolut
datiert; ein abgelaufener oder unbekannter Wert fällt stillschweigend auf
Tonight zurück. Noch laufende Events von gestern erscheinen in der
Events-Liste als eigener „Still running"-Streifen über Tonight.
_Avoid_: Heute/Morgen (gemischt mit den englischen Labels).

## Freigabe (Approval)

**Auto-Approve**:
Die Stapel-Freigabe der gescrapten Staging-Zeilen ohne Einzel-Prüfung — gibt aber
NUR eindeutige Zeilen frei: Verdikt `confirmed`, Pflichtfelder da, Venue
verknüpft, kein Clash (außer Mehr-Event-Bar). Alles andere bleibt mit Grund
liegen. Neue Zeilen werden als neues Event eingefügt, Update-Zeilen patchen ein
bestehendes.
_Avoid_: Bulk-Approve, Massen-Freigabe, Auto-Publish.

**Clash** (dt. Konflikt):
Gleiche Bar + gleicher Tag — der (Bar, Tag)-Slot ist schon belegt (durch ein
Live-Event oder eine früher im selben Lauf freigegebene Zeile). Ein Clash
blockiert beim Auto-Approve das Einfügen einer NEUEN Zeile (sie bleibt liegen,
nichts wird je überschrieben). Ausgenommen: Update-Zeilen (zeigen auf genau das
belegte Event) und Mehr-Event-Bars.
_Avoid_: Kollision, Duplikat, Overlap.

**Mehr-Event-Bar** (die Whitelist):
Eine Venue, die legitim mehrere Events am selben Tag hat (Club, große Location,
Programm mit mehreren Acts) und deshalb von der Clash-Regel ausgenommen ist. Als
`MULTI_EVENT_PER_DAY_VENUE_IDS` per Venue-UUID gepflegt.
_Avoid_: Ausnahme-Bar, VIP-Bar, Multi-Venue.

**Freigabe-Entscheidung** (engl. approval decision):
Das reine Urteil, was mit einer Staging-Zeile beim Auto-Approve geschehen soll —
`insert` (neues Event), `update` (bestehendes patchen) oder `skip` (+Grund). Ein
Wert, kein Seiteneffekt; Vorschau und echter Write teilen sich dasselbe Urteil,
damit die Vorschau dem Effekt IMMER entspricht.
_Avoid_: Freigabe-Regel, Approval-Check, Validierung.
