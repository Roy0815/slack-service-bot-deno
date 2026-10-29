import { DefineFunction, Schema } from "deno-slack-sdk/mod.ts";

/**
 * Custom function that opens a popup asking a member from when their new
 * bank details apply. The form itself is sent by the next step,
 * "Kontodaten-Formular senden" - kept separate so the call to the
 * signature service isn't bound to the 3 seconds Slack allows for
 * answering a popup submission.
 */
export const RequestBankChangeFunction = DefineFunction({
  callback_id: "masterdata_request_bank_change",
  title: "Kontodaten-Änderung anfragen",
  description:
    "Öffnet ein Popup für die Änderung der Kontodaten und fragt das Änderungsdatum ab",
  source_file: "src/masterdata/functions/request_bank_change/mod.ts",
  input_parameters: {
    properties: {
      interactivity: {
        type: Schema.slack.types.interactivity,
        title: "Interaktivität",
        description: "Kontext der Interaktion, die den Workflow gestartet hat",
      },
    },
    required: ["interactivity"],
  },
  output_parameters: {
    properties: {
      user: {
        type: Schema.slack.types.user_id,
        title: "Mitglied",
        description: "Slack-User, der die Änderung angefragt hat",
      },
      changeDate: {
        type: Schema.slack.types.date,
        title: "Änderungsdatum",
        description: "Ab wann die neuen Kontodaten gelten",
      },
      email: {
        type: Schema.types.string,
        title: "E-Mail",
        description: "E-Mail-Adresse des Mitglieds laut Stammdaten",
      },
    },
    required: ["user", "changeDate", "email"],
  },
});
