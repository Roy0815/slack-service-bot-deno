# Referenz Workflow-Schritte

Alle Custom Functions, die der Bot aktuell bereitstellt (registriert in `manifest.ts`). Pflichtfelder sind mit **\*** markiert.

## Coaching-Vertrag

Quellcode: `src/signatures/`. Die Feld- und Rollennamen der DocuSeal-Vorlage sind zentral in `src/signatures/coaching_contract.ts` definiert - ändert sich die Vorlage, ist das die einzige Datei, die angepasst werden muss.

### Coaching-Vertrag ausfüllen

`callback_id`: `signatures_coaching_contract_preset`

Öffnet ein Modal für den Coaching-Vertrag. Name, Adresse und E-Mail des Coaches werden pro Slack-User im Datastore `CoachingContractPresets` gespeichert (Primärschlüssel `user_id`, also genau ein Preset pro Person) und beim nächsten Aufruf vorausgefüllt.

Die Function bleibt offen (`completed: false`), bis das Modal abgeschickt oder geschlossen wird. Beim Schließen endet sie mit dem Fehler "Coaching-Vertrag abgebrochen", damit der Workflow nicht hängen bleibt.

| Eingabe | Typ | Beschreibung |
| --- | --- | --- |
| `interactivity` **\*** | `slack#/types/interactivity` | Interaktion, die den Workflow gestartet hat (für das Öffnen des Modals) |

| Ausgabe | Typ | Beschreibung |
| --- | --- | --- |
| `documentValues` | `string` | Alle sechs Vertragsfelder als JSON |
| `coachEmail` | `string` | E-Mail des Coaches |
| `athleteEmail` | `string` | E-Mail des Athleten |

Validierung im Modal: alle Felder Pflicht, E-Mail-Format, Monatsbeitrag als Zahl ≥ 0.

### Coaching-Vertrag senden

`callback_id`: `signatures_send_coaching_request`

Erstellt in DocuSeal eine Submission aus der Vorlage. Die Dokumentwerte werden der Rolle `Coach` zugeordnet, die Empfänger werden in der Reihenfolge Coach → Athlet → Vorstand 1 → Vorstand 2 übergeben. DocuSeal benachrichtigt sie dadurch nacheinander.

| Eingabe | Typ | Beschreibung |
| --- | --- | --- |
| `templateId` **\*** | `string` | ID der DocuSeal-Vorlage (positive Ganzzahl) |
| `documentValues` **\*** | `string` | JSON-Objekt mit den Feldwerten. Nur bekannte Feldnamen, Werte als String, Zahl, Boolean oder String-Array |
| `coachEmail` **\*** | `string` | Empfänger Rolle `Coach` |
| `athleteEmail` **\*** | `string` | Empfänger Rolle `Athlet` |
| `board1Email` **\*** | `string` | Empfänger Rolle `Vorstand 1` |
| `board2Email` **\*** | `string` | Empfänger Rolle `Vorstand 2` |
| `sendEmail` | `boolean` | E-Mail-Versand durch DocuSeal, Standard `true` |

| Ausgabe | Typ | Beschreibung |
| --- | --- | --- |
| `submissionId` | `string` | ID der Submission in DocuSeal |
| `recipientEmails` | `string` | Empfänger, kommagetrennt |
| `signingLinks` | `string` | Je Zeile `Name (Rolle): Link` |

Umgebungsvariablen: `DOCUSEAL_API_KEY`, optional `DOCUSEAL_API_URL` (Standard `https://api.docuseal.eu`). Beide API-Regionen sind in `outgoingDomains` freigegeben, ein Wechsel braucht also kein neues Deployment des Manifests.

## Rechnungen

Quellcode: `src/expenses/`

### Rechnung aus Nachricht einreichen

`callback_id`: `expenses_submit_from_message`

Liest eine Nachricht (auch Thread-Antworten) und bietet ihre Dateien zur Auswahl an. Bei E-Mails aus der Slack-E-Mail-Weiterleitung (`filetype: "email"`) werden nur die Anhänge der E-Mail angeboten. Nach dem Einreichen lädt der Bot die gewählte Datei herunter, postet die Zusammenfassung in den Approver-Channel und lädt die Datei als **eigene Kopie** in den Thread - so können spätere Schritte sie unabhängig von den Rechten am Original lesen. Dann wird der Button **Approve** ergänzt.

