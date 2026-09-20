# Setup

Kurzer Überblick über das bisherige Setup des Bots. Wird nach und nach um Details ergänzt.

## Projektstruktur

- Der Bot basiert auf dem [Deno Slack SDK](https://docs.slack.dev/tools/deno-slack-sdk/) und wird über die Slack CLI deployed.
- `manifest.ts` ist die zentrale Definition der App: registrierte Functions, Datastores, `outgoingDomains` und `botScopes`.
- Jede fachliche Domäne hat einen eigenen Ordner unter `src/` (z. B. `gym`, `google_drive`, `masterdata`, `utility`) mit einem `functions/`-Unterordner. Jede Function besteht aus `definition.ts` (Input/Output-Schema) und `mod.ts` (Implementierung).
- Domänenübergreifender Code (z. B. der Masterdata-Service, Google-Auth) liegt in `src/shared/`.

## Umgebungsvariablen

- Lokal in `.env` gepflegt, für den produktiven Bot per `npm run env:sync` (bzw. `env:dry-run` / `env:sync-prune`) über `scripts/sync-env-to-slack.js` in die Slack App übertragen.
- Das Skript zielt bewusst nur auf die deployte App: die lokale/dev App nutzt `.env` selbst als Speicher, ein Sync dorthin würde die Werte kaputt schreiben.
- Wichtige Variablen bisher: `GOOGLE_SERVICE_ACC_EMAIL` / `GOOGLE_SERVICE_ACC_PRIVATE_KEY` (Google Service Account), `SPREADSHEET_ID_MASTERDATA` (Stammdaten-Sheet) sowie `SLACK_BOT_TOKEN` (Google-Drive-Upload).
- Für GitHub Codespaces werden die Werte als Repository-Secrets unter *Settings → Secrets and variables → Codespaces* hinterlegt; die Secret-Namen müssen exakt den Variablennamen in `.env.example` entsprechen, sonst findet `.devcontainer/generate-env.sh` sie nicht.
- Beim Erstellen eines Codespace erzeugt genau dieses Skript (per `postCreateCommand`) automatisch die `.env` aus den Codespaces-Secrets. Sie wird dabei komplett überschrieben; fehlt ein Secret, gibt es nur eine Warnung, keinen Abbruch.
- `slack run` liest lokal weiterhin direkt aus `.env` (egal ob manuell gepflegt oder von `generate-env.sh` erzeugt); für `slack deploy` müssen die Werte weiterhin separat auf die deployte App übertragen werden — dafür `npm run env:sync` verwenden (s. o.), nicht `slack env add` von Hand.

## Google Integration

- Zugriff auf Google APIs (Drive, Sheets) läuft über einen Service Account, JWT-Auth in `src/shared/google_service_account.ts` (scope-parametrisiert, kein externes Paket nötig).
- Jede genutzte Google-API-Domain (z. B. `oauth2.googleapis.com`, `www.googleapis.com`, `sheets.googleapis.com`) muss im Manifest unter `outgoingDomains` freigegeben sein, sonst blockt die Slack-Laufzeitumgebung den Request.

## Nächste Schritte

Weitere Setup-Kapitel (Slack App Konfiguration, lokale Entwicklungsumgebung, Deployment) folgen hier.
