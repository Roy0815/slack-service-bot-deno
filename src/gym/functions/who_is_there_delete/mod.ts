import { WhoIsThereDeleteFunction } from "./definition.ts";
import { SlackFunction } from "deno-slack-sdk/mod.ts";
import WhoIsThereDatastore from "../../datastores/who_is_there.ts";
import {
  WhoIsThereItem,
  whoIsThereMergedBlocks,
} from "../who_is_there/blocks.ts";
import { assertOk, today } from "../../../shared/util.ts";

/**
 * Custom function that removes outdated "Wer ist da?" requests (older than
 * today) from the shared message. The message is only ever updated in
 * place - never deleted + reposted - so its original function execution
 * keeps owning interactivity for the remaining dates. Only when no dates
 * are left does the message get deleted and its execution ended.
 */
export default SlackFunction(
  WhoIsThereDeleteFunction,
  async ({ client }) => {
    const allItemsResponse = assertOk(
      await client.apps.datastore.query<
        typeof WhoIsThereDatastore.definition
      >({
        datastore: WhoIsThereDatastore.name,
      }),
      "WhoIsThereDeleteFunction - Error querying datastore",
    );

    const todayDate = today();
    const outdatedItems = allItemsResponse.items.filter((item) =>
      item.date < todayDate
    );

    if (outdatedItems.length === 0) {
      return { outputs: {} };
    }

    const { channel_id, message_ts, execution_id } = allItemsResponse.items[0];

    for (const item of outdatedItems) {
      assertOk(
        await client.apps.datastore.delete({
          datastore: WhoIsThereDatastore.name,
          id: item.date,
        }),
        "WhoIsThereDeleteFunction - Error deleting from datastore",
      );
    }

    const remainingItems: WhoIsThereItem[] = allItemsResponse.items
      .filter((item) => item.date >= todayDate)
      .map((item) => ({
        date: item.date,
        requested_by: item.requested_by,
        votes: item.votes || [],
      }));

    if (remainingItems.length === 0) {
      // nothing left to show: remove the message and end its execution
      if (execution_id) {
        assertOk(
          await client.functions.completeSuccess({
            function_execution_id: execution_id,
            outputs: {},
          }),
          "WhoIsThereDeleteFunction - Error completing execution",
        );
      }

      assertOk(
        await client.chat.delete({ channel: channel_id, ts: message_ts }),
        "WhoIsThereDeleteFunction - Error deleting message",
      );

      return { outputs: {} };
    }

    // update the existing message in place; chat.update does not transfer
    // interactivity ownership, so the original execution keeps handling it
    assertOk(
      await client.chat.update({
        channel: channel_id,
        ts: message_ts,
        blocks: whoIsThereMergedBlocks(remainingItems),
      }),
      "WhoIsThereDeleteFunction - Error updating message",
    );

    return { outputs: {} };
  },
);