Die Function bleibt offen (`completed: false`), bis jemand freigibt und die Zahlungsart wählt. Bei doppelter Freigabe schlägt `completeSuccess` für die zweite Person fehl und sie bekommt einen Hinweis im Modal. Schließen des Einreich-Modals beendet die Function mit "Rechnung einreichen abgebrochen"; Schließen des Freigabe-Modals lässt den Button stehen.

Zugriff auf den Channel über `withChannelAccess` (`src/shared/channel_access.ts`): Öffentlichen Channels tritt der Bot bei Bedarf bei, bei privaten bekommt die auslösende Person eine DM, dass der Bot hinzugefügt werden muss.

| Eingabe | Typ | Beschreibung |
| --- | --- | --- |
| `interactivity` **\*** | `slack#/types/interactivity` | Klick, der das Formular öffnet |
| `channel` **\*** | `slack#/types/channel_id` | Channel der Nachricht |
| `messageTs` **\*** | `string` | API-Zeitstempel der Nachricht, z. B. `1792141861.000100` (bewusst `string`, weil der Workflow Builder `message_ts`-Eingaben nicht anzeigt) |
| `approverChannel` **\*** | `slack#/types/channel_id` | Channel für die Freigabe |

| Ausgabe | Typ | Beschreibung |
| --- | --- | --- |
| `fileId` | `string` | ID der Kopie im Approver-Channel, z. B. für den Drive-Upload |
| `expenseDate` | `slack#/types/date` | Datum der Ausgabe (vorbelegt mit dem Datum der Nachricht, Zeitzone Europe/Berlin) |
| `title` | `string` | Titel der Ausgabe |
| `paymentStatus` | `string` | Text der gewählten Option "Noch offen?" |
| `paypalAccount` | `string` | leer, wenn nicht angegeben |
| `submitter` | `slack#/types/user_id` | Eingereicht von |
| `approver` | `slack#/types/user_id` | Freigegeben von |
| `paymentMethod` | `string` | Text der gewählten Option "Wie wird bezahlt?" |
| `approvalMessage` | `slack#/types/message_context` | Freigabe-Nachricht, z. B. für Antworten im Thread |
| `approvalMessageLink` | `string` | Permalink der Freigabe-Nachricht |
| `approvalMessageTs` | `string` | Zeitstempel der Freigabe-Nachricht |

Bot-Scopes: `channels:history`, `channels:join`, `channels:read`, `groups:history`, `groups:read`, `files:read`, `files:write`. Download-URLs von E-Mail-Anhängen liegen auf `files-origin.slack.com` (in `outgoingDomains`).

## Genehmigung

Quellcode: `src/shared/functions/approver/`

### Genehmigung einholen

`callback_id`: `shared_approver`

Allgemeiner Freigabe-Schritt. Postet `text` mit den Buttons **Freigeben** und **Ablehnen** in den Channel (mit `threadMessageLink` als Antwort im Thread dieser Nachricht, `reply_broadcast: true`) und bleibt offen (`completed: false`), bis jemand entscheidet. Danach wird die Nachricht ohne Buttons neu aufgebaut, mit Entscheidung, Person, Uhrzeit und Datum (Europe/Berlin) als Context-Block, beginnend mit :white_check_mark: bzw. :x:.

