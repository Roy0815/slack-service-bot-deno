# Workflow Schritte

Custom Functions, die als einzelne Schritte in Slacks Workflow Builder eingebaut werden können, statt einen kompletten Prozess selbst abzubilden.

## Freigabe

Custom Functions sind nach dem Deployment standardmäßig nur für die App-Inhaber (Collaborators) im Workflow Builder sichtbar. Damit andere Mitglieder sie in eigenen Workflows verwenden können, muss der Zugriff pro Function über die Slack CLI freigegeben werden. Referenziert wird die Function dabei über ihre `callback_id` aus der jeweiligen `definition.ts`.

Aktuelle Freigabe einer Function prüfen:

```sh
slack function access --name utility_format_date --info
```

Function für alle Mitglieder des Workspaces freigeben:

```sh
slack function access --name utility_format_date --everyone --grant
slack function access --name utility_encode_url --everyone --grant
```

Die Freigabe gilt pro App: Die CLI fragt beim Aufruf ab, ob die lokale Dev-App oder die deployte App gemeint ist.

::: warning
Functions mit Zugriff auf Mitgliederdaten (z. B. die Stammdaten-Schritte) nicht für alle freigeben, sondern bei den App-Inhabern belassen.
:::

## Konfiguration

### Stammdaten

::: details Workflow Steps {open}

- Austrittsdatum setzen (`setLeaveDate`)
- Neues Mitglied speichern (`saveNewMember`)
  :::

**Austrittsdatum setzen** speichert das Austrittsdatum eines Mitglieds im Stammdaten-Sheet. Nimmt den betroffenen Slack-User sowie das Austrittsdatum entgegen.

**Neues Mitglied speichern** legt ein neues Mitglied inkl. SEPA-Bankdaten im Stammdaten-Sheet an, postet eine vCard-Kontaktkarte des Mitglieds in einen Admin-Channel und gibt die generierten SEPA-Werte (Mandatsreferenz, Erst- und Folgebetrag) sowie den Link zur Kontaktkarten-Nachricht zurück. Nimmt alle Mitglieds- und Bankdaten (Name, Kontakt, Adresse, Geburtsdatum, IBAN/BIC, ggf. abweichender Kontoinhaber, Datum der Mandats-Unterschrift) sowie den Ziel-Channel für die Kontaktkarte entgegen.

Beide Schritte benötigen einen Google Service Account mit Zugriff auf das Stammdaten-Sheet (`GOOGLE_SERVICE_ACC_EMAIL`, `GOOGLE_SERVICE_ACC_PRIVATE_KEY`) sowie die ID des Sheets (`SPREADSHEET_ID_MASTERDATA`). Für `saveNewMember` muss das Sheet zusätzlich ein Tabellenblatt "SEPA Daten" mit den Bankdaten-Spalten enthalten, sowie die Berechtigung `files:write` und `team:read` für den Bot (Kontaktkarten-Upload bzw. Link-Erzeugung).

### Google Drive

::: details Workflow Steps {open}

- Datei zu Google Drive hochladen (`uploadFileToGoogleDrive`)
  :::

Lädt eine in Slack hochgeladene Datei oder eine öffentlich erreichbare URL in einen Google Drive Ordner hoch. Gibt die ID sowie den Link der abgelegten Datei zurück.

Benötigt denselben Google Service Account wie oben (`GOOGLE_SERVICE_ACC_EMAIL`, `GOOGLE_SERVICE_ACC_PRIVATE_KEY`), mit Zugriff auf den jeweiligen Google Drive Ordner.

### Signaturen

::: details Workflow Steps {open}

- Coaching-Vertrag ausfüllen (`coachingContractPreset`)
- Coaching-Vertrag senden (`sendCoachingRequest`)
  :::

**Coaching-Vertrag ausfüllen** öffnet ein Formular für einen Coaching-Vertrag. Abgefragt werden Name und Adresse des Coaches, Coaching-Start, Monatsbeitrag sowie die E-Mail-Adressen von Coach und Athlet. Name, Adresse und E-Mail des Coaches lassen sich als persönliches Preset speichern (eins pro Slack-User) und sind beim nächsten Aufruf vorausgefüllt. Benötigt den Input `interactivity`, der Workflow muss also z. B. über einen Button oder Shortcut gestartet werden. Gibt die Vertragswerte als JSON (`documentValues`) sowie die E-Mail-Adressen von Coach und Athlet zurück.

**Coaching-Vertrag senden** füllt die Vertragsvorlage im Signatur-Service (DocuSeal) mit den Werten aus dem vorherigen Schritt aus und erstellt die Signaturanfrage. Nimmt die Vorlagen-ID, die `documentValues` sowie die E-Mail-Adressen von Coach, Athlet und zwei Vorstandsmitgliedern entgegen. Unterschrieben wird in der Reihenfolge Coach → Athlet → Vorstand 1 → Vorstand 2; der Service benachrichtigt jede Partei erst, wenn die vorherige unterschrieben hat. Optional lässt sich der E-Mail-Versand durch DocuSeal abschalten (`sendEmail`, Standard: an). Gibt die ID der Anfrage, die Empfänger und die Signier-Links zurück.

Beide Schritte werden typischerweise hintereinander im selben Workflow eingesetzt.

Benötigt einen DocuSeal API-Key (`DOCUSEAL_API_KEY`). `DOCUSEAL_API_URL` kann leer bleiben und zeigt dann auf den EU-Server (`https://api.docuseal.eu`); für den US-Server `https://api.docuseal.com` eintragen. Die Feld- und Rollennamen der Vorlage in DocuSeal müssen exakt zu `src/signatures/coaching_contract.ts` passen (Felder `firstName`, `lastName`, `street`, `cityPostalcode`, `coachingStartDate`, `monthlyRate`; Rollen `Coach`, `Athlet`, `Vorstand 1`, `Vorstand 2`).

### Utility

::: details Workflow Steps {open}

- Datum formatieren (`formatDate`)
- URL kodieren (`encodeURL`)
  :::

**Datum formatieren** wandelt ein Datum anhand eines Formatstrings mit den Platzhaltern `YYYY`, `MM` und `DD` um (z. B. `DD.MM.YYYY`).

**URL kodieren** kodiert eine Zeichenkette für die Verwendung in einer URL (`encodeURI`).

Keine besondere Konfiguration nötig.
