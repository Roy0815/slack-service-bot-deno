import { DefineFunction, Schema } from "deno-slack-sdk/mod.ts";

/**
 * Custom function that opens a popup to pick a date for a "Wer ist da?"
 * query, validating it inline in the popup instead of via a follow-up
 * ephemeral message, and returns the picked date. Posting the actual query
 * stays with WhoIsThereFunction - this step only collects/validates input.
 */
export const WhoIsThereStartFunction = DefineFunction({
  callback_id: "gym_who_is_there_start",
  title: "Wer ist da? - Abfrage starten",
  description:
    "Öffnet ein Popup zur Auswahl des Datums und startet die 'Wer ist da?'-Abfrage",
  source_file: "src/gym/functions/who_is_there_start/mod.ts",
  input_parameters: {
    properties: {
      channel: {
        type: Schema.slack.types.channel_id,
        description: "In welchem Channel soll die Nachricht gesendet werden",
      },
      interactivity: {
        type: Schema.slack.types.interactivity,
        description: "Interactivity-Kontext zum Öffnen des Popups",
      },
    },
    required: ["channel", "interactivity"],
  },
  output_parameters: {
    properties: {
      date: {
        type: Schema.slack.types.date,
        description: "Ausgewähltes und validiertes Datum",
      },
      channel: {
        type: Schema.slack.types.channel_id,
        description: "Channel, für den die Abfrage gestartet werden soll",
      },
    },
    required: ["date", "channel"],
  },
});
