import { SlackAPIClient } from "deno-slack-api/types.ts";
import { ActionIds, BlockIds } from "./constants.ts";
import { WhoIsThereItem, whoIsThereMergedBlocks } from "./blocks.ts";
import WhoIsThereDatastore from "../../datastores/who_is_there.ts";
import { assertOk } from "../../../shared/util.ts";

export const whoIsThereBlockActionIds: string[] = [
  ActionIds.submitAvailability,
  ActionIds.deleteMyAvailability,
  ActionIds.creatorDeleteMessage,
];

/**
 * Shared block-actions handler for the "Wer ist da?" buttons/timepicker.
 * All active dates live in a single shared message, and whichever function
 * (WhoIsThereFunction or WhoIsThereDeleteFunction) currently keeps that
 * message's execution open handles its interactions the same way - the date
 * is resolved from the block_id, not from the owning function's inputs.
 *
 * Failures here only throw (visible via `slack activity --tail`) and never
 * complete/fail the execution: this execution owns interactivity for every
 * active date in the shared message, so forcing it to end over one failed
 * sub-action would break the other, already-working dates too.
 */
export async function handleWhoIsThereAction(
  // deno-lint-ignore no-explicit-any
  { action, body, client }: { action: any; body: any; client: SlackAPIClient },
) {
  const date = BlockIds.dateFromActionsBlock(action.block_id ?? "");

  // Creator deletes just this date's query. If it was the last active
  // date, the whole shared message is removed and the execution ends.
  if (action.action_id === ActionIds.creatorDeleteMessage) {
    assertOk(
      await client.apps.datastore.delete({
        datastore: WhoIsThereDatastore.name,
        id: date,
      }),
      "WhoIsThereFunction - Error deleting from datastore",
    );

    const remainingResponse = assertOk(
      await client.apps.datastore.query<
        typeof WhoIsThereDatastore.definition
      >({
        datastore: WhoIsThereDatastore.name,
      }),
      "WhoIsThereFunction - Error querying datastore",
    );

    if (remainingResponse.items.length === 0) {
      assertOk(
        await client.functions.completeSuccess({
          function_execution_id: body.function_data.execution_id,
          outputs: {},
        }),
        "WhoIsThereFunction - Error completing execution",
      );

      assertOk(
        await client.chat.delete({
          channel: body.container.channel_id,
          ts: body.container.message_ts,
        }),
        "WhoIsThereFunction - Error deleting message",
      );

      return;
    }

    const remainingItems: WhoIsThereItem[] = remainingResponse.items.map(
      (item) => ({
        date: item.date,
        requested_by: item.requested_by,
        votes: item.votes || [],
      }),
    );

    assertOk(
      await client.chat.update({
        channel: body.container.channel_id,
        ts: body.container.message_ts,
        blocks: whoIsThereMergedBlocks(remainingItems),
      }),
      "WhoIsThereFunction - Error updating message",
    );

    return;
  }

  // get current votes from datastore
  const datastoreResponse = assertOk(
    await client.apps.datastore.get({
      datastore: WhoIsThereDatastore.name,
      id: date,
    }),
    "WhoIsThereFunction - Error reading from datastore",
  );

  // update vote of current user
  const votes = datastoreResponse.item.votes || [];
  const selectedTime =
    body.state.values[BlockIds.inputBlock(date)][ActionIds.timePicker]
      .selected_time;

  const existingVoteIndex = votes.findIndex((
    vote: { user_id: string; time: string },
  ) => vote.user_id === body.user.id);

  // vote does exists and action is delete
  if (
    existingVoteIndex !== -1 &&
    action.action_id === ActionIds.deleteMyAvailability
  ) {
    // delete this users vote
    votes.splice(existingVoteIndex, 1);

    // vote does exists and action is submit
  } else if (existingVoteIndex !== -1) {
    // modify this users vote
    votes[existingVoteIndex] = {
      user_id: body.user.id,
      time: selectedTime,
    };

    // vote does not exists and action is submit
  } else if (
    existingVoteIndex === -1 &&
    action.action_id === ActionIds.submitAvailability
  ) {
    // add this users vote
    votes.push({ user_id: body.user.id, time: selectedTime });
  }

  votes.sort((
    a: { user_id: string; time: string },
    b: { user_id: string; time: string },
  ) => a.time.localeCompare(b.time));

  // update datastore with new votes
  assertOk(
    await client.apps.datastore.update({
      datastore: WhoIsThereDatastore.name,
      item: {
        date,
        votes,
      },
    }),
    "WhoIsThereFunction - Error updating datastore",
  );

  // rebuild the full merged message, since it may contain other dates too
  const allItemsResponse = assertOk(
    await client.apps.datastore.query<typeof WhoIsThereDatastore.definition>({
      datastore: WhoIsThereDatastore.name,
    }),
    "WhoIsThereFunction - Error querying datastore",
  );

  const allItems: WhoIsThereItem[] = allItemsResponse.items.map((item) => ({
    date: item.date,
    requested_by: item.requested_by,
    votes: item.votes || [],
  }));

  assertOk(
    await client.chat.update({
      channel: body.container.channel_id,
      ts: body.container.message_ts,
      blocks: whoIsThereMergedBlocks(allItems),
    }),
    "WhoIsThereFunction - Error updating message",
  );
}
