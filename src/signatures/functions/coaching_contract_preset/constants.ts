import { CoachingFieldName } from "../../coaching_contract.ts";

/** callback_id of the modal - the view handlers are registered on it */
export const ModalCallbackId = "signatures_coaching_contract_preset_modal";

export const ActionIds = {
  /** Shared by every document field input; the block_id tells them apart */
  field: "field",
  savePreset: "save_preset",
  coachEmail: "coach_email",
  athleteEmail: "athlete_email",
} as const;

export const BlockIds = {
  field: (name: CoachingFieldName): string => `field__${name}`,
  savePreset: "save_preset_block",
  coachEmail: "coach_email_block",
  athleteEmail: "athlete_email_block",
} as const;

/** Option value of the single "save my data" checkbox */
export const SavePresetOptionValue = "save";
