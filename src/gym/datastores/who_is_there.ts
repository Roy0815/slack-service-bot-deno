import { DefineDatastore, Schema } from "deno-slack-sdk/mod.ts";

/**
 * Datastores are a Slack-hosted location to store
 * and retrieve data for your app.
 * https://api.slack.com/automation/datastores
 */
const WhoIsThereDatastore = DefineDatastore({
  name: "WhoIsThere",
  primary_key: "date",
  attributes: {
    date: {
      type: Schema.types.string,
    },
    message_ts: {
      type: Schema.types.string,
    },
    channel_id: {
      type: Schema.types.string,
    },
    requested_by: {
      type: Schema.types.string,
    },
    // ID of the function execution currently keeping the shared message's
    // buttons interactive; empty once no execution is listening anymore.
    execution_id: {
      type: Schema.types.string,
    },
    votes: {
      type: Schema.types.array,
      items: {
        type: Schema.types.object,
        properties: {
          user_id: {
            type: Schema.types.string,
          },
          time: {
            type: Schema.types.string,
          },
        },
      },
    },
  },
});

export default WhoIsThereDatastore;
