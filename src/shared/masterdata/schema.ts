import { Schema } from "deno-slack-sdk/mod.ts";

/**
 * Slack function parameter definitions for an ApprovalObject-shaped
 * masterdata change set (new values only - old values are only needed to
 * build the notification texts, which happens inline where the diff is
 * computed, so they don't need to travel through these parameters). Shared
 * between ChangeMasterdataPopupFunction (outputs) and
 * ApplyMasterdataChangesFunction (inputs), so both stay in sync.
 *
 * Deliberately separate top-level parameters instead of one object
 * parameter: Workflow Builder can't fill object-typed inputs of custom
 * functions, so an object would leave the apply step unconfigurable.
 * Unchanged fields are left out / empty.
 */
export const masterdataChangesProperties = {
  slackId: {
    type: Schema.slack.types.user_id,
    title: "Mitglied",
    description: "Mitglied, dessen Stammdaten geändert werden",
  },
  firstname: { type: Schema.types.string, title: "Neuer Vorname" },
  lastname: { type: Schema.types.string, title: "Neuer Nachname" },
  email: { type: Schema.types.string, title: "Neue Email" },
  phone: { type: Schema.types.string, title: "Neue Telefonnummer" },
  street: { type: Schema.types.string, title: "Neue Straße" },
  houseNumber: { type: Schema.types.string, title: "Neue Hausnummer" },
  city: { type: Schema.types.string, title: "Neuer Ort" },
  zip: { type: Schema.types.string, title: "Neue PLZ" },
} as const;
