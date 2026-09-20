# Wer ist da?

Mit dieser Funktion kann im Trainingsstätte-Channel abgefragt werden, wer an einem bestimmten Tag trainiert.

## Ablauf

1. Ein:e Nutzer:in startet den zugehörigen Workflow und gibt ein Datum an.
2. Der Bot postet eine Nachricht im Channel mit dem gewählten Datum.
3. Andere Mitglieder wählen über eine Zeit-Auswahl ihre voraussichtliche Ankunftszeit und bestätigen mit **Abschicken**. Die eigene Zeile kann jederzeit über **Meine Löschen** wieder entfernt werden.
4. Alle bisher eingetragenen Zeiten werden direkt unter der jeweiligen Datumsabfrage angezeigt.

## Mehrere Termine gleichzeitig

Für jeden Channel existiert immer nur **eine** "Wer ist da?"-Nachricht. Wird für ein weiteres Datum eine neue Abfrage gestartet, während bereits eine aktive Nachricht existiert, wird diese nicht dupliziert, sondern die bestehende Nachricht um das neue Datum ergänzt (getrennt durch eine Trennlinie). Für ein Datum, für das schon eine Abfrage läuft, kann keine zweite gestartet werden.

## Abfrage löschen

Über das Overflow-Menü (⋮) neben den Buttons kann die/der Ersteller:in einer Abfrage **Ersteller: Abfrage löschen** wählen, um nur diese Datumsabfrage aus der Nachricht zu entfernen. Sind danach keine Termine mehr aktiv, wird die gesamte Nachricht gelöscht.

Abgelaufene Termine (Datum in der Vergangenheit) werden automatisch aus der Nachricht entfernt.
