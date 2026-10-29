# Freigabe von Schritten

Custom Functions sind nach dem Deployment standardmäßig nur für die App-Inhaber:innen (Collaborators) im Workflow Builder sichtbar. Damit andere Mitglieder sie in eigenen Workflows verwenden können, muss der Zugriff pro Function über die Slack CLI freigegeben werden.

Die Freigabe betrifft nur das **Bauen** von Workflows. Einen fertigen Workflow, der einen Schritt verwendet, kann jede:r starten, die/der Zugriff auf den Workflow hat.

## Aktueller Stand

| Function | `callback_id` | Freigabe |
| --- | --- | --- |
| Datum formatieren | `utility_format_date` | alle Mitglieder |
| URL kodieren | `utility_encode_url` | alle Mitglieder |
| Coaching-Vertrag ausfüllen | `signatures_coaching_contract_preset` | App-Inhaber:innen |
| Coaching-Vertrag senden | `signatures_send_coaching_request` | App-Inhaber:innen |
| Rechnung aus Nachricht einreichen | `expenses_submit_from_message` | App-Inhaber:innen |
| Austrittsdatum setzen | `masterdata_set_leave_date` | App-Inhaber:innen |
| Kontodaten-Änderung anfragen | `masterdata_request_bank_change` | App-Inhaber:innen |
| Kontodaten-Formular senden | `masterdata_send_bank_change_form` | App-Inhaber:innen |
| Kontodaten speichern | `masterdata_save_bank_details` | App-Inhaber:innen |
| Datei zu Google Drive hochladen | `google_drive_upload_file` | App-Inhaber:innen |

::: warning
Functions mit Zugriff auf Vereinsdaten oder externe Konten (Stammdaten, Google Drive, DocuSeal) nicht für alle freigeben, sondern bei den App-Inhaber:innen belassen. Der Drive-Upload z. B. kann in jeden Ordner schreiben, der für den Service Account freigegeben ist.
:::

## Befehle

Referenziert wird eine Function über ihre `callback_id` aus der jeweiligen `definition.ts`. Die CLI fragt beim Aufruf, ob die lokale Dev-App oder die deployte App gemeint ist - die Freigabe gilt pro App.

Aktuelle Freigabe prüfen:

```sh
slack function access --name utility_format_date --info
```

Für alle Mitglieder des Workspaces freigeben:

```sh
slack function access --name utility_format_date --everyone --grant
slack function access --name utility_encode_url --everyone --grant
```

Für einzelne Personen freigeben (Slack User-ID, z. B. aus dem Profil über *⋮ → Mitglieds-ID kopieren*):

```sh
slack function access --name google_drive_upload_file --users U0123456789 --grant
```

Freigabe wieder auf die App-Inhaber:innen beschränken:

```sh
slack function access --name utility_format_date --app-collaborators
```

## App-Inhaber:innen verwalten

Wer App-Inhaber:in ist, sieht alle Functions und kann die App deployen:

```sh
slack collaborator list
slack collaborator add person@example.com
```
