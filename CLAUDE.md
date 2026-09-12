# Tauchbuch — Projektkontext für Claude Code

Persönliches Tauchlogbuch als PWA von claudemn61. Analoger Aufbau zum
Schwester-Projekt `Flugbuch` (gleicher Autor, gleiches Architekturmuster).

## Sprache & Stil

- **Alle Code-Kommentare, Commit-Messages und Antworten an mich: Deutsch, Schweizer
  Rechtschreibung** (z.B. "ss" statt "ß").
- Kurze, direkte Antworten bevorzugt. Ich melde mich meist mit kurzen Korrekturen
  ("Missverständnis: ...") statt langen Erklärungen — dann bitte den vorherigen
  Schritt korrigieren, nicht neu diskutieren.
- Kürzel in meinen Nachrichten: **"V-"** heisst "Version so belassen, kein Bump
  nötig" (wie explizites "nichts"/"keine Version").

## Tech-Stack

- **Kein Build-Schritt**: React/JSX wird zur Laufzeit im Browser per Babel Standalone
  transformiert (siehe `<script type="text/babel">` in den `.html`-Dateien).
- Jede "Seite" ist ein eigenständiges HTML+JSX-Paar, kein Router, keine Bundler.
- Deployment: GitHub Pages direkt vom `main`-Branch (kein GitHub-Actions-Workflow
  im Repo — Push auf `main` deployt automatisch über die Pages-Einstellung).
- Persistenz: `window.storage` (IndexedDB mit localStorage-Fallback, Präfix
  `tauchbuch:`), async API (`get`/`set`/`delete`/`list`) — identisches Muster wie
  in Flugbuch, aber pro Seite als eigene IIFE im jeweiligen `.html` dupliziert.
- Backup-Export/-Import (`tauchbuch.jsx`, `exportBackup`/`importBackup`): erfasst
  `dives` plus alle `window.storage`-Keys mit einem der Präfixe `tauchreisen:`,
  `settings:`, `material:`, `brevet:`, `home:`. **Anders als Flugbuch gibt es
  hier kein einzelnes `service:`-Sammelpräfix** — ein neuer dauerhafter Key muss
  eines der bestehenden Präfixe verwenden (oder die Präfix-Liste in
  `exportBackup`/`importBackup` erweitert werden), sonst geht er bei einem Reset
  verloren.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` / `home.jsx` | Home-Seite, Kacheln zu den Unterseiten, Notizen, Changelog |
| `tauchbuch.jsx` / `tauchbuch.html` | Tauchliste, Tauchgang-Details, Import/Export, Suche |
| `statistik.jsx` / `statistik.html` | Statistik-Kacheln |
| `material.jsx` / `material.html` | Ausrüstung/Material |
| `reisen.jsx` / `reisen.html` | Reisen-Übersicht |
| `brevet.jsx` / `brevet.html` | Brevet-Erfassung (Ausweise mit Foto, Perspektiv-Korrektur) |
| `hilfe.jsx` / `hilfe.html` | Ausführliche In-App-Anleitung |
| `meintauchbuch - Kurzanleitung.pdf` | Separate Kurzanleitung als PDF (nicht in hilfe.jsx, eigene Pflege) |

**Achtung — toter Code:** `app.jsx` und `flugbuch.jsx` liegen im Repo, werden
aber von keiner `.html`-Datei geladen (Reste aus der Bootstrap-Phase, als
Tauchbuch von Flugbuch abgeleitet wurde — Kommentare darin sprechen noch von
"Flugbuch"/"flugbuch-db"). Nicht verwechseln mit den aktiven Dateien oben.

## Versionierung

- **Patch** = Bugfix, **Minor** = neues Feature, **Major** = Architekturänderung.
- **Vor jeder Code-Änderung fragen**, welche Stufe zutrifft (ausser ich sage explizit
  "nichts"/"keine Version"/"V-").
- **Jede Stufe (auch Patch)** erhöht `APP_VERSION` + eigenen Eintrag im
  `CHANGELOG`-Array (Form `{ version, changes: [...] }`) in `home.jsx`.
- Bei **Minor**: zusätzlich `hilfe.jsx` (ausführliche Anleitung) nachführen. Die
  PDF-Kurzanleitung wird separat gepflegt, nicht automatisch bei jeder Änderung.

## Git-Workflow

- Nach Abschluss einer Änderung **immer ungefragt**: committen, auf den
  Feature-Branch pushen, nach `main` mergen und pushen. Kein Nachfragen mehr,
  ob auf `main` gepusht werden soll.

## Vorgehen bei Änderungen

- Nach jeder Änderung: **Klammern/Syntax wirklich prüfen**, nicht nur vermuten —
  im Zweifel mit einem echten JSX-Transformer (z.B. `sucrase`) verifizieren,
  bevor etwas ausgeliefert wird.
- Bei Datenverarbeitung (Statistik, Aggregationen): wenn möglich mit echten
  Daten aus einem Backup-Export testen, nicht nur mit erfundenen Beispieldaten.
- **Konsistenz über Seiten hinweg** ist mir wichtig — wenn ich "identisch auch für
  die Varianten X/Y/Z" sage, meine ich das wörtlich: gleiche Struktur, gleiche
  Optik, nicht nur sinngemäss ähnlich.
- Bei mehrdeutigen Anfragen lieber kurz nachfragen (max. 1–2 gezielte Fragen) als
  eine aufwändige Änderung in die falsche Richtung zu bauen.

## Nicht tun

- Keine neuen Abhängigkeiten/Build-Tools einführen — bewusst kein Build-Schritt.
- Keine automatischen "smarten" Sortierungen einbauen, wenn nicht explizit
  gewünscht — lieber eine neutrale Standardeinstellung und die Wahl dem Nutzer
  überlassen.
