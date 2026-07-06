# Verify-Sweep bleibt sequenziell — jetzt zwingend wegen des geteilten 9222-Chrome

Der Scraped-One-Off-Verify-Sweep prüft seine Events **streng nacheinander**. Im
alten JS-Workflow (`scripts/scraped-verify.workflow.js`) war das *erzwungen*:
alle Sub-Agents liefen in **einer** Claude-Session mit **einem** geteilten
Playwright-Tab, und parallele Agents navigierten denselben Tab durcheinander —
Agent A las still die Seite von Agent B und fällte ein falsches Urteil (real
passiert, siehe `scripts/SCRAPED_VERIFY_KNOWN_BUGS.md` und die „Shared browser"-
Sektion im Runbook).

Beim Umbau auf `verify_scheduler.py` war der Zwang kurz **weg**: ein erster
Entwurf gab jedem Event einen eigenen `claude -p`-Subprozess mit **eigenem
Wegwerf-Browser** — technisch wäre Parallelität da sicher gewesen, sequenziell
nur eine Ressourcen-Wahl.

**Das gilt nicht mehr.** Der `claude`-Adapter (`verify_workers/claude.py`) dockt
inzwischen — genau wie der Instagram-Scraper — über
`scripts/playwright-verify.mcp.json` an **ein geteiltes, echtes Chrome auf CDP
Port 9222** an, statt einen Wegwerf-Browser zu starten. Gründe:

1. **Anti-Bot.** Viele Venue-Seiten sperren Headless-/Automations-Browser hart
   (403); das echte, gepinnte Chrome kommt durch.
2. **Desktop-Hygiene.** Jedes Event öffnet seinen Tab im **einen** gepinnten
   Fenster (Desktop 2), statt neue Browserfenster auf Desktop 1 aufpoppen zu
   lassen.

Damit ist der **Shared-Browser-Zwang zurück**: zwei Worker gleichzeitig würden
dasselbe Chrome fahren und sich die Tabs zerschießen — exakt der alte Bug.
**Sequenziell ist daher für den `claude`-Adapter wieder ZWINGEND**, nicht mehr
nur eine Wahl. (Nebenbei sprächen weiterhin Laptop-Ressourcen und Einfachheit
dafür — aber das ist jetzt zweitrangig; die Korrektheit erzwingt es ohnehin.)

Der Scheduler setzt das durch: **kein `--concurrency`-Flag**, immer ein Worker
nach dem anderen, plus ein einmaliger **9222-Erreichbarkeits-Check** vor dem
Sweep (fail-fast statt N `unreachable`). Der Check fragt nur, ob der Browser *da*
ist — **kein** Login-Preflight (Verify ist read-only, braucht keinen Login).

## Consequences

Wer künftig die sequenzielle Schleife sieht, soll sie **nicht** „reparieren",
indem er parallelisiert — der Shared-Browser-Bug ist beim `claude`-Adapter
**wieder aktiv**, nicht Geschichte. Parallelität würde erst wieder Sinn ergeben,
wenn ein Adapter jedem Worker einen **eigenen** Browser gibt (dann bräuchte es
zusätzlich einen Nebenläufigkeits-Deckel samt koordinierter Writes und geklärter
Ressourcenfrage). Solange der Default-Adapter das geteilte 9222-Chrome benutzt,
ist sequenziell die einzige korrekte Betriebsart.
