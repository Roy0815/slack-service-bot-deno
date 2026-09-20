import { assertEquals } from "@std/assert";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import { stubFetch } from "../../../shared/testing/fetch_stub.ts";
import { WhoIsThereDeleteFunction } from "./definition.ts";
import handler from "./mod.ts";

const { createContext } = SlackFunctionTester(WhoIsThereDeleteFunction);

Deno.test("does nothing when no dates are outdated", async () => {
  const stub = stubFetch({
    responses: {
      "apps.datastore.query": {
        ok: true,
        items: [{ date: "2099-01-01", channel_id: "C1", message_ts: "1.1" }],
      },
    },
  });

  try {
    await handler(createContext({ inputs: {} }));
    assertEquals(
      stub.calls.some((call) => call.url.includes("datastore.delete")),
      false,
    );
  } finally {
    stub.restore();
  }
});

Deno.test("deletes outdated dates and updates the message when other dates remain", async () => {
  const stub = stubFetch({
    responses: {
      "apps.datastore.query": {
        ok: true,
        items: [
          {
            date: "2020-01-01",
            channel_id: "C1",
            message_ts: "1.1",
            execution_id: "fx0",
            requested_by: "U1",
          },
          {
            date: "2099-01-01",
            channel_id: "C1",
            message_ts: "1.1",
            requested_by: "U2",
          },
        ],
      },
      "apps.datastore.delete": { ok: true },
      "chat.update": { ok: true },
    },
  });

  try {
    await handler(createContext({ inputs: {} }));

    assertEquals(
      stub.calls.some((call) => call.url.includes("apps.datastore.delete")),
      true,
    );
    assertEquals(
      stub.calls.some((call) => call.url.includes("chat.update")),
      true,
    );
    assertEquals(
      stub.calls.some((call) => call.url.includes("chat.delete")),
      false,
    );
    assertEquals(
      stub.calls.some((call) => call.url.includes("functions.completeSuccess")),
      false,
    );
  } finally {
    stub.restore();
  }
});

Deno.test("deletes the message and completes the execution when nothing remains", async () => {
  const stub = stubFetch({
    responses: {
      "apps.datastore.query": {
        ok: true,
        items: [{
          date: "2020-01-01",
          channel_id: "C1",
          message_ts: "1.1",
          execution_id: "fx0",
          requested_by: "U1",
        }],
      },
      "apps.datastore.delete": { ok: true },
      "functions.completeSuccess": { ok: true },
      "chat.delete": { ok: true },
    },
  });

  try {
    await handler(createContext({ inputs: {} }));

    assertEquals(
      stub.calls.some((call) => call.url.includes("functions.completeSuccess")),
      true,
    );
    assertEquals(
      stub.calls.some((call) => call.url.includes("chat.delete")),
      true,
    );
  } finally {
    stub.restore();
  }
});
