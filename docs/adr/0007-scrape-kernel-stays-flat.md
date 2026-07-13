# Der geteilte Scrape-Kern bleibt flach im `scripts/`-Root

Beim Aufräumen des `scripts/`-Ordners (2026-07) sind die handbetriebenen Tools in
Unterordner gewandert — `tools/` (Venue-/Recurring-Utilities) und `icons/`
(PWA-Asset-Generatoren). Der **geteilte Kern** ist bewusst **nicht**
mitgewandert und liegt weiter flach im Root: `import_visual_events.py`,
`scrape_helpers.py`, `event_image.py`, `image_utils.py`,
`stage_visual_placeholder.py` und `verify_recurring_helper.py`.

Grund ist die Art der Kopplung. Fast jeder Sweep-Ordner zieht ein Kern-Modul als
**nacktes** `import scrape_helpers` bzw. `from image_utils import …` — und das
löst nur auf, solange das Kern-Modul im selben Ordner wie der Importeur liegt
**oder** dessen Ordner auf `sys.path` steht. Die Sweep-Ordner erreichen den Kern
zusätzlich über berechnete Pfade wie `os.path.join(SCRIPTS_DIR,
"import_visual_events.py")`. Den Kern in ein `lib/` zu heben würde also **jeden**
dieser `SCRIPTS_DIR`-Joins **und** jeden nackten Import in allen fünf
Workflow-Ordnern anfassen — viel Churn bei echtem Regressionsrisiko für Dateien,
die still brechen (ein Scraper importiert erst zur Laufzeit).

Flach zu bleiben kostet dagegen nichts: Der Kern ist das gemeinsame Fundament,
und flach am Root ist dafür die konventionelle, bruchfreie Stelle. Nur die
**wenigen verschobenen Tools**, die selbst ein Kern-Modul importieren
(`tools/scrape_venue_og_images.py` → `image_utils`,
`tools/apply_recurring_images.py` → `event_image`), tragen dafür oben eine
kleine, in sich geschlossene Zeile, die den `scripts/`-Root auf `sys.path` legt:

```python
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
```

## Consequences

Wer künftig den „inkonsistenten" flachen Kern sieht, soll ihn **nicht**
„aufräumen", indem er ihn nach `lib/` zieht — und die `sys.path`-Zeilen in den
Tools **nicht** als überflüssig löschen. Genau diese Zeilen sind es, die den
`tools/`-Ordner den flachen Kern finden lassen. Ein Verschieben des Kerns
wäre kein lokaler Edit, sondern ein Alles-oder-nichts-Sweep über jeden nackten
Import und jeden `SCRIPTS_DIR`-Join in allen Workflow-Ordnern.
