import { assertEquals, assertThrows } from "@std/assert";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import { stubFetch } from "../../testing/fetch_stub.ts";
import { ApproverFunction } from "./definition.ts";
import { ApproverActionIds } from "./blocks.ts";
import { rejectReasonViewCallbackId } from "./views.ts";
import handlerModule, { threadTsFromLink } from "./mod.ts";

const { createContext } = SlackFunctionTester(ApproverFunction);

const handler = handlerModule as unknown as {
  (ctx: ReturnType<typeof createContext>): Promise<{ completed?: boolean }>;
  // deno-lint-ignore no-explicit-any
  blockActions: (ctx: any) => Promise<any>;
  // deno-lint-ignore no-explicit-any
  viewSubmission: (ctx: any) => Promise<any>;
};

// Schema.slack.types.expanded_rich_text delivers an array with a block of
// type `expanded_rich_text` at runtime, not a plain string - this is what
// `inputs.text` and `originalText` actually look like.
const richText = [{
  type: "expanded_rich_text",
  elements: [
    {
      type: "rich_text_section",
      elements: [{ type: "text", text: "Please review" }],
    },
  ],
}];

// what chat.postMessage accepts
const postedRichText = { ...richText[0], type: "rich_text" };

const baseInputs = { approverChannel: "C_APPROVERS", text: richText };

const approvalLink = "https://example.slack.com/archives/C_APPROVERS/p11";

