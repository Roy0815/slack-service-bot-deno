import { DefineFunction, Schema } from "deno-slack-sdk/mod.ts";

/**
 * Custom function that records a member's leave date in the masterdata
 * backend.
 */
export const SetLeaveDateFunction = DefineFunction({
  callback_id: "masterdata_set_leave_date",
  title: "Austrittsdatum setzen",
  description: "Speichert das Austrittsdatum eines Mitglieds in den Stammdaten",
  source_file: "src/masterdata/functions/set_leave_date/mod.ts",
  input_parameters: {
    properties: {
      leaveUser: {
        type: Schema.slack.types.user_id,
        description: "Slack-User des austretenden Mitglieds",
      },
      leaveDate: {
        type: Schema.slack.types.date,
        description: "Austrittsdatum",
      },
    },
    required: ["leaveUser", "leaveDate"],
  },
  output_parameters: {
    properties: {},
    required: [],
  },
});
