import { DefineFunction, Schema } from "deno-slack-sdk/mod.ts";

/**
 * Generic approval step: posts a message with Freigeben/Ablehnen buttons to
 * a channel and waits for a decision. Knows nothing about what is being
 * approved - the caller supplies the message text and, on approval,
 * chains whatever follow-up step actually applies the change. A rejection
 * DMs the requester (if given) and ends the step with an error, so no
 * later workflow step runs. Only an approval has outputs: the approver and
 * the approval message.
 */
export const ApproverFunction = DefineFunction({
  callback_id: "shared_approver",
  title: "Genehmigung einholen",
  description:
    "Sendet eine Nachricht mit Freigeben/Ablehnen-Buttons an einen Channel und wartet auf die Entscheidung. Bei Ablehnung bricht der Workflow ab",
  source_file: "src/shared/functions/approver/mod.ts",
  input_parameters: {
    properties: {
      approverChannel: {
        type: Schema.slack.types.channel_id,
        title: "Freigabe-Channel",
        description: "Channel, in dem die Genehmigungsanfrage gepostet wird",
      },
      text: {
        type: Schema.slack.types.expanded_rich_text,
        title: "Text",
        description: "Text der Genehmigungsanfrage",
      },
      threadMessageLink: {
        type: Schema.types.string,
        title: "Thread-Nachricht",
        description:
          "Link zu einer Nachricht im Freigabe-Channel, z. B. mit einer Datei. Die Anfrage wird dann als Antwort in deren Thread gepostet und auch an den Channel gesendet (optional)",
      },
      requester: {
        type: Schema.slack.types.user_id,
        title: "Anfragende Person",
        description: "Wird bei Ablehnung per DM benachrichtigt (optional)",
      },
    },
    required: ["approverChannel", "text"],
  },
  output_parameters: {
    properties: {
      approver: {
        type: Schema.slack.types.user_id,
        title: "Freigegeben von",
        description: "Freigegeben von",
      },
      approvalMessage: {
        type: Schema.slack.types.message_context,
        title: "Freigabe-Nachricht",
        description:
          "Z. B. für die Nachricht eines Listenelements oder um im Thread zu antworten",
      },
      approvalMessageLink: {
        type: Schema.types.string,
        title: "Link zur Freigabe-Nachricht",
      },
      approvalMessageTs: {
        type: Schema.types.string,
        title: "Zeitstempel der Freigabe-Nachricht",
      },
      interactivity: {
        type: Schema.slack.types.interactivity,
        title: "Interaktivität",
        description:
          "Klick auf Freigeben, z. B. um danach ein Popup für die freigebende Person zu öffnen",
      },
    },
    required: [
      "approver",
      "interactivity",
      "approvalMessage",
      "approvalMessageLink",
      "approvalMessageTs",
    ],
  },
});