function blockActionsContext(
  actionId: string,
  inputs: Record<string, unknown> = baseInputs,
) {
  return {
    env: {},
    // the Freigeben button carries the approval message's link
    action: {
      action_id: actionId,
      ...(actionId === ApproverActionIds.approve
        ? { value: approvalLink }
        : {}),
    },
    body: {
      trigger_id: "Ft1",
      interactivity: { interactivity_pointer: "pointer-1" },
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

const postResponses = {
  "chat.postMessage": { ok: true, ts: "1.1" },
  "chat.getPermalink": { ok: true, permalink: approvalLink },
  "chat.update": { ok: true },
};

Deno.test("main handler posts the approval message and stays open", async () => {
  const stub = stubFetch({ responses: postResponses });

  try {
    const result = await handler(createContext({ inputs: baseInputs }));
    assertEquals(result.completed, false);

    const postCall = stub.calls.find((call) =>
      call.url.includes("chat.postMessage")
    );
    // deno-lint-ignore no-explicit-any
    const body = postCall?.body as any;
    assertEquals(body.blocks[0], postedRichText);
    assertEquals(
      body.blocks[1].elements.map((e: { action_id: string }) => e.action_id),
      [ApproverActionIds.approve, ApproverActionIds.reject],
    );
  } finally {
    stub.restore();
  }
});

Deno.test("main handler stores the message's link in the Freigeben button", async () => {
  const stub = stubFetch({ responses: postResponses });

  try {
    await handler(createContext({ inputs: baseInputs }));

    const updateCall = stub.calls.find((call) =>
      call.url.includes("chat.update")
    );
    // deno-lint-ignore no-explicit-any
    const body = updateCall?.body as any;
    assertEquals(String(body.ts), "1.1");
    assertEquals(body.blocks[1].elements[0].value, approvalLink);
  } finally {
    stub.restore();
  }
});

Deno.test("main handler keeps the request without a link when the permalink can't be fetched", async () => {
  const stub = stubFetch({
    responses: {
      ...postResponses,
      "chat.getPermalink": { ok: false, error: "message_not_found" },
    },
  });
  const originalError = console.error;
  console.error = () => {};

  try {
    const result = await handler(createContext({ inputs: baseInputs }));

    assertEquals(result.completed, false);
    assertEquals(
      stub.calls.some((call) => call.url.includes("chat.update")),
      false,
    );
  } finally {
    console.error = originalError;
    stub.restore();
  }
});

const threadMessageLink =
  "https://example.slack.com/archives/C_APPROVERS/p1793448876123456";

Deno.test("main handler posts the request as a thread reply broadcast to the channel when a thread message link is given", async () => {
  const stub = stubFetch({ responses: postResponses });

  try {
    await handler(
      createContext({ inputs: { ...baseInputs, threadMessageLink } }),
    );

    const postCall = stub.calls.find((call) =>
      call.url.includes("chat.postMessage")
    );
    // deno-lint-ignore no-explicit-any
    const body = postCall?.body as any;
    assertEquals(String(body.thread_ts), "1793448876.123456");
    assertEquals(String(body.reply_broadcast), "true");
  } finally {
    stub.restore();
  }
});

Deno.test("approve resolves immediately: updates the message and completes with the approver and the approval message", async () => {
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
    assertEquals((completeCall?.body as any).outputs, {
      approver: "U_APPROVER",
      approvalMessage: { channel_id: "C_APPROVERS", message_ts: "1.1" },
      approvalMessageLink: approvalLink,
      approvalMessageTs: "1.1",
    });
    // nothing delays the completion
    assertEquals(
      stub.calls.findIndex((call) =>
        call.url.includes("functions.completeSuccess")
      ),
      0,
    );
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

    const openCall = stub.calls.find((call) => call.url.includes("views.open"));
    // deno-lint-ignore no-explicit-any
    assertEquals((openCall?.body as any)?.interactivity_pointer, "pointer-1");
    assertEquals(
      stub.calls.some((call) => call.url.includes("functions.completeSuccess")),
      false,
    );
  } finally {
    stub.restore();
  }
});

function rejectSubmissionContext(inputs: Record<string, unknown>) {
  return {
    env: {},
    view: {
      callback_id: rejectReasonViewCallbackId,
      private_metadata: JSON.stringify({ channel: "C_APPROVERS", ts: "1.1" }),
      state: {
        values: { reason_block: { reason_input: { value: "Not now" } } },
      },
    },
    body: {
      type: "view_submission",
      user: { id: "U_APPROVER" },
      function_data: {
        execution_id: "fx1",
        inputs,
        function: { callback_id: "shared_approver" },
      },
    },
  };
}

Deno.test("submitting the reject-reason popup DMs the requester and ends the step with an error", async () => {
  const stub = stubFetch({
    responses: {
      "chat.update": { ok: true },
      "chat.postMessage": { ok: true },
      "functions.completeError": { ok: true },
    },
  });

  try {
    const result = await handler.viewSubmission(
      rejectSubmissionContext({ ...baseInputs, requester: "U_MEMBER" }),
    );

    assertEquals(result, {});

    const dmCall = stub.calls.find((call) =>
      call.url.includes("chat.postMessage")
    );
    // deno-lint-ignore no-explicit-any
    const dmBody = dmCall?.body as any;
    assertEquals(dmBody.channel, "U_MEMBER");
    assertEquals(
      dmBody.blocks[0].text.text,
      "Deine Anfrage wurde von <@U_APPROVER> abgelehnt.\nGrund: Not now",
    );
    assertEquals(dmBody.blocks[1], {
      type: "context",
      elements: [{ type: "mrkdwn", text: "Please review" }],
    });

    // completing decides between concurrent clicks, so it comes first
    const callOrder = stub.calls.map((call) => call.url.split("/").pop());
    assertEquals(callOrder[0], "functions.completeError");
    assertEquals(
      callOrder.indexOf("chat.postMessage") < callOrder.indexOf("chat.update"),
      true,
    );

    const errorCall = stub.calls.find((call) =>
      call.url.includes("functions.completeError")
    );
    assertEquals(
      // deno-lint-ignore no-explicit-any
      (errorCall?.body as any).error,
      "Anfrage abgelehnt von <@U_APPROVER>. Grund: Not now",
    );
    assertEquals(
      stub.calls.some((call) => call.url.includes("functions.completeSuccess")),
      false,
    );
  } finally {
    stub.restore();
  }
});

Deno.test("a rejection without requester sends no DM but still ends the step with an error", async () => {
  const stub = stubFetch({
    responses: {
      "chat.update": { ok: true },
      "functions.completeError": { ok: true },
    },
  });

  try {
    await handler.viewSubmission(rejectSubmissionContext(baseInputs));

    assertEquals(
      stub.calls.some((call) => call.url.includes("chat.postMessage")),
      false,
    );
    assertEquals(
      stub.calls.some((call) => call.url.includes("functions.completeError")),
      true,
    );
  } finally {
    stub.restore();
  }
});

Deno.test("a failed DM posts a note in the thread and still ends the step with an error", async () => {
  const stub = stubFetch({
    responses: {
      "chat.update": { ok: true },
      // first the DM fails, then the thread note goes through
      "chat.postMessage": [
        { ok: false, error: "channel_not_found" },
        { ok: true },
      ],
      "functions.completeError": { ok: true },
    },
  });
  const originalError = console.error;
  console.error = () => {};

  try {
    await handler.viewSubmission(
      rejectSubmissionContext({ ...baseInputs, requester: "U_MEMBER" }),
    );

    const postCalls = stub.calls.filter((call) =>
      call.url.includes("chat.postMessage")
    );
    assertEquals(postCalls.length, 2);
    // deno-lint-ignore no-explicit-any
    const noteBody = postCalls[1].body as any;
    assertEquals(noteBody.channel, "C_APPROVERS");
    assertEquals(String(noteBody.thread_ts), "1.1");
    assertEquals(String(noteBody.reply_broadcast), "true");
    assertEquals(noteBody.text.includes("<@U_MEMBER>"), true);

    assertEquals(
      stub.calls.some((call) => call.url.includes("functions.completeError")),
      true,
    );
  } finally {
    console.error = originalError;
    stub.restore();
  }
});

Deno.test("a failed DM for a request posted as a thread reply notes it in that thread", async () => {
  const stub = stubFetch({
    responses: {
      "chat.update": { ok: true },
      "chat.postMessage": [
        { ok: false, error: "channel_not_found" },
        { ok: true },
      ],
      "functions.completeError": { ok: true },
    },
  });
  const originalError = console.error;
  console.error = () => {};

  try {
    const context = rejectSubmissionContext({
      ...baseInputs,
      requester: "U_MEMBER",
      threadMessageLink,
    });
    context.view.private_metadata = JSON.stringify({
      channel: "C_APPROVERS",
      ts: "1.1",
      threadTs: "1793448876.123456",
    });
    await handler.viewSubmission(context);

    const postCalls = stub.calls.filter((call) =>
      call.url.includes("chat.postMessage")
    );
    assertEquals(
      // deno-lint-ignore no-explicit-any
      String((postCalls[1].body as any).thread_ts),
      "1793448876.123456",
    );
  } finally {
    console.error = originalError;
    stub.restore();
  }
});

Deno.test("a late approve click only tells the clicker it was already decided", async () => {
  const stub = stubFetch({
    responses: {
      "functions.completeSuccess": { ok: false, error: "already_completed" },
      "chat.postEphemeral": { ok: true },
    },
  });
  const originalLog = console.log;
  console.log = () => {};

  try {
    await handler.blockActions(blockActionsContext(ApproverActionIds.approve));

    const ephemeralCall = stub.calls.find((call) =>
      call.url.includes("chat.postEphemeral")
    );
    // deno-lint-ignore no-explicit-any
    assertEquals((ephemeralCall?.body as any).user, "U_APPROVER");
    assertEquals(
      stub.calls.some((call) => call.url.includes("chat.update")),
      false,
    );
  } finally {
    console.log = originalLog;
    stub.restore();
  }
});

Deno.test("a late rejection shows an error in the popup and sends no DM", async () => {
  const stub = stubFetch({
    responses: {
      "functions.completeError": { ok: false, error: "already_completed" },
    },
  });
  const originalLog = console.log;
  console.log = () => {};

  try {
    const result = await handler.viewSubmission(
      rejectSubmissionContext({ ...baseInputs, requester: "U_MEMBER" }),
    );

    assertEquals(result.response_action, "errors");
    assertEquals(typeof result.errors.reason_block, "string");
    assertEquals(
      stub.calls.some((call) =>
        call.url.includes("chat.postMessage") ||
        call.url.includes("chat.update")
      ),
      false,
    );
  } finally {
    console.log = originalLog;
    stub.restore();
  }
});

Deno.test("main handler ends the step with a readable error when posting fails", async () => {
  const stub = stubFetch({
    responses: {
      "chat.postMessage": { ok: false, error: "invalid_blocks" },
    },
  });

  try {
    const result = await handler(createContext({ inputs: baseInputs }));
    assertEquals(
      "error" in result ? result.error : undefined,
      "ApproverFunction - Error posting approval message: invalid_blocks",
    );
  } finally {
    stub.restore();
  }
});

Deno.test("threadTsFromLink reads the timestamp from a message link", () => {
  assertEquals(
    threadTsFromLink(threadMessageLink, "C_APPROVERS"),
    "1793448876.123456",
  );
  assertEquals(threadTsFromLink(undefined, "C_APPROVERS"), undefined);
});

Deno.test("threadTsFromLink rejects anything but a link to a message in the approval channel", () => {
  assertThrows(() => threadTsFromLink("1793448876", "C_APPROVERS"));
  assertThrows(
    () => threadTsFromLink(threadMessageLink, "C_OTHER"),
    Error,
    "Freigabe-Channel",
  );
});
