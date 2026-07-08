# Infra-Fehler halten den Verify-Sweep an (Exit 75), statt Events als `unreachable` zu verbrennen

**Datum:** 2026-07-06 · **Status:** angenommen · nach Grill-Session, alle Fragen
entschieden.

## Kontext

Der Scraped-One-Off-Verify-Sweep (`scripts/scraped_verify/scraped_verify_scheduler.py` + der
`claude`-Adapter) prüft bis zu ~346 Events **streng nacheinander** (ADR 0001).
Bei einem vollen Lauf wird irgendwann das Claude-**Token-/Session-Limit**
erreicht — oder das **WLAN** fällt aus. Vorher passierte dann dreierlei, alles
unerwünscht:

1. Der Worker machte aus dem Infra-Fehler ein normales `unreachable`-**Urteil**
   und trug es in die JSONL ein — obwohl die Seite **nie beurteilt** wurde.
2. Der Scheduler lief **stur weiter** und verbrannte *jedes* restliche Event
   genauso (im Juli-3-Lauf: 48 Events als „session limit"-`unreachable`).
3. Lief der Sweep so bis zum Ende durch, galt er als „vollständig erfolgreich" →
   `cleanup()` **löschte die JSONL** → nichts mehr zum Resumen, einzige Option:
   alle Events komplett neu prüfen.

**Kern-Denkfehler:** `unreachable` vermischte zwei Dinge — ein **Urteil über die
Seite** (403 / 404 / Login-Wall) und einen **Abbruch meines Laufs** (Token-Limit,
WLAN weg, CLI fehlt). Letzteres ist „gar nicht erst versucht" und darf **nie** als
Urteil gespeichert werden — sonst blockiert es den Resume.

## Entscheidung

Ein Worker meldet einen **Sweep-weiten Infra-Fehler** durch **Exit-Code 75**
(`EX_TEMPFAIL`) — und schreibt dabei **kein** Verdict. Auf diesen Code hin:

1. schreibt der Scheduler **kein** Urteil für das aktuelle Event (bleibt un-erledigt),
2. **hält** er den Sweep an,
3. macht er **kein** `cleanup` (die partielle JSONL bleibt liegen),
4. rendert er trotzdem den **Teil-Report** + druckt einen Resume-Hinweis.

Ein normaler Neustart (`python3 scripts/scraped_verify/scraped_verify_scheduler.py`) macht dann an der
Abbruchstelle weiter — kein `--fresh`, kein Sonderflag nötig.

**Der Scheduler bleibt modell-agnostisch:** er prüft nur den Exit-Code, nie das
*Warum*. Jeder Adapter B kann denselben Halt auslösen, indem er 75 zurückgibt.
Die **Klassifikation** liegt allein im Worker. Der `claude`-Adapter erkennt zwei
Wege getrennt:

- **Eager** (1. Versuch, Retry sinnlos): `127` = `claude` CLI nicht auf PATH; oder
  exit≠0 **und** eine Limit-Signatur (`session limit` / `usage limit` / `hit
  your` / `rate limit`) = Token-/Usage-Limit. Signatur nur bei exit≠0 geprüft,
  damit ein Venue-Text, der zufällig „rate limit" enthält, keinen Fehlalarm
  auslöst (echtes Urteil = exit 0).
- **Vorsichtig** (erst nach **beiden** Versuchen, signatur-frei): der
  „kein-API-Kontakt"-Fingerabdruck `exit≠0 UND exit≠124 UND usage is None UND
  parsed is None`. `usage is None` (kein Token-/Kosten-Envelope) ist das
  Kern-Signal, dass die API nie erreicht wurde = WLAN/Netz weg. `124` ist unser
  eigener 900-s-Timeout = **eine** lahme Venue, **kein** Infra-Ausfall → bleibt
  `unreachable` + weiter.

## Bewusst NICHT gemacht

- **Kein Archiv.** Kurz erwogen: `cleanup` archiviert die JSONL statt sie zu
  löschen. Verworfen — sobald ein Infra-Fehler den Sweep **anhält**, läuft
  `cleanup` ohnehin nicht, die Live-JSONL bleibt, Resume reicht. `cleanup()`
  bleibt unverändert (löscht weiter = Reset nach vollem, sauberem Lauf).
- **Kein CLI-/Netz-Preflight im Scheduler** — das hielte ihn nicht
  modell-agnostisch; die Erkennung bleibt im Worker.
- **Kein neuer 5. Verdict**, keine Änderung am Verdict-Shape → der Consumer
  `scraped_verify_helper.py report` bleibt unangetastet.
- **`124`** (Einzel-Timeout einer lahmen Venue) und **`126`** (exec-format
  während CLI-Auto-Update, transient) → bleiben `unreachable` + weiter. Kein Halt.
- **`VERIFY_CLAUDE_TIMEOUT`** bleibt 900 s (bewusst großzügig; Keep-Bias > schnelles
  Aufgeben), nur per Env-Variable justierbar — separate Tuning-Sache.

## Consequences

Wer künftig einen `unreachable`-Massentreffer am Sweep-Ende sieht, soll das
**nicht** durch Weiterlaufen-lassen „glätten" — der richtige Reflex ist Exit 75:
anhalten, JSONL behalten, nach Reset weitermachen. Zwei Halt-Wege bleiben bewusst
getrennt (eager für sofort-erkennbare Limits, vorsichtig für Netzverlust erst nach
beiden Versuchen), damit weder ein Venue-Text noch eine einzelne lahme Seite einen
Fehl-Halt auslöst. Baustein 1 (crash-sicherer Resume: Urteile werden sofort
angehängt, `cleanup` nur bei vollem Lauf) trägt den gekillten Prozess (Strg-C,
Laptop zu); Baustein 2 (dieser Halt) trägt den Infra-Ausfall. Beide enden gleich:
partielle JSONL bleibt → normaler Neustart macht weiter.
