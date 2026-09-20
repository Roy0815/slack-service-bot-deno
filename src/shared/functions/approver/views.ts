export const rejectReasonViewCallbackId = "approver_reject_reason_modal";

export const BlockIds = {
  reason: "reason_block",
} as const;

export const ActionIds = {
  reason: "reason_input",
} as const;

/**
 * Popup shown when the approver clicks "Ablehnen", to optionally capture a
 * reason. `privateMetadata` carries the original message's location
 * (channel/ts) through to the view-submission handler.
 */
// deno-lint-ignore no-explicit-any
export function rejectReasonModal(privateMetadata: string): any {
  return {
    type: "modal",
    callback_id: rejectReasonViewCallbackId,
    private_metadata: privateMetadata,
    title: { type: "plain_text", text: "Ablehnen" },
    submit: { type: "plain_text", text: "Ablehnen" },
    close: { type: "plain_text", text: "Abbrechen" },
    blocks: [
      {
        type: "input",
        block_id: BlockIds.reason,
        optional: true,
        label: { type: "plain_text", text: "Grund (optional)" },
        element: {
          type: "plain_text_input",
          action_id: ActionIds.reason,
          multiline: true,
        },
      },
    ],
  };
}
