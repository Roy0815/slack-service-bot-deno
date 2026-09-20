import { assertEquals } from "@std/assert";
import { createFakeClient } from "../../test_support.ts";
import { postOrMergeQuery, validateQueryDate } from "./controller.ts";

Deno.test("validateQueryDate rejects a date in the past", async () => {
  const { client } = createFakeClient();
  const result = await validateQueryDate(client, "2020-01-01");
  assertEquals(result, "past");
});

Deno.test("validateQueryDate rejects a date with an existing active query", async () => {
  const { client } = createFakeClient({
    datastoreGet: { ok: true, item: { date: "2099-01-01" } },
  });
  const result = await validateQueryDate(client, "2099-01-01");
  assertEquals(result, "exists");
});

Deno.test("validateQueryDate accepts a future date with no existing query", async () => {
  const { client } = createFakeClient({ datastoreGet: { ok: true, item: {} } });
  const result = await validateQueryDate(client, "2099-01-01");
  assertEquals(result, undefined);
});

Deno.test("postOrMergeQuery posts a fresh message and persists it when nothing else is active", async () => {
  const { client, calls } = createFakeClient({ datastoreQueryItems: [] });

  await postOrMergeQuery(client, {
    date: "2099-01-01",
    user: "U_REQUESTER",
    channel: "C123",
    executionId: "fx1",
  });

  const callNames = calls.map((call) => call.name);
  assertEquals(callNames.includes("chat.delete"), false);
  assertEquals(callNames.includes("functions.completeSuccess"), false);
  assertEquals(callNames.includes("chat.postMessage"), true);

  const put = calls.find((call) => call.name === "datastore.put");
  // deno-lint-ignore no-explicit-any
  assertEquals((put?.args as any).item.date, "2099-01-01");
});

Deno.test("postOrMergeQuery tears down the old shared message and merges dates", async () => {
  const { client, calls } = createFakeClient({
    datastoreQueryItems: [
      {
        date: "2098-01-01",
        message_ts: "old.ts",
        channel_id: "C123",
        requested_by: "U_OLD",
        execution_id: "fx0",
      },
    ],
  });

  await postOrMergeQuery(client, {
    date: "2099-01-01",
    user: "U_REQUESTER",
    channel: "C123",
    executionId: "fx1",
  });

  const callNames = calls.map((call) => call.name);
  assertEquals(callNames.includes("chat.delete"), true);
  assertEquals(callNames.includes("functions.completeSuccess"), true);

  const complete = calls.find((call) =>
    call.name === "functions.completeSuccess"
  );
  // deno-lint-ignore no-explicit-any
  assertEquals((complete?.args as any).function_execution_id, "fx0");

  // both dates get persisted: the new one via put, the pre-existing one via update
  const put = calls.find((call) => call.name === "datastore.put");
  const update = calls.find((call) => call.name === "datastore.update");
  // deno-lint-ignore no-explicit-any
  assertEquals((put?.args as any).item.date, "2099-01-01");
  // deno-lint-ignore no-explicit-any
  assertEquals((update?.args as any).item.date, "2098-01-01");
});
