import { Schema } from "deno-slack-sdk/mod.ts";

/**
 * Slack function parameter definition for an ApprovalObject-shaped
 * masterdata change set (new values only - old values are only needed to
 * build the notification texts, which happens inline where the diff is
 * computed, so they don't need to travel through this parameter). Shared
 * between ChangeMasterdataPopupFunction (which produces it) and
 * ApplyMasterdataChangesFunction (which consumes it), so both stay in sync.
 *
 * Nesting objects inside object properties (e.g. a per-field {old, new}
 * value) fails Slack's manifest schema validation ("failed to match
 * exactly one allowed schema for properties/x") even though the SDK's own
 * TypeScript types allow it - keep this flat.
 */
export const masterdataChangesProperty = {
  type: Schema.types.object,
  description: "Geänderte Felder mit neuem Wert",
  properties: {
    slackId: { type: Schema.slack.types.user_id },
    firstname: { type: Schema.types.string },
    lastname: { type: Schema.types.string },
    email: { type: Schema.types.string },
    phone: { type: Schema.types.string },
    street: { type: Schema.types.string },
    houseNumber: { type: Schema.types.string },
    city: { type: Schema.types.string },
    zip: { type: Schema.types.string },
  },
  required: ["slackId"],
} as const;
