# Fehleranalyse – Leitfaden

Damit eine Fehleranalyse reproduzierbar bleibt, führen wir bei jedem Durchgang die folgenden Checks aus. Die Befehle sind so gewählt, dass sie in wenigen Minuten laufen und sowohl Build‑ als auch Test‑Pfad abdecken.

## Automatisierte Checks

1. **TypeScript / Builds**  
   ```bash
   pnpm run check:type
   ```
   Führt `pnpm -F web typecheck`, `pnpm -F server build` und `pnpm -F @shared/lib build` aus.

2. **Test-Suites**  
   ```bash
   pnpm run check:test
   ```
   Startet Vitest für Web, Server und Shared-Package.

3. **Linting**  
   ```bash
   pnpm run check:lint
   ```
   Aktuell konzentriert auf das Web-Frontend (`pnpm -F web lint`).

4. **Smoke-Tests (Optional, aber empfohlen)**  
   ```bash
   pnpm run check:smoke
   ```
   Ruft die vorhandenen Smoke-Skripte (`scripts/smoke-web.mjs`, `scripts/smoke-server.mjs`) hintereinander auf.

5. **Alles in einem Rutsch**  
   ```bash
   pnpm run check:done
   ```
   Führt die vier vorangegangenen Schritte sequenziell aus und eignet sich als „Finale Ampel“ vor der Analyse oder einem Release.

## Danach: Manuelle Analyse

Sind alle Checks grün, lohnt sich trotzdem ein manueller Blick:

- Logs/Warnings aus den Skripten lesen (besonders Build- und Test-Ausgaben).  
- Offene TODO/FIXME in den betroffenen Bereichen prüfen (`rg "TODO|FIXME" ...`).  
- Bei Bedarf gezielt Einzelfälle nachstellen (z. B. per Playwright, Postman, lokaler UI).  
- Neue Fehlerbilder dokumentieren (Issue/TODO) und bei Bedarf Tests ergänzen.

Mit dieser Reihenfolge haben wir eine reproduzierbare Basis und stoßen systematisch weitere Untersuchungen an, falls einer der Schritte rot oder auffällig wird.
