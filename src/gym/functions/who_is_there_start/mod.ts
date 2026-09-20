import { WhoIsThereStartFunction } from "./definition.ts";
import { SlackFunction } from "deno-slack-sdk/mod.ts";
import {
  ActionIds,
  BlockIds,
  whoIsThereStartModal,
  whoIsThereStartViewCallbackId,
} from "./views.ts";
import { validateQueryDate } from "../who_is_there/controller.ts";
import { assertOk, formatSlackDate } from "../../../shared/util.ts";

export default SlackFunction(
  WhoIsThereStartFunction,
  async ({ inputs, client }) => {
    assertOk(
      await client.views.open({
        trigger_id: inputs.interactivity.interactivity_pointer,
        view: whoIsThereStartModal(inputs.channel),
      }),
      "WhoIsThereStartFunction - Error opening popup",
    );

    // keep the execution open until the popup is submitted - the
    // view-submission handler below completes it
    return { completed: false };
  },
).addViewSubmissionHandler(
  whoIsThereStartViewCallbackId,
  async ({ view, body, client }) => {
    const date = view.state.values[BlockIds.date][ActionIds.date]
      .selected_date as string;

    const validationError = await validateQueryDate(client, date);

    if (validationError) {
      return {
        response_action: "errors",
        errors: {
          [BlockIds.date]: validationError === "past"
            ? `Das Datum ${formatSlackDate(date)} liegt in der Vergangenheit`
            : `Es gibt bereits eine Abfrage für den ${formatSlackDate(date)}`,
        },
      };
    }

    assertOk(
      await client.functions.completeSuccess({
        function_execution_id: body.function_data.execution_id,
        outputs: { date, channel: body.function_data.inputs.channel },
      }),
      "WhoIsThereStartFunction - Error completing execution",
    );

    return {};
  },
);
