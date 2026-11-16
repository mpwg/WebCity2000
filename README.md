# WebCity2000

Lokales Städtebauspiel mit Three.js und einer Wirtschaftssimulation im Worker.
Integrierte Clean-Room-Pakete: Stadtbild `d0776b4`, Simulationsprüfung
`1117be7` (letzter geprüfter Paketcommit), Bedienprüfung `efa05d4`.

## Start und statischer Build

```sh
bun install --frozen-lockfile
bun run dev
```

Für die lokale Nutzung des statischen Builds:

```sh
bun run build
bunx --bun vite preview --host 127.0.0.1
```

`dist/` enthält die statischen Dateien; über HTTP auf localhost öffnen
(Worker und Module benötigen einen Server). Keine Veröffentlichung erfolgt.
Spielstände liegen lokal in IndexedDB; Export sichert eine JSON-Datei.

## Prüfungen

```sh
bun run typecheck
bun run test
bun run build
bun run benchmark
```

Browserprüfungen außerhalb der Sandbox ausführen:

```sh
bunx playwright install chromium firefox webkit
bun run test:browser
```

Playwright startet seinen Testserver selbst. Chromium nutzt das mitgelieferte
Chromium mit SwiftShader; Firefox und WebKit sind eigene Projekte. Vitest
sammelt ausschließlich `tests/*.test.ts`, Playwright ausschließlich
`tests/browser/*.spec.ts`. Der Recovery-Test prüft aktive Wassermangeldiagnose,
Wiederaufbau, I-Taste ohne versehentlichen Bau und Fortsetzen nach Speichern.

## Verifizierter Stand und offene Abnahme

Typecheck, 25 Headless-Tests und statischer Build erfolgreich. Vite meldet
einen Hauptchunk von rund 521 kB (138 kB gzip); dies ist ein Größenhinweis.
Formatierungsdiff geprüft. Keine Browser oder Webserver in der Sandbox gestartet.

Headless-Benchmark auf macOS arm64 mit Bun 1.4.4, je 20 Wirtschaftsrunden:

| Szenario | Gebäude | Einwohner | Versorgung | Runde p95 / Maximum |
| --- | ---: | ---: | ---: | ---: |
| 50 getrennte Korridore | 100.000 | 56.300 | 100 % | 691 / 979 ms |
| Verbunden, Wasserimport | 100.197 | 28.425 | 100 % | 565 / 578 ms |

275 Einwohner in Vierteln ohne lokalen Brunnen belegen den Wasserimport.
Laden: 169 ms; am Messende Heap 355 MiB, RSS 411 MiB.
Diese Einzelmessung belegt keine Browserleistung auf M1 mit 8 GB.

Lange Runden überschreiten das 100-ms-Tickintervall. Der Worker holt daher
maximal eine Sekunde geplanter Pulse nach, einen Puls pro Ereignisschleifenlauf.
Bei Überlast bleibt das Spiel langsamer als Echtzeit. Pause, Menü,
Geschwindigkeitswechsel und Hintergrundwechsel verwerfen den Rückstand;
Hintergrundzeit wird nicht nachsimuliert. Rendering und Eingaben bleiben im
Hauptthread; Antworten des Workers können während einer Wirtschaftsrunde warten.

Offene Abnahmepunkte:

- Alle sechs Playwright-Fälle in Chromium, Firefox und WebKit außerhalb der
  Sandbox ausführen; Wasser fehlt und automatische Erholung visuell bestätigen.
- Vollständige Browser-Leistungsprüfung auf M1 mit 8 GB: beide Lastszenarien,
  1×/2×/4×, FPS und Eingabelatenz während Wirtschaftsrunden, Bau-/Inspektions-
  Antwortzeit, Zoom/Schwenken, Speicherverbrauch und längerer Betrieb.
- Unter Last Tab und Menü länger ausblenden, wieder öffnen und bestätigen,
  dass keine Hintergrundzeit nachsimuliert wird; Autospeichern und Laden prüfen.
- Integrierte Modelllandschaft bei Nahsicht und Übersicht einschließlich
  Diagnoseschichten in allen drei Browsern visuell abnehmen.
