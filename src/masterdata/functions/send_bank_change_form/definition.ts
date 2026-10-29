import { DefineFunction, Schema } from "deno-slack-sdk/mod.ts";

/**
 * Custom function that sends the bank details change form to a member for
 * signing. The recipient is always the email in the masterdata, never a
 * value passed in - see "Kontodaten-Änderung anfragen".
 *
 * The signed form comes back through the signature service's webhook
 * (legacy bot) - the submitter metadata carries the member's Slack ID and
 * the change date.
 */
export const SendBankChangeFormFunction = DefineFunction({
  callback_id: "masterdata_send_bank_change_form",
  title: "Kontodaten-Formular senden",
  description:
    "Sendet dem Mitglied das Formular für neue Kontodaten zur Unterschrift an seine E-Mail aus den Stammdaten",
  source_file: "src/masterdata/functions/send_bank_change_form/mod.ts",
  input_parameters: {
    properties: {
      user: {
        type: Schema.slack.types.user_id,
        title: "Mitglied",
        description:
          "Output 'Mitglied' des Schritts 'Kontodaten-Änderung anfragen'",
      },
      changeDate: {
        type: Schema.slack.types.date,
        title: "Änderungsdatum",
        description:
          "Output 'Änderungsdatum' des Schritts 'Kontodaten-Änderung anfragen'",
      },
      templateId: {
        type: Schema.types.string,
        title: "Vorlagen-ID",
        description: "ID der Vorlage 'Kontodaten ändern' im Signatur-Service",
      },
    },
    required: ["user", "changeDate", "templateId"],
  },
  output_parameters: {
    properties: {
      submissionId: {
        type: Schema.types.string,
        title: "Anfrage-ID",
        description: "ID der erstellten Signaturanfrage",
      },
      email: {
        type: Schema.types.string,
        title: "E-Mail",
        description: "E-Mail-Adresse, an die das Formular ging",
      },
    },
    required: ["submissionId", "email"],
  },
});
