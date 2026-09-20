import { assertEquals } from "@std/assert";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import { stubFetch } from "../../testing/fetch_stub.ts";
import { ApproverFunction } from "./definition.ts";
import { ApproverActionIds } from "./blocks.ts";
import { rejectReasonViewCallbackId } from "./views.ts";
import handlerModule from "./mod.ts";

const { createContext } = SlackFunctionTester(ApproverFunction);

const handler = handlerModule as unknown as {
  (ctx: ReturnType<typeof createContext>): Promise<{ completed?: boolean }>;
  // deno-lint-ignore no-explicit-any
  blockActions: (ctx: any) => Promise<any>;
  // deno-lint-ignore no-explicit-any
  viewSubmission: (ctx: any) => Promise<any>;
};

// Schema.slack.types.expanded_rich_text delivers a Block Kit `rich_text`
// block at runtime, not a plain string.
const richText = {
  type: "rich_text",
  elements: [
    {
      type: "rich_text_section",
      elements: [{ type: "text", text: "Please review" }],
    },
  ],
};

const baseInputs = { approverChannel: "C_APPROVERS", text: richText };

function blockActionsContext(
  actionId: string,
  inputs: Record<string, unknown> = baseInputs,
) {
  return {
    env: {},
    action: { action_id: actionId },
    body: {
      trigger_id: "trigger-1",
      user: { id: "U_APPROVER" },
      container: { channel_id: "C_APPROVERS", message_ts: "1.1" },
      function_data: {
        execution_id: "fx1",
        inputs,
        function: { callback_id: "shared_approver" },
      },
    },
  };
}

Deno.test("main handler posts the approval message and stays open", async () => {
  const stub = stubFetch({ responses: { "chat.postMessage": { ok: true } } });

  try {
    const result = await handler(createContext({ inputs: baseInputs }));
    assertEquals(result.completed, false);

    const postCall = stub.calls.find((call) =>
      call.url.includes("chat.postMessage")
    );
    // deno-lint-ignore no-explicit-any
    const body = postCall?.body as any;
    assertEquals(body.blocks[0], richText);
    assertEquals(
      body.blocks[1].elements.map((e: { action_id: string }) => e.action_id),
      [ApproverActionIds.approve, ApproverActionIds.reject],
    );
  } finally {
    stub.restore();
  }
});

Deno.test("main handler resolves the attachment file ID to a permalink and links it", async () => {
  const stub = stubFetch({
    responses: {
      "files.info": {
        ok: true,
        file: { id: "F123", permalink: "https://slack.com/files/F123" },
      },
      "chat.postMessage": { ok: true },
    },
  });

  try {
    await handler(
      createContext({ inputs: { ...baseInputs, attachment: "F123" } }),
    );

    const infoCall = stub.calls.find((call) => call.url.includes("files.info"));
    // deno-lint-ignore no-explicit-any
    assertEquals((infoCall?.body as any).file, "F123");

    const postCall = stub.calls.find((call) =>
      call.url.includes("chat.postMessage")
    );
    // deno-lint-ignore no-explicit-any
    const body = postCall?.body as any;
    assertEquals(
      body.blocks[1].text.text.includes("https://slack.com/files/F123"),
      true,
    );
  } finally {
    stub.restore();
  }
});

Deno.test("approve resolves immediately: updates the message and completes with approved: true", async () => {
  const stub = stubFetch({
    responses: {
      "chat.update": { ok: true },
      "functions.completeSuccess": { ok: true },
    },
  });

  try {
    await handler.blockActions(blockActionsContext(ApproverActionIds.approve));

    const completeCall = stub.calls.find((call) =>
      call.url.includes("functions.completeSuccess")
    );
    // deno-lint-ignore no-explicit-any
    assertEquals((completeCall?.body as any).outputs, { approved: true });
    assertEquals(
      stub.calls.some((call) => call.url.includes("views.open")),
      false,
    );
  } finally {
    stub.restore();
  }
});

Deno.test("reject opens a popup for a reason instead of resolving right away", async () => {
  const stub = stubFetch({
    responses: { "views.open": { ok: true, view: { id: "V1" } } },
  });

  try {
    await handler.blockActions(blockActionsContext(ApproverActionIds.reject));

    assertEquals(
      stub.calls.some((call) => call.url.includes("views.open")),
      true,
    );
    assertEquals(
      stub.calls.some((call) => call.url.includes("functions.completeSuccess")),
      false,
    );
  } finally {
    stub.restore();
  }
});

Deno.test("submitting the reject-reason popup resolves with approved: false and the reason", async () => {
  const stub = stubFetch({
    responses: {
      "chat.update": { ok: true },
      "functions.completeSuccess": { ok: true },
    },
  });

  try {
    const result = await handler.viewSubmission({
      env: {},
      view: {
        callback_id: rejectReasonViewCallbackId,
        private_metadata: JSON.stringify({
          channel: "C_APPROVERS",
          ts: "1.1",
        }),
        state: {
          values: { reason_block: { reason_input: { value: "Not now" } } },
        },
      },
      body: {
        type: "view_submission",
        user: { id: "U_APPROVER" },
        function_data: {
          execution_id: "fx1",
          inputs: baseInputs,
          function: { callback_id: "shared_approver" },
        },
      },
    });

    assertEquals(result, {});

    const completeCall = stub.calls.find((call) =>
      call.url.includes("functions.completeSuccess")
    );
    assertEquals(
      // deno-lint-ignore no-explicit-any
      (completeCall?.body as any).outputs,
      { approved: false, reason: "Not now" },
    );
  } finally {
    stub.restore();
  }
});
