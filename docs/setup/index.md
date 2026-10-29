# Setup

Kurzer Überblick über das bisherige Setup des Bots. Wird nach und nach um Details ergänzt.

## Projektstruktur

- Der Bot basiert auf dem [Deno Slack SDK](https://docs.slack.dev/tools/deno-slack-sdk/) und wird über die Slack CLI deployed.
- `manifest.ts` ist die zentrale Definition der App: registrierte Functions, Datastores, `outgoingDomains` und `botScopes`.
- Jede fachliche Domäne hat einen eigenen Ordner unter `src/` (z. B. `gym`, `google_drive`, `masterdata`, `utility`) mit einem `functions/`-Unterordner. Jede Function besteht aus `definition.ts` (Input/Output-Schema) und `mod.ts` (Implementierung).
- Domänenübergreifender Code (z. B. der Masterdata-Service, Google-Auth) liegt in `src/shared/`.

## Umgebungsvariablen

- Test- und Prod-Werte liegen getrennt: `.env` (Test/Sandbox, gelesen von `slack run`) und `.env.production` (Prod, per `npm run env:sync` in die deployte App übertragen). `.env.example` ist die gemeinsame Liste der benötigten Keys.
- In GitHub Codespaces erzeugt `.devcontainer/generate-env.sh` beide Dateien bei jedem Container-Build aus den Codespaces-Secrets (`DEV_…` / `PROD_…` / ohne Präfix).
- Details, Namensschema der Secrets und die Abläufe für Entwicklung und Produktion: [Umgebungen & Secrets](./environments).

## Google Integration

- Zugriff auf Google APIs (Drive, Sheets) läuft über einen Service Account, JWT-Auth in `src/shared/google_service_account.ts` (scope-parametrisiert, kein externes Paket nötig).
- Jede genutzte Google-API-Domain (z. B. `oauth2.googleapis.com`, `www.googleapis.com`, `sheets.googleapis.com`) muss im Manifest unter `outgoingDomains` freigegeben sein, sonst blockt die Slack-Laufzeitumgebung den Request.

## Nächste Schritte

Weitere Setup-Kapitel (Slack App Konfiguration, lokale Entwicklungsumgebung, Deployment) folgen hier.
