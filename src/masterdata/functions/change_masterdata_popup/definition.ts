import { DefineFunction, Schema } from "deno-slack-sdk/mod.ts";
import { masterdataChangesProperties } from "../../../shared/masterdata/schema.ts";

/**
 * Custom function that opens a popup for a user to edit their own
 * masterdata (prefilled with their current values, loaded asynchronously
 * after the popup opens so the trigger_id doesn't expire), validates the
 * input, and returns the diff plus ready-to-send notification texts.
 * Neither posts messages nor saves anything itself - see the Approver
 * function and ApplyMasterdataChangesFunction for those steps.
 */
export const ChangeMasterdataPopupFunction = DefineFunction({
  callback_id: "masterdata_change_popup",
  title: "Stammdaten ändern",
  description:
    "Öffnet ein Popup zum Ändern der eigenen Stammdaten und bereitet die Freigabe-Anfrage vor",
  source_file: "src/masterdata/functions/change_masterdata_popup/mod.ts",
  input_parameters: {
    properties: {
      interactivity: {
        type: Schema.slack.types.interactivity,
        title: "Interaktivität",
        description: "Interactivity-Kontext zum Öffnen des Popups",
      },
    },
    required: ["interactivity"],
  },
  output_parameters: {
    properties: {
      ...masterdataChangesProperties,
      userNotificationText: {
        type: Schema.types.string,
        title: "Nachricht an Mitglied",
        description: "Nachricht an den anfragenden User",
      },
      approverNotificationText: {
        type: Schema.types.string,
        title: "Nachricht zur Freigabe",
        description: "Nachricht für den Freigabe-Channel",
      },
    },
    required: ["slackId", "userNotificationText", "approverNotificationText"],
  },
});
