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

### Utility

::: details Workflow Steps {open}

- Datum formatieren (`formatDate`)
- URL kodieren (`encodeURL`)
  :::

**Datum formatieren** wandelt ein Datum anhand eines Formatstrings mit den Platzhaltern `YYYY`, `MM` und `DD` um (z. B. `DD.MM.YYYY`).

**URL kodieren** kodiert eine Zeichenkette für die Verwendung in einer URL (`encodeURI`).

Keine besondere Konfiguration nötig.
