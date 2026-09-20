import { assertEquals } from "@std/assert";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import { stubFetch } from "../../../shared/testing/fetch_stub.ts";
import { WhoIsThereFunction } from "./definition.ts";
import handler from "./mod.ts";

const { createContext } = SlackFunctionTester(WhoIsThereFunction);

Deno.test("sends an ephemeral message and does not post for a past date", async () => {
  const stub = stubFetch({
    responses: { "chat.postEphemeral": { ok: true } },
  });

  try {
    const context = createContext({
      inputs: { date: "2020-01-01", user: "U1", channel: "C123" },
    });
    const result = await handler(context);

    assertEquals(result.outputs, {});
    const ephemeralCall = stub.calls.find((call) =>
      call.url.includes("chat.postEphemeral")
    );
    assertEquals(ephemeralCall !== undefined, true);
    assertEquals(
      stub.calls.some((call) => call.url.includes("chat.postMessage")),
      false,
    );
  } finally {
    stub.restore();
  }
});

Deno.test("posts the query and stays open for a valid future date", async () => {
  const stub = stubFetch({
    responses: {
      "apps.datastore.get": { ok: true, item: {} },
      "apps.datastore.query": { ok: true, items: [] },
      "chat.postMessage": { ok: true, ts: "1.1" },
      "apps.datastore.put": { ok: true },
    },
  });

  try {
    const context = createContext({
      inputs: { date: "2099-01-01", user: "U1", channel: "C123" },
    });
    const result = await handler(context);

    assertEquals(result.completed, false);
    assertEquals(
      stub.calls.some((call) => call.url.includes("chat.postMessage")),
      true,
    );
  } finally {
    stub.restore();
  }
});
