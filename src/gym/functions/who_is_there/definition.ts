import { DefineFunction, Schema } from "deno-slack-sdk/mod.ts";
/**
 * Custom function that sends a message to the gym channel asking who is there on a given day.
 * The message contains a button that allows users to respond with their availability.
 */
export const WhoIsThereFunction = DefineFunction({
  callback_id: "gym_who_is_there",
  title: "Wer ist da?",
  description: "Sendet eine 'Wer ist da?'-Nachricht an den Stätte-Channel",
  source_file: "src/gym/functions/who_is_there/mod.ts",
  input_parameters: {
    properties: {
      /* interactivity: {
        type: Schema.slack.types.interactivity,
      }, */
      user: {
        type: Schema.slack.types.user_id,
        description: "Welcher User hat angefragt?",
      },
      date: {
        type: Schema.slack.types.date,
        description: "Für welches Datum soll die Nachricht gesendet werden",
      },
      channel: {
        type: Schema.slack.types.channel_id,
        description: "In welchem Channel soll die Nachricht gesendet werden",
      },
    },
    required: [
      "date",
      "user",
      /* "interactivity", */
      "channel",
    ],
  },
  output_parameters: {
    properties: {},
    required: [],
  },
});
