import { DefineFunction, Schema } from "deno-slack-sdk/mod.ts";

/**
 * Custom function that opens the coaching contract form. The coach's own
 * name and address can be saved as a personal preset and are pre-filled on
 * the next run; coaching start, monthly rate and the two email addresses
 * are entered per contract.
 *
 * Outputs the document values as a JSON string for the
 * "Coaching-Vertrag senden" step.
 */
export const CoachingContractPresetFunction = DefineFunction({
  callback_id: "signatures_coaching_contract_preset",
  title: "Coaching-Vertrag ausfüllen",
  description:
    "Öffnet das Formular für einen Coaching-Vertrag; persönliche Daten werden als Preset gemerkt",
  source_file: "src/signatures/functions/coaching_contract_preset/mod.ts",
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
      documentValues: {
        type: Schema.types.string,
        title: "Dokumentwerte (JSON)",
        description:
          "Alle Feldwerte für den Vertrag als JSON - an 'Coaching-Vertrag senden' übergeben",
      },
      coachEmail: {
        type: Schema.types.string,
        title: "E-Mail Coach",
        description: "E-Mail-Adresse des Coaches",
      },
      athleteEmail: {
        type: Schema.types.string,
        title: "E-Mail Athlet",
        description: "E-Mail-Adresse des Athleten",
      },
    },
    required: ["documentValues", "coachEmail", "athleteEmail"],
  },
});