- **Reihenfolge:** Bei jeder Entscheidung wird der Schritt **zuerst** abgeschlossen (`completeSuccess` bzw. `completeError`). Slack akzeptiert nur das erste Abschließen einer Execution, dieser Aufruf entscheidet also zwischen gleichzeitigen Klicks. Erst danach folgen DM und `chat.update`. Wer zu spät ist, bekommt "Über diese Anfrage wurde bereits von jemand anderem entschieden": beim Freigeben per `chat.postEphemeral`, beim Ablehnen als Fehler im Grund-Popup (`response_action: "errors"`). Weitere Aktionen gibt es dann nicht.
- **Freigeben:** `completeSuccess` mit `approver`, dann Nachricht aktualisieren.
- **Ablehnen:** Popup mit optionalem Grund. Nach dem Absenden `completeError` mit "Anfrage abgelehnt von <@…>. Grund: …", das bricht den Workflow ab. Dann bekommt `requester` (falls gesetzt) eine DM mit Ablehnung und Grund, darunter der Originaltext klein als Context-Block. Weil Context-Blöcke kein Rich Text annehmen, wird `text` dafür in mrkdwn umgewandelt (`richTextToMrkdwn`, max. 3000 Zeichen). Schlägt die DM fehl, postet der Bot einen Hinweis in den Thread der Anfrage (bzw. in den Thread von `threadMessageLink`) mit `reply_broadcast: true`, damit er auch im Channel erscheint ("bitte persönlich informieren"). Zuletzt wird die Nachricht aktualisiert.
- Schließen des Grund-Popups lässt die Buttons stehen.
- **Text:** Der Workflow Builder liefert `text` als Block vom Typ `expanded_rich_text`, den `chat.postMessage` ablehnt (`invalid_blocks`). Er wird deshalb als `rich_text` gepostet. In eingefügten Variablen werden `<@U…>`, `<#C…>` und `` `Code` `` in echte Erwähnungen bzw. Code-Formatierung umgewandelt, anderes mrkdwn bleibt als Text stehen.
- Schlägt das Posten der Anfrage fehl, endet der Schritt mit der Fehlermeldung statt mit `event_dispatch_failed`.

| Eingabe | Typ | Beschreibung |
| --- | --- | --- |
| `approverChannel` **\*** | `slack#/types/channel_id` | Channel für die Anfrage |
| `text` **\*** | `slack#/types/expanded_rich_text` | Text der Anfrage. Kommt zur Laufzeit als Array mit einem `expanded_rich_text`-Block an, siehe **Text** oben |
| `threadMessageLink` | `string` | Link zu einer Nachricht im Freigabe-Channel. Die Anfrage wird als Thread-Antwort darunter gepostet und auch an den Channel gesendet. Gedacht für Dateien aus Formularen: Die kann der Bot nicht lesen, ein vorheriger „Nachricht senden“-Schritt aber posten. Ein Link statt Zeitstempel, weil der Workflow Builder den Zeitstempel nur auf Sekunden gerundet herausgibt (passt zu keiner Nachricht, Slack würde dann stillschweigend in den Channel posten). Ist der Wert kein Nachrichtenlink oder liegt die Nachricht in einem anderen Channel, bricht der Schritt mit Fehler ab |
| `requester` | `slack#/types/user_id` | Bekommt bei Ablehnung eine DM |

| Ausgabe | Typ | Beschreibung |
| --- | --- | --- |
| `approver` | `slack#/types/user_id` | Freigegeben von |

Keine Umgebungsvariablen. Bot-Scopes: `chat:write`.

## Stammdaten

Quellcode: `src/masterdata/`, Zugriff auf die Stammdaten über `src/shared/masterdata/`. Die Stammdaten liegen in einem Google Sheet mit den Tabellenblättern **Allg Daten** (Mitgliedsdaten, eine Zeile pro Mitglied, inkl. Slack-ID) und **SEPA Daten** (Bankdaten, Zeilen parallel zu "Allg Daten"). Das Backend ist hinter dem Interface `MasterdataService` gekapselt; ein Wechsel weg von Google Sheets betrifft nur `src/shared/masterdata/service.ts`.

Umgebungsvariablen für alle Schritte: `GOOGLE_SERVICE_ACC_EMAIL`, `GOOGLE_SERVICE_ACC_PRIVATE_KEY`, `SPREADSHEET_ID_MASTERDATA`. Der Service Account braucht Bearbeitungsrechte auf das Sheet.

### Austrittsdatum setzen

`callback_id`: `masterdata_set_leave_date`

Schreibt das Austrittsdatum (als `DD.MM.YYYY`) in die Zeile des Mitglieds in "Allg Daten".

