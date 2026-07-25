export const ActionIds = {
  submitAvailability: "submit_availability",
  deleteMyAvailability: "delete_my_availability",
  creatorDeleteMessage: "creator_delete_message",
  timePicker: "time_picker",
} as const;

// Since all active dates share a single message, every date's input/actions
// blocks need their own block_id so interactions can be traced back to it.
const inputBlockPrefix = "input_block__";
const actionsBlockPrefix = "actions_block__";

export const BlockIds = {
  inputBlock: (date: string): string => `${inputBlockPrefix}${date}`,
  actionsBlock: (date: string): string => `${actionsBlockPrefix}${date}`,
  dateFromActionsBlock: (blockId: string): string =>
    blockId.slice(actionsBlockPrefix.length),
};
