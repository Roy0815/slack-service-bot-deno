import { DefineDatastore, Schema } from "deno-slack-sdk/mod.ts";

/**
 * One saved set of personal data per Slack user for the coaching contract,
 * so a coach only ever types their name, address and email once.
 *
 * `user_id` is the primary key, so saving again simply overwrites - there
 * is deliberately no way to have more than one preset per person.
 * https://api.slack.com/automation/datastores
 */
const CoachingPresetsDatastore = DefineDatastore({
  name: "CoachingContractPresets",
  primary_key: "user_id",
  attributes: {
    user_id: {
      type: Schema.types.string,
    },
    updated_at: {
      type: Schema.types.string,
    },
    // One column per preset field - see PresetFields in
    // src/signatures/coaching_contract.ts
    firstName: {
      type: Schema.types.string,
    },
    lastName: {
      type: Schema.types.string,
    },
    street: {
      type: Schema.types.string,
    },
    cityPostalcode: {
      type: Schema.types.string,
    },
    // Not part of the document fields above, but saved alongside them -
    // see coachEmail in CoachingFormInput in the preset function's blocks.ts
    coachEmail: {
      type: Schema.types.string,
    },
  },
});

export default CoachingPresetsDatastore;
