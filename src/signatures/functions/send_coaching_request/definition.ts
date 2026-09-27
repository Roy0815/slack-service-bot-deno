import { DefineFunction, Schema } from "deno-slack-sdk/mod.ts";

/**
 * Custom function that creates the signature request for a coaching
 * contract: pre-fills the template with the values collected by
 * "Coaching-Vertrag ausfüllen" and sends it to the four parties.
 */
export const SendCoachingRequestFunction = DefineFunction({
  callback_id: "signatures_send_coaching_request",
  title: "Coaching-Vertrag senden",
  description:
    "Füllt die Coaching-Vertragsvorlage aus und sendet die Signaturanfrage an Coach, Athlet und Vorstand",
  source_file: "src/signatures/functions/send_coaching_request/mod.ts",
  input_parameters: {
    properties: {
      templateId: {
        type: Schema.types.string,
        title: "Vorlagen-ID",
        description: "ID der Coaching-Vertragsvorlage im Signatur-Service",
      },
      documentValues: {
        type: Schema.types.string,
        title: "Dokumentwerte (JSON)",
        description:
          "Feldwerte als JSON - Output 'Dokumentwerte' des Schritts 'Coaching-Vertrag ausfüllen'",
      },
      coachEmail: {
        type: Schema.types.string,
        title: "E-Mail Coach",
        description: "Empfänger für die Rolle 'Coach'",
      },
      athleteEmail: {
        type: Schema.types.string,
        title: "E-Mail Athlet",
        description: "Empfänger für die Rolle 'Athlet'",
      },
      board1Email: {
        type: Schema.types.string,
        title: "E-Mail Vorstand 1",
        description: "Empfänger für die Rolle 'Vorstand 1'",
      },
      board2Email: {
        type: Schema.types.string,
        title: "E-Mail Vorstand 2",
        description: "Empfänger für die Rolle 'Vorstand 2'",
      },
      sendEmail: {
        type: Schema.types.boolean,
        title: "E-Mail versenden",
        description:
          "Ob der Signatur-Service die Empfänger per E-Mail benachrichtigt (Standard: ja)",
      },
    },
    required: [
      "templateId",
      "documentValues",
      "coachEmail",
      "athleteEmail",
      "board1Email",
      "board2Email",
    ],
  },
  output_parameters: {
    properties: {
      submissionId: {
        type: Schema.types.string,
        title: "Anfrage-ID",
        description: "ID der erstellten Signaturanfrage",
      },
      recipientEmails: {
        type: Schema.types.string,
        title: "Empfänger",
        description: "E-Mail-Adressen der Empfänger, kommagetrennt",
      },
      signingLinks: {
        type: Schema.types.string,
        title: "Signier-Links",
        description:
          "Liste der Empfänger mit ihrem Signier-Link, je Zeile ein Eintrag",
      },
    },
    required: ["submissionId", "recipientEmails", "signingLinks"],
  },
});
