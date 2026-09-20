import { assertEquals } from "@std/assert";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import { stubFetch } from "../../../shared/testing/fetch_stub.ts";
import { WhoIsThereStartFunction } from "./definition.ts";
import { ActionIds, BlockIds } from "./views.ts";
import handlerModule from "./mod.ts";

const { createContext } = SlackFunctionTester(WhoIsThereStartFunction);

// `viewSubmission` is attached at runtime (see deno-slack-sdk's
// slack-function.ts) but isn't part of the exported handler's TS type.
const handler = handlerModule as unknown as {
  (ctx: ReturnType<typeof createContext>): Promise<{ completed?: boolean }>;
  // deno-lint-ignore no-explicit-any
  viewSubmission: (ctx: any) => Promise<any>;
};

const baseInputs = {
  channel: "C123",
  interactivity: {
    interactivity_pointer: "trigger-1",
    interactor: { id: "U_REQUESTER", secret: "s" },
  },
};

Deno.test("main handler opens a popup for the given channel and stays open", async () => {
  const stub = stubFetch({
    responses: { "views.open": { ok: true, view: { id: "V1" } } },
  });

  try {
    const context = createContext({ inputs: baseInputs });
    const result = await handler(context);

    assertEquals(result.completed, false);

    const openCall = stub.calls.find((call) => call.url.includes("views.open"));
    // deno-lint-ignore no-explicit-any
    const view = (openCall?.body as any).view;
    assertEquals(view.blocks[0].text.text.includes("<#C123>"), true);
  } finally {
    stub.restore();
  }
});

/**
 * Builds a minimal view_submission context, since SlackFunctionTester's
 * createContext models a plain function_executed event, not interactivity
 * payloads - see view_router.ts, which only needs body/view/env/client.
 */
function viewSubmissionContext(date: string) {
  return {
    env: {},
    view: {
      callback_id: "who_is_there_start_modal",
      state: {
        values: {
          [BlockIds.date]: { [ActionIds.date]: { selected_date: date } },
        },
      },
    },
    body: {
      type: "view_submission",
      user: { id: "U_REQUESTER" },
      function_data: {
        execution_id: "fx1",
        inputs: baseInputs,
        function: { callback_id: "gym_who_is_there_start" },
      },
      interactivity: {
        interactor: { id: "U_REQUESTER", secret: "s" },
        interactivity_pointer: "trigger-2",
      },
    },
  };
}

Deno.test("view submission completes the execution with the picked date and channel", async () => {
  const stub = stubFetch({
    responses: {
      "apps.datastore.get": { ok: true, item: {} },
      "functions.completeSuccess": { ok: true },
    },
  });

  try {
    const result = await handler.viewSubmission(
      viewSubmissionContext("2099-01-01"),
    );

    assertEquals(result, {});

    const completeCall = stub.calls.find((call) =>
      call.url.includes("functions.completeSuccess")
    );
    assertEquals(completeCall !== undefined, true);
  } finally {
    stub.restore();
  }
});

Deno.test("view submission returns an inline error for a past date instead of completing", async () => {
  const stub = stubFetch({
    responses: { "apps.datastore.get": { ok: true, item: {} } },
  });

  try {
    const result = await handler.viewSubmission(
      viewSubmissionContext("2020-01-01"),
    );

    assertEquals(result.response_action, "errors");
    const completeCall = stub.calls.find((call) =>
      call.url.includes("functions.completeSuccess")
    );
    assertEquals(completeCall, undefined);
  } finally {
    stub.restore();
  }
});
