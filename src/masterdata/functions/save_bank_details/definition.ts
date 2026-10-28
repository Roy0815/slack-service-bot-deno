import { DefineFunction, Schema } from "deno-slack-sdk/mod.ts";

/**
 * Custom function that stores a member's new bank details in the
 * masterdata backend, once the admins approved the signed change form.
 */
export const SaveBankDetailsFunction = DefineFunction({
  callback_id: "masterdata_save_bank_details",
  title: "Kontodaten speichern",
  description: "Speichert neue Kontodaten eines Mitglieds in den Stammdaten",
  source_file: "src/masterdata/functions/save_bank_details/mod.ts",
  input_parameters: {
    properties: {
      user: {
        type: Schema.slack.types.user_id,
        title: "Mitglied",
        description: "Slack-User, dessen Kontodaten geändert werden",
      },
      IBAN: { type: Schema.types.string, title: "IBAN", description: "IBAN" },
      BIC: { type: Schema.types.string, title: "BIC", description: "BIC" },
      accountOwner: {
        type: Schema.types.string,
        title: "Kontoinhaber",
        description:
          "Kontoinhaber, falls abweichend vom Mitglied (sonst leer lassen)",
      },
      // text, not a date: Workflow Builder webhook variables can only be
      // text, and this value comes straight from the signature webhook
      signingDate: {
        type: Schema.types.string,
        title: "Unterschriftsdatum",
        description:
          "Datum, an dem das neue SEPA-Mandat unterschrieben wurde (JJJJ-MM-TT)",
      },
    },
    required: ["user", "IBAN", "BIC"],
  },
  output_parameters: {
    properties: {
      firstname: {
        type: Schema.types.string,
        title: "Vorname",
        description: "Vorname des Mitglieds laut Stammdaten",
      },
      lastname: {
        type: Schema.types.string,
        title: "Nachname",
        description: "Nachname des Mitglieds laut Stammdaten",
      },
    },
    required: ["firstname", "lastname"],
  },
});
