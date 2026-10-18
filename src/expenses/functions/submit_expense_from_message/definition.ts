import { DefineFunction, Schema } from "deno-slack-sdk/mod.ts";

/**
 * Custom function that submits an attachment of an existing Slack message
 * (e.g. an email forwarded by the Slack email integration) as an invoice.
 *
 * Opens a form to pick the attachment and enter the expense details, posts
 * the submission with an approve button to the approver channel (the file
 * as a copy in its thread) and completes once someone approves and states
 * how the expense is paid.
 */
export const SubmitExpenseFromMessageFunction = DefineFunction({
  callback_id: "expenses_submit_from_message",
  title: "Rechnung aus Nachricht einreichen",
  description:
    "Reicht einen Anhang einer Nachricht als Rechnung ein und wartet auf die Freigabe im Approver-Channel",
  source_file: "src/expenses/functions/submit_expense_from_message/mod.ts",
  input_parameters: {
    properties: {
      interactivity: {
        type: Schema.slack.types.interactivity,
        title: "Interaktivität",
        description:
          "Klick, der das Formular öffnet (z. B. Button einer vorherigen Nachricht)",
      },
      channel: {
        type: Schema.slack.types.channel_id,
        title: "Channel der Nachricht",
        description: "Channel, in dem die Nachricht mit dem Anhang liegt",
      },
      // a plain string: Workflow Builder does not show message_ts inputs
      messageTs: {
        type: Schema.types.string,
        title: "Zeitstempel der Nachricht",
        description: "API-Zeitstempel der Nachricht mit dem Anhang",
      },
      approverChannel: {
        type: Schema.slack.types.channel_id,
        title: "Approver-Channel",
        description: "Channel, in dem die Rechnung freigegeben wird",
      },
    },
    required: ["interactivity", "channel", "messageTs", "approverChannel"],
  },
  output_parameters: {
    properties: {
      // a plain string: Workflow Builder does not show file_id outputs
      fileId: {
        type: Schema.types.string,
        title: "Datei-ID",
        description:
          "Kopie der Rechnung im Approver-Channel - z. B. für 'Datei zu Google Drive hochladen'",
      },
      expenseDate: {
        type: Schema.slack.types.date,
        title: "Datum der Ausgabe",
      },
      title: {
        type: Schema.types.string,
        title: "Titel der Ausgabe",
      },
      paymentStatus: {
        type: Schema.types.string,
        title: "Noch offen?",
      },
      paypalAccount: {
        type: Schema.types.string,
        title: "Paypal Konto",
        description: "Leer, wenn nicht angegeben",
      },
      submitter: {
        type: Schema.slack.types.user_id,
        title: "Eingereicht von",
      },
      approver: {
        type: Schema.slack.types.user_id,
        title: "Freigegeben von",
      },
      paymentMethod: {
        type: Schema.types.string,
        title: "Wie wird bezahlt?",
        description: "Bei der Freigabe gewählte Zahlungsart",
      },
      approvalMessage: {
        type: Schema.slack.types.message_context,
        title: "Freigabe-Nachricht",
        description: "Z. B. um im Thread der Freigabe-Nachricht zu antworten",
      },
      approvalMessageLink: {
        type: Schema.types.string,
        title: "Link zur Freigabe-Nachricht",
      },
      approvalMessageTs: {
        type: Schema.types.string,
        title: "Zeitstempel der Freigabe-Nachricht",
        description: "Z. B. um im Thread der Freigabe-Nachricht zu antworten",
      },
    },
    required: [
      "fileId",
      "expenseDate",
      "title",
      "paymentStatus",
      "submitter",
      "approver",
      "paymentMethod",
      "approvalMessage",
      "approvalMessageLink",
      "approvalMessageTs",
    ],
  },
});
