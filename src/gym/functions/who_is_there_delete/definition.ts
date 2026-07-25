import { DefineFunction } from "deno-slack-sdk/mod.ts";

/**
 * Custom function that removes outdated "Wer ist da?" requests (older than
 * today) from both the datastore and the gym channel.
 */
export const WhoIsThereDeleteFunction = DefineFunction({
  callback_id: "gym_who_is_there_delete",
  title: "Wer ist da? aufräumen",
  description:
    "Löscht abgelaufene 'Wer ist da?'-Abfragen aus dem Datastore und Channel",
  source_file: "src/gym/functions/who_is_there_delete/mod.ts",
  input_parameters: {
    properties: {},
    required: [],
  },
  output_parameters: {
    properties: {},
    required: [],
  },
});
