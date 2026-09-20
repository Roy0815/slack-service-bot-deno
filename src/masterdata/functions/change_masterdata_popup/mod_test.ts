import { assertEquals } from "@std/assert";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import { stubFetch } from "../../../shared/testing/fetch_stub.ts";
import { createTestGoogleServiceAccountEnv } from "../../../shared/testing/test_google_key.ts";
import { ChangeMasterdataPopupFunction } from "./definition.ts";
import {
  ActionIds,
  BlockIds,
  changeMasterdataViewCallbackId,
} from "./views.ts";
import handlerModule from "./mod.ts";

const { createContext } = SlackFunctionTester(ChangeMasterdataPopupFunction);

const handler = handlerModule as unknown as {
  // deno-lint-ignore no-explicit-any
  (ctx: any): Promise<any>;
  // deno-lint-ignore no-explicit-any
  viewSubmission: (ctx: any) => Promise<any>;
};

const baseInputs = {
  interactivity: {
    interactivity_pointer: "trigger-1",
    interactor: { id: "U1", secret: "s" },
  },
};

const KNOWN_USER_ROW = [
  "3",
  "Max",
  "Mustermann",
  "",
  "",
  "",
  "",
  "",
  "",
  "max@example.com",
  "Hauptstraße",
  "1",
  "68159",
  "Mannheim",
  "0123456",
  "U1",
];

async function testEnv() {
  return {
    ...(await createTestGoogleServiceAccountEnv()),
    SPREADSHEET_ID_MASTERDATA: "SHEET_ID",
  };
}

Deno.test("opens the popup immediately, then fills it with the user's current values", async () => {
  const env = await testEnv();
  const stub = stubFetch({
    responses: {
      "oauth2.googleapis.com/token": { access_token: "t" },
      "views.open": { ok: true, view: { id: "V1" } },
      "views.update": { ok: true },
      "sheets.googleapis.com": { values: [["header"], KNOWN_USER_ROW] },
    },
  });

  try {
    await handler(createContext({ inputs: baseInputs, env }));

    const openIndex = stub.calls.findIndex((call) =>
      call.url.includes("views.open")
    );
    const updateIndex = stub.calls.findIndex((call) =>
      call.url.includes("views.update")
    );
    assertEquals(openIndex >= 0 && updateIndex > openIndex, true);

    // deno-lint-ignore no-explicit-any
    const updatedView = (stub.calls[updateIndex].body as any).view;
    const firstnameField = updatedView.blocks.find((b: { block_id?: string }) =>
      b.block_id === BlockIds.firstname
    );
    assertEquals(firstnameField.element.placeholder.text, "Max");
  } finally {
    stub.restore();
  }
});

Deno.test("shows an error and completes with an error when the user isn't registered", async () => {
  const env = await testEnv();
  const stub = stubFetch({
    responses: {
      "oauth2.googleapis.com/token": { access_token: "t" },
      "views.open": { ok: true, view: { id: "V1" } },
      "views.update": { ok: true },
      "functions.completeError": { ok: true },
      "sheets.googleapis.com": { values: [["header"]] }, // no matching row
    },
  });

  try {
    await handler(createContext({ inputs: baseInputs, env }));

    assertEquals(
      stub.calls.some((call) => call.url.includes("functions.completeError")),
      true,
    );
  } finally {
    stub.restore();
  }
});

function viewSubmissionContext(
  values: Record<string, string>,
  env: Record<string, string>,
) {
  const stateValues: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(values)) {
    const key = field as keyof typeof BlockIds;
    stateValues[BlockIds[key]] = { [ActionIds[key]]: { value } };
  }

  return {
    env,
    view: {
      callback_id: changeMasterdataViewCallbackId,
      state: { values: stateValues },
    },
    body: {
      type: "view_submission",
      user: { id: "U1" },
      function_data: {
        execution_id: "fx1",
        inputs: baseInputs,
        function: { callback_id: "masterdata_change_popup" },
      },
    },
  };
}

Deno.test("view submission rejects an invalid phone number inline", async () => {
  const env = await testEnv();
  const stub = stubFetch({ responses: {} });

  try {
    const result = await handler.viewSubmission(
      viewSubmissionContext({ phone: "not-a-number" }, env),
    );

    assertEquals(result.response_action, "errors");
    assertEquals(Object.keys(result.errors), [BlockIds.phone]);
  } finally {
    stub.restore();
  }
});

Deno.test("view submission rejects an empty change set inline", async () => {
  const env = await testEnv();
  const stub = stubFetch({
    responses: {
      "oauth2.googleapis.com/token": { access_token: "t" },
      "sheets.googleapis.com": { values: [["header"], KNOWN_USER_ROW] },
    },
  });

  try {
    const result = await handler.viewSubmission(
      viewSubmissionContext({}, env),
    );

    assertEquals(result.response_action, "errors");
  } finally {
    stub.restore();
  }
});

Deno.test("view submission completes with the diff and notification texts for a real change", async () => {
  const env = await testEnv();
  const stub = stubFetch({
    responses: {
      "oauth2.googleapis.com/token": { access_token: "t" },
      "sheets.googleapis.com": { values: [["header"], KNOWN_USER_ROW] },
      "functions.completeSuccess": { ok: true },
    },
  });

  try {
    const result = await handler.viewSubmission(
      viewSubmissionContext({ firstname: "Maximilian" }, env),
    );

    assertEquals(result, {});

    const completeCall = stub.calls.find((call) =>
      call.url.includes("functions.completeSuccess")
    );
    // deno-lint-ignore no-explicit-any
    const outputs = (completeCall?.body as any).outputs;
    assertEquals(outputs.changes.firstname, "Maximilian");
    assertEquals(outputs.changes.slackId, "U1");
    assertEquals(typeof outputs.userNotificationText, "string");
    assertEquals(typeof outputs.approverNotificationText, "string");
  } finally {
    stub.restore();
  }
});