| Eingabe | Typ | Beschreibung |
| --- | --- | --- |
| `leaveUser` **\*** | `slack#/types/user_id` | Austretendes Mitglied |
| `leaveDate` **\*** | `slack#/types/date` | Austrittsdatum |

Keine Ausgaben.

### Kontodaten-Änderung anfragen

`callback_id`: `masterdata_request_bank_change`

Öffnet sofort ein Lade-Modal (der Interactivity-Pointer ist nur wenige Sekunden gültig), liest dann die E-Mail des Mitglieds aus den Stammdaten und zeigt das Formular mit Datumsauswahl. Die E-Mail wird nur angezeigt und in `private_metadata` mitgeführt. Fehlt sie oder sind die Stammdaten nicht erreichbar, zeigt das Modal einen Hinweis und die Function endet mit Fehler. Das Datum darf nicht in der Vergangenheit liegen.

Bewusst von **Kontodaten-Formular senden** getrennt, damit der Aufruf des Signatur-Service nicht an die 3 Sekunden gebunden ist, die Slack für die Antwort auf ein Modal erlaubt.

| Eingabe | Typ | Beschreibung |
| --- | --- | --- |
| `interactivity` **\*** | `slack#/types/interactivity` | Interaktion, die den Workflow gestartet hat |

| Ausgabe | Typ | Beschreibung |
| --- | --- | --- |
| `user` | `slack#/types/user_id` | Mitglied |
| `changeDate` | `slack#/types/date` | Ab wann die neuen Kontodaten gelten |
| `email` | `string` | E-Mail laut Stammdaten |

### Kontodaten-Formular senden

`callback_id`: `masterdata_send_bank_change_form`

Liest die E-Mail erneut aus den Stammdaten (nie aus einem Input) und erstellt in DocuSeal eine Submission der Vorlage "Kontodaten ändern" mit E-Mail-Versand. In den Submitter-Metadaten stehen `slackId` und `changeDate` - DocuSeal gibt sie im Webhook "form completed" unverändert zurück, darüber ordnet der Legacy-Bot das unterschriebene Formular dem Mitglied zu. Bei Fehlern bekommt das Mitglied zusätzlich eine DM.

Die Vorlage braucht die Rolle `Mitglied` und die Felder `accountOwner`, `IBAN`, `BIC`, `signingDate` (siehe `src/signatures/bank_change_form.ts`).

| Eingabe | Typ | Beschreibung |
| --- | --- | --- |
| `user` **\*** | `slack#/types/user_id` | Ausgabe *Mitglied* des vorherigen Schritts |
| `changeDate` **\*** | `slack#/types/date` | Ausgabe *Änderungsdatum* des vorherigen Schritts |
| `templateId` **\*** | `string` | ID der Vorlage "Kontodaten ändern" in DocuSeal |

| Ausgabe | Typ | Beschreibung |
| --- | --- | --- |
| `submissionId` | `string` | ID der Submission |
| `email` | `string` | Adresse, an die das Formular ging |

Zusätzliche Umgebungsvariablen: `DOCUSEAL_API_KEY`, optional `DOCUSEAL_API_URL`.

### Kontodaten speichern

`callback_id`: `masterdata_save_bank_details`

Normalisiert und prüft IBAN (Format und Prüfziffer nach ISO 13616) und BIC und schreibt sie zusammen mit Kontoinhaber:in und Unterschriftsdatum in "SEPA Daten". Ein leeres Unterschriftsdatum lässt den gespeicherten Wert unverändert.

| Eingabe | Typ | Beschreibung |
| --- | --- | --- |
| `user` **\*** | `slack#/types/user_id` | Mitglied |
| `IBAN` **\*** | `string` | IBAN, Leerzeichen und Kleinbuchstaben erlaubt |
| `BIC` **\*** | `string` | BIC |
| `accountOwner` | `string` | Kontoinhaber:in, nur wenn abweichend |
| `signingDate` | `string` | Unterschriftsdatum als `JJJJ-MM-TT` (Text, weil Webhook-Variablen im Workflow Builder nur Text sind) |

