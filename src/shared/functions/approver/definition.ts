import { DefineFunction, Schema } from "deno-slack-sdk/mod.ts";

/**
 * Generic approval step: posts a message with Freigeben/Ablehnen buttons to
 * a channel and waits for a decision. Knows nothing about what is being
 * approved - the caller supplies the message text and, on approval,
 * chains whatever follow-up step actually applies the change.
 */
export const ApproverFunction = DefineFunction({
  callback_id: "shared_approver",
  title: "Genehmigung einholen",
  description:
    "Sendet eine Nachricht mit Freigeben/Ablehnen-Buttons an einen Channel und wartet auf die Entscheidung",
  source_file: "src/shared/functions/approver/mod.ts",
  input_parameters: {
    properties: {
      approverChannel: {
        type: Schema.slack.types.channel_id,
        description: "Channel, in dem die Genehmigungsanfrage gepostet wird",
      },
      text: {
        type: Schema.slack.types.expanded_rich_text,
        description: "Text der Genehmigungsanfrage",
      },
      attachment: {
        type: Schema.slack.types.rich_text,
        description: "Anhang für die Genehmigungsanfrage",
      },
    },
    required: ["approverChannel", "text"],
  },
  output_parameters: {
    properties: {
      approved: {
        type: Schema.types.boolean,
        description: "Ob die Anfrage freigegeben wurde",
      },
      reason: {
        type: Schema.types.string,
        description: "Grund bei Ablehnung (optional)",
      },
    },
    required: ["approved"],
  },
});
