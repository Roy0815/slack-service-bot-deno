import { today } from "../../../shared/util.ts";

export const whoIsThereStartViewCallbackId = "who_is_there_start_modal";

export const BlockIds = {
  date: "date_block",
} as const;

export const ActionIds = {
  date: "date_input",
} as const;

/**
 * Builds the "Wer ist da?" popup. The channel is only ever shown (it comes
 * from the step's own input parameter, not something the user picks), so
 * it's a plain text section rather than an input.
 */
// deno-lint-ignore no-explicit-any
export function whoIsThereStartModal(channel: string): any {
  return {
    type: "modal",
    callback_id: whoIsThereStartViewCallbackId,
    title: { type: "plain_text", text: "Wer ist da?" },
    submit: { type: "plain_text", text: "Abfrage starten" },
    close: { type: "plain_text", text: "Abbrechen" },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Channel: <#${channel}>`,
        },
      },
      {
        type: "input",
        block_id: BlockIds.date,
        label: { type: "plain_text", text: "Für welches Datum?" },
        element: {
          type: "datepicker",
          action_id: ActionIds.date,
          initial_date: today(),
          placeholder: { type: "plain_text", text: "Datum wählen" },
        },
      },
    ],
  };
}