| Ausgabe | Typ | Beschreibung |
| --- | --- | --- |
| `firstname` | `string` | Vorname laut Stammdaten |
| `lastname` | `string` | Nachname laut Stammdaten |

## Google Drive

Quellcode: `src/google_drive/`

### Datei zu Google Drive hochladen

`callback_id`: `google_drive_upload_file`

Lädt eine Slack-Datei oder eine öffentliche URL per Multipart-Upload in einen Drive-Ordner. Bei Slack-Dateien wird die Dateiendung des Originals an `fileName` angehängt, der MIME-Type kommt von Slack. Bei URLs wird der MIME-Type aus der Endung im Dateinamen geraten (`src/google_drive/lib/mime_types.ts`).

| Eingabe | Typ | Beschreibung |
| --- | --- | --- |
| `file` | `string` | ID einer in Slack hochgeladenen Datei (bewusst `string` statt `file_id`, weil der Workflow Builder `file_id`-Eingaben nicht anzeigt) |
| `fileURL` | `string` | Alternative zu `file`: öffentliche URL inkl. Dateiendung |
| `fileName` **\*** | `string` | Dateiname in Drive |
| `fileDate` | `slack#/types/date` | Wird als `YYYYMMDD ` vorangestellt |
| `driveFolderID` **\*** | `string` | ID des Zielordners |

| Ausgabe | Typ | Beschreibung |
| --- | --- | --- |
| `driveFileId` | `string` | ID der Datei in Drive |
| `driveFileURL` | `string` | `webViewLink` der Datei |

Slack-Dateien werden mit dem Token der Function heruntergeladen (`token` im Handler), ein eigener Bot-Token ist nicht nötig.

Umgebungsvariablen: `GOOGLE_SERVICE_ACC_EMAIL`, `GOOGLE_SERVICE_ACC_PRIVATE_KEY`. Bot-Scopes: `files:read`.

## Utility

Quellcode: `src/utility/`. Keine Umgebungsvariablen nötig.

### Datum formatieren

`callback_id`: `utility_format_date`

Ersetzt im Formatstring `YYYY`, `MM` und `DD` durch die Teile des Datums.

| Eingabe | Typ | Beschreibung |
| --- | --- | --- |
| `date` **\*** | `slack#/types/date` | Datum (`YYYY-MM-DD`) |
| `format` **\*** | `string` | Formatstring, z. B. `DD.MM.YYYY` |

| Ausgabe | Typ | Beschreibung |
| --- | --- | --- |
| `formattedDate` | `string` | Formatiertes Datum |

### URL kodieren

`callback_id`: `utility_encode_url`

Kodiert die Eingabe mit [`encodeURIComponent`](https://developer.mozilla.org/de/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent). Auch Zeichen mit Bedeutung in URLs (`: / ? & = #`) werden kodiert - gedacht für einzelne Werte, die in einen Link eingesetzt werden, nicht für komplette Links.

| Eingabe | Typ | Beschreibung |
| --- | --- | --- |
| `input` **\*** | `string` | Zu kodierende Zeichenkette |

| Ausgabe | Typ | Beschreibung |
| --- | --- | --- |
| `encodedString` | `string` | Kodierte Zeichenkette |

## Datastores

| Name | Primärschlüssel | Inhalt |
| --- | --- | --- |
| `CoachingContractPresets` | `user_id` | `firstName`, `lastName`, `street`, `cityPostalcode`, `coachEmail`, `updated_at` |

## Neue Function hinzufügen

1. Ordner `src/<domäne>/functions/<name>/` mit `definition.ts` und `mod.ts` anlegen.
2. Function in `manifest.ts` unter `functions` eintragen, ggf. neue `outgoingDomains` und `botScopes` ergänzen.
3. Neue Umgebungsvariablen in `.env.example` eintragen (siehe [Umgebungen & Secrets](./umgebungen)).
4. Deployen und ggf. [freigeben](./freigaben).
5. In dieser Referenz und in der [Anleitung](../anleitung/mitglieder) dokumentieren.
