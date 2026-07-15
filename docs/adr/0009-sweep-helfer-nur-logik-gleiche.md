# Geteilte Sweep-Helfer — nur logik-gleiche Kopien kollabieren

Die fünf Scheduler-Geschwister (`instagram_scrape`, `website_scrape`,
`telegram_scrape`, `scraped_verify`, `recurring_verify`) trugen denselben
Plumbing-Kleinkram als **Copy-paste** in jeder Datei: Token-/Kosten-Formatierung
(`usage_billable`, `fmt_usage`, `_kfmt`, `fmt_tokens`), Datums-Utilities
(`is_iso_date`, `add_days_iso`), JSON(L)-I/O (`read_jsonl`, `read_json_file`,
`append_jsonl`, `count_events_file`), der Resume-Hinweis (`_write_resume_hint`)
und `dedup_by_id_keep_last`. Diese wandern in **ein** flaches Modul
`scripts/sweep_helpers.py` (flach am Root nach ADR 0007, erreicht über dieselbe
`sys.path.insert`-Zeile, die die Scheduler schon für `sweep_stray_shots` tragen).

Die Regel für den Schnitt lautet: **nur kollabieren, wenn der Funktions-Rumpf
identisch ist** — ein reiner Docstring-Unterschied (`_kfmt`, `fmt_tokens`,
`dedup_by_id_keep_last` sagten „event" vs. „series") zählt als identisch und
wird mit einem neutralen Docstring vereinheitlicht. Look-alikes, deren **Rumpf**
sich unterscheidet, bleiben **bewusst dupliziert pro Familie**, weil die
Differenz eine echte Domänen-Grenze trägt, kein Schlendrian ist:

- **`parse_last_json`** — die Scrape-Variante akzeptiert Objekt `{` *oder* Array
  `[`; die Verify-Variante akzeptiert nur ein Objekt und verlangt `isinstance(obj,
  dict)`, weil ein Verdikt immer *ein* Objekt ist, nie eine Liste.
- **`normalize_verdict`** — Scraped-Verify kopiert die **sechs** Identitätsfelder
  eines one-off Events (inkl. `date` + `start_time`); Recurring-Verify kopiert
  **fünf** einer Serie (inkl. `cadence`). Verschiedene Formen, weil ein Event ein
  Datum hat und eine Serie eine Kadenz.
- **`cleanup`** — familien-spezifische Datei-Muster und Report-Pfade
  (`scraped_verify_*` vs. `recurring_verify_*`).

Eine „vollständige" Vereinheitlichung dieser drei wäre kein Deepening, sondern
eine flache DRY-Übung: Sie würde entweder den Verify-Contract aufweichen (Arrays
schlucken) oder einen `dict_only=`-Flag brauchen, der Komplexität bloß in einen
Parameter *verschiebt* statt sie zu *konzentrieren*.

## Consequences

Wer künftig `parse_last_json`, `normalize_verdict` oder `cleanup` als
„vergessene Duplikate" sieht, soll sie **nicht** nach `sweep_helpers.py` ziehen —
ihre Abweichung ist tragend. Der Test ist mechanisch: **Ist der Rumpf Byte für
Byte gleich (Docstring egal)? → teilen. Unterscheidet sich der Rumpf? → die
Differenz ist Absicht, Kopie bleibt.** Dieselbe Regel gilt für jede spätere
Erweiterung der Schnittmenge (etwa falls der divergente Sweep-Kern —
`run_worker`, die `main`-Loop, `parse_args`, `_print_summary` — je hinter eine
gemeinsame Naht gezogen wird; heute ist er distinct pro Familie und bleibt es).
`sweep_helpers.py` (Scheduler-Plumbing) und `scrape_helpers.py`
(Importer-/DB-Domäne mit `client`-Argument) sind **zwei getrennte Module mit
zwei Zielgruppen** — nicht zu einem verschmelzen.
