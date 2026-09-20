import { SlackAPIClient } from "deno-slack-api/types.ts";
import {
  whoIsThereFallbackText,
  WhoIsThereItem,
  whoIsThereMergedBlocks,
} from "./blocks.ts";
import WhoIsThereDatastore from "../../datastores/who_is_there.ts";
import { assertOk, today } from "../../../shared/util.ts";

export type QueryDateValidationError = "past" | "exists";

/**
 * Checks whether `date` can be used to start a new "Wer ist da?" query:
 * rejects dates in the past and dates that already have an active query.
 */
export async function validateQueryDate(
  client: SlackAPIClient,
  date: string,
): Promise<QueryDateValidationError | undefined> {
  if (date < today()) return "past";

  const datastoreGetResponse = await client.apps.datastore.get({
    datastore: WhoIsThereDatastore.name,
    id: date,
  });

  if (datastoreGetResponse.ok && datastoreGetResponse.item.date) {
    return "exists";
  }

  return undefined;
}

/**
 * Posts `date` into the shared "Wer ist da?" message for `channel`: tears
 * down the old shared message (if any) and completes its execution, then
 * posts a freshly merged message covering every still-active date plus the
 * new one, and persists the resulting state. Assumes `date` has already
 * been validated via `validateQueryDate`.
 */
export async function postOrMergeQuery(
  client: SlackAPIClient,
  { date, user, channel, executionId }: {
    date: string;
    user: string;
    channel: string;
    executionId: string;
  },
): Promise<void> {
  const activeItemsResponse = assertOk(
    await client.apps.datastore.query<typeof WhoIsThereDatastore.definition>({
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
    { date, requested_by: user, votes: [] },
  ];

  const blocks = whoIsThereMergedBlocks(allItems);

  // do not assert here since old message already deleted
  const msgResponse = await client.chat.postMessage({
    channel,
    blocks,
    // Fallback text to use when rich media can't be displayed (i.e. notifications) as well as for screen readers
    text: whoIsThereFallbackText(allItems),
  });

  // persist the new shared message state on every active date
  for (const item of allItems) {
    if (item.date === date) {
      await client.apps.datastore.put({
        datastore: WhoIsThereDatastore.name,
        item: {
          date: item.date,
          message_ts: msgResponse.ts,
          channel_id: channel,
          requested_by: item.requested_by,
          votes: item.votes,
          execution_id: executionId,
        },
      });
      continue;
    }

    await client.apps.datastore.update({
      datastore: WhoIsThereDatastore.name,
      item: {
        date: item.date,
        message_ts: msgResponse.ts,
        channel_id: channel,
        execution_id: executionId,
      },
    });
  }
}
