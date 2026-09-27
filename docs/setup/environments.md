# Umgebungen & Secrets

Der Bot läuft in zwei Umgebungen: als lokale Dev-App (`slack run`) mit Test-/Sandbox-Keys und als deployte App (`slack deploy`) mit Prod-Keys. Die Werte liegen deshalb in zwei getrennten Env-Dateien.

## Env-Dateien

| Datei             | Inhalt                                               | Wer liest sie                                                                                                                                                |
| ----------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.env.example`    | Liste aller benötigten Keys (ohne Werte), eingecheckt | `.devcontainer/generate-env.sh` als Vorlage für beide Dateien                                                                                                |
| `.env`            | Test-/Sandbox-Keys, gitignored                        | `slack run` (lokale Dev-App) liest sie direkt; `slack env set` für die lokale App schreibt ebenfalls dorthin                                                 |
| `.env.production` | Prod-Keys, gitignored                                 | `scripts/sync-env-to-slack.js` (`npm run env:sync`, `env:dry-run`, `env:sync-prune`) pusht sie per `slack env add` in die deployte App                       |

- `.env.example` ist die einzige Stelle, an der die benötigten Keys gepflegt werden. Kommt eine neue Variable dazu, wird sie dort eingetragen und gilt dann für beide Dateien.
- Wichtige Variablen bisher: `GOOGLE_SERVICE_ACC_EMAIL` / `GOOGLE_SERVICE_ACC_PRIVATE_KEY` (Google Service Account), `SPREADSHEET_ID_MASTERDATA` (Stammdaten-Sheet) sowie `SLACK_BOT_TOKEN` (Google-Drive-Upload).

```mermaid
flowchart LR
  S["Codespaces-Secrets<br/>DEV_* / PROD_* / ohne Präfix"] --> G[".devcontainer/generate-env.sh"]
  G --> E[".env<br/>(Test)"]
  G --> P[".env.production<br/>(Prod)"]
  E --> R["slack run<br/>lokale Dev-App"]
  P --> Y["npm run env:sync<br/>deployte App"]
```

## Codespaces-Secrets

Die Werte werden als Repository-Secrets unter *Settings → Secrets and variables → Codespaces* hinterlegt. `.devcontainer/generate-env.sh` läuft als `postCreateCommand` bei jedem Container-Build und löst jeden Key aus `.env.example` so auf:

| Zieldatei         | 1. Wahl        | 2. Wahl (Fallback) | sonst                 |
| ----------------- | -------------- | ------------------ | --------------------- |
| `.env`            | `DEV_<KEY>`    | `<KEY>`            | leerer Wert + Warnung |
| `.env.production` | `PROD_<KEY>`   | `<KEY>`            | leerer Wert + Warnung |

- Keys, die sich zwischen Test und Prod unterscheiden, bekommen zwei Secrets mit Präfix, z. B. `DEV_DOCUSEAL_API_KEY` und `PROD_DOCUSEAL_API_KEY`.
- Keys, die in beiden Umgebungen gleich sind, werden einmal **ohne** Präfix angelegt, z. B. `GOOGLE_SERVICE_ACC_EMAIL`. Dieser Wert landet dann in `.env` und in `.env.production`.
- Es gibt bewusst **keinen** Fallback zwischen `DEV_` und `PROD_`: fehlt `PROD_DOCUSEAL_API_KEY` (und es gibt kein `DOCUSEAL_API_KEY`), bleibt der Wert in `.env.production` leer, statt still den Test-Key zu übernehmen.
- Ein fehlendes Secret führt nur zu einer Warnung, nicht zum Abbruch.
- Jeder Wert wird in doppelte Anführungszeichen geschrieben (`KEY="value"`), damit Sonderzeichen wie die `\n` im Google Private Key erhalten bleiben. Doppelte Anführungszeichen *im* Wert werden nicht escaped, ein Secret darf also selbst kein `"` enthalten.

::: warning Secrets sind die Quelle der Wahrheit
`generate-env.sh` überschreibt `.env` **und** `.env.production` bei jedem Container-Build komplett. Änderungen, die im Codespace von Hand an den Dateien gemacht werden, gehen beim nächsten Rebuild verloren. Dauerhafte Änderungen gehören in die Codespaces-Secrets.
:::

::: tip GOOGLE_SERVICE_ACC_PRIVATE_KEY
Der Private Key muss **einzeilig** mit literalen `\n` als Zeilenumbrüchen hinterlegt werden (siehe `src/shared/google_service_account.ts`), nicht als mehrzeiliger PEM-Block. Das gilt für das Secret genauso wie für manuell gepflegte Env-Dateien. In den Env-Dateien steht der Wert in doppelten Anführungszeichen:

```bash
GOOGLE_SERVICE_ACC_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```
:::

## Ablauf: Entwicklung im Codespace

1. Secrets unter *Settings → Secrets and variables → Codespaces* anlegen bzw. anpassen (`DEV_…`, `PROD_…` oder ohne Präfix, s. o.).
2. Codespace neu bauen (*Rebuild Container*), damit `generate-env.sh` beide Dateien neu erzeugt. Bereits laufende Codespaces sehen neue Secrets erst nach einem Rebuild.
3. `slack run` starten, die lokale Dev-App liest `.env`.

## Ablauf: Produktion

1. `slack deploy` ausführen.
2. `npm run env:dry-run` zeigt, welche Keys aus `.env.production` übertragen würden, ohne etwas zu ändern.
3. `npm run env:sync` pusht die Werte per `slack env add` in die deployte App.

Hinweise zum Sync-Skript `scripts/sync-env-to-slack.js`:

- Standardquelle ist `.env.production`. Mit `--file <pfad>` (Kurzform `-f <pfad>`) kann eine andere Datei angegeben werden.
- `--file .env` wird mit Fehler abgelehnt: Das würde Test-Keys in Prod pushen und bei der lokalen App eine Read-Modify-Write-Schleife auf `.env` auslösen (die lokale App nutzt `.env` selbst als Speicher).
- Fehlt die Quelldatei, bricht das Skript mit einem Hinweis ab.
- `npm run env:sync-prune` entfernt zusätzlich Variablen aus der deployten App, die in der gewählten Quelldatei nicht (mehr) vorkommen.
- Werte in der deployten App immer über das Skript setzen, nicht per `slack env add` von Hand.
- Die `npm run env:*`-Skripte brauchen `node`. Ohne Node lässt sich das Skript auch mit Deno ausführen: `deno run --allow-read --allow-run --allow-env scripts/sync-env-to-slack.js` (Flags wie `--dry-run` einfach anhängen).

## Ablauf: ohne Codespaces

Außerhalb von Codespaces (lokal geklont) läuft `generate-env.sh` nicht automatisch. Beide Dateien werden dann manuell angelegt:

```bash
cp .env.example .env
cp .env.example .env.production
```

Danach in `.env` die Test-Keys und in `.env.production` die Prod-Keys eintragen, jeweils in doppelten Anführungszeichen (`KEY="value"`) wie bei den generierten Dateien. Die weiteren Schritte (`slack run` bzw. `slack deploy` → `env:dry-run` → `env:sync`) sind identisch.
