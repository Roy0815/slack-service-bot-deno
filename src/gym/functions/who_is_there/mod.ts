import { WhoIsThereFunction } from "./definition.ts";
import { SlackFunction } from "deno-slack-sdk/mod.ts";
import { handleWhoIsThereAction, whoIsThereBlockActionIds } from "./actions.ts";
import { postOrMergeQuery, validateQueryDate } from "./controller.ts";
import { assertOk, formatSlackDate } from "../../../shared/util.ts";

/**
 * Custom function that sends a message to the gym channel asking who is
 * there on a given day. All active dates share a single message per channel;
 * see controller.ts for how dates get merged into it.
 */
export default SlackFunction(
  WhoIsThereFunction,
  async ({ inputs, client, event }) => {
    const validationError = await validateQueryDate(client, inputs.date);

    if (validationError) {
      assertOk(
        await client.chat.postEphemeral({
          channel: inputs.channel,
          user: inputs.user,
          text: validationError === "past"
            ? `Das Datum ${
              formatSlackDate(inputs.date)
            } liegt in der Vergangenheit`
            : `Es gibt bereits eine Abfrage für den ${
              formatSlackDate(inputs.date)
            }`,
        }),
        "WhoIsThereFunction - Error sending ephemeral message",
      );

      return { outputs: {} };
    }

    await postOrMergeQuery(client, {
      date: inputs.date,
      user: inputs.user,
      channel: inputs.channel,
      executionId: event.function_execution_id,
    });

    // IMPORTANT! Set `completed` to false in order to keep the interactivity
    // points (buttons) "alive"
    return {
      completed: false,
    };
  },
  // shared actions handler for buttons/timepicker - see actions.ts
).addBlockActionsHandler(whoIsThereBlockActionIds, handleWhoIsThereAction);
