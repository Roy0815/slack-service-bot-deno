import { WhoIsThereFunction } from "./definition.ts";
import { SlackFunction } from "deno-slack-sdk/mod.ts";
import {
  whoIsThereFallbackText,
  WhoIsThereItem,
  whoIsThereMergedBlocks,
} from "./blocks.ts";
import { handleWhoIsThereAction, whoIsThereBlockActionIds } from "./actions.ts";
import WhoIsThereDatastore from "../../datastores/who_is_there.ts";
import { assertOk, formatSlackDate, today } from "../../../shared/util.ts";

/**
 * Custom function that sends a message to the gym channel asking who is
 * there on a given day. All active dates share a single message per channel:
 * posting a new date deletes the old shared message, ends its function
 * execution and posts a new merged message covering every active date.
 */
export default SlackFunction(
  WhoIsThereFunction,
  async ({ inputs, client, event }) => {
    if (inputs.date < today()) {
      assertOk(
        await client.chat.postEphemeral({
          channel: inputs.channel,
          user: inputs.user,
          text: `Das Datum ${
            formatSlackDate(inputs.date)
          } liegt in der Vergangenheit`,
        }),
        "WhoIsThereFunction - Error sending ephemeral message",
      );

      return { outputs: {} };
    }

    // check if a message for this date already exists in the datastore
    const datastoreGetResponse = await client.apps.datastore.get({
      datastore: WhoIsThereDatastore.name,
      id: inputs.date,
    });

    if (datastoreGetResponse.ok && datastoreGetResponse.item.date) {
      assertOk(
        await client.chat.postEphemeral({
          channel: inputs.channel,
          user: inputs.user,
          text: `Es gibt bereits eine Abfrage für den ${
            formatSlackDate(inputs.date)
          }`,
        }),
        "WhoIsThereFunction - Error sending ephemeral message",
      );

      return { outputs: {} };
    }

    // fetch every currently active date - they all share the same message
    const activeItemsResponse = assertOk(
      await client.apps.datastore.query<
        typeof WhoIsThereDatastore.definition
      >({
        datastore: WhoIsThereDatastore.name,
      }),
      "WhoIsThereFunction - Error querying datastore",
    );

    const existingItems = activeItemsResponse.items;

    // tear down the old shared message (if any) and end its execution, since
    // only one "Wer ist da?" message should exist in the channel at a time
    if (existingItems.length > 0) {
      const { channel_id, message_ts, execution_id } = existingItems[0];

      assertOk(
        await client.chat.delete({ channel: channel_id, ts: message_ts }),
        "WhoIsThereFunction - Error deleting old message",
      );

      if (execution_id) {
        // do not assert here since old message already deleted
        await client.functions.completeSuccess({
          function_execution_id: execution_id,
          outputs: {},
        });
      }
    }

    // merge the new date with the still-active ones into a single message
    const allItems: WhoIsThereItem[] = [
      ...existingItems.map((item) => ({
        date: item.date,
        requested_by: item.requested_by,
        votes: item.votes || [],
      })),
      { date: inputs.date, requested_by: inputs.user, votes: [] },
    ];

    const blocks = whoIsThereMergedBlocks(allItems);

    // do not assert here since old message already deleted
    const msgResponse = await client.chat.postMessage({
      channel: inputs.channel,
      blocks,
      // Fallback text to use when rich media can't be displayed (i.e. notifications) as well as for screen readers
      text: whoIsThereFallbackText(allItems),
    });

    // persist the new shared message state on every active date
    for (const item of allItems) {
      if (item.date === inputs.date) {
        await client.apps.datastore.put({
          datastore: WhoIsThereDatastore.name,
          item: {
            date: item.date,
            message_ts: msgResponse.ts,
            channel_id: inputs.channel,
            requested_by: item.requested_by,
            votes: item.votes,
            execution_id: event.function_execution_id,
          },
        });
        continue;
      }

      await client.apps.datastore.update({
        datastore: WhoIsThereDatastore.name,
        item: {
          date: item.date,
          message_ts: msgResponse.ts,
          channel_id: inputs.channel,
          execution_id: event.function_execution_id,
        },
      });
    }

    // IMPORTANT! Set `completed` to false in order to keep the interactivity
    // points (buttons) "alive"
    return {
      completed: false,
    };
  },
  // shared actions handler for buttons/timepicker - see actions.ts
).addBlockActionsHandler(whoIsThereBlockActionIds, handleWhoIsThereAction);
