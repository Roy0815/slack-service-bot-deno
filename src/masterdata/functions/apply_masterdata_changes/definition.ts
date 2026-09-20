import { DefineFunction } from "deno-slack-sdk/mod.ts";
import { masterdataChangesProperty } from "../../../shared/masterdata/schema.ts";

/**
 * Custom function that persists a previously approved set of masterdata
 * changes (as produced by ChangeMasterdataPopupFunction) via the
 * masterdata service. Meant to be chained after an Approver step that
 * returned `approved: true`.
 */
export const ApplyMasterdataChangesFunction = DefineFunction({
  callback_id: "masterdata_apply_changes",
  title: "Stammdatenänderungen speichern",
  description:
    "Speichert zuvor freigegebene Stammdatenänderungen über den Masterdata-Service",
  source_file: "src/masterdata/functions/apply_masterdata_changes/mod.ts",
  input_parameters: {
    properties: {
      changes: masterdataChangesProperty,
    },
    required: ["changes"],
  },
  output_parameters: {
    properties: {},
    required: [],
  },
});
