import { assertEquals, assertRejects } from "@std/assert";
import { SlackAPIClient } from "deno-slack-api/types.ts";
import { NotInChannelError, withChannelAccess } from "./channel_access.ts";

/** Just the two conversations methods the helper uses, recording joins */
function fakeClient(channel: Record<string, unknown> | undefined) {
  const joined: string[] = [];
  const client = {
    conversations: {
      info: () =>
        Promise.resolve(
          channel
            ? { ok: true, channel }
            : { ok: false, error: "channel_not_found" },
        ),
      join: ({ channel }: { channel: string }) => {
        joined.push(channel);
        return Promise.resolve({ ok: true });
      },
    },
  } as unknown as SlackAPIClient;
  return { client, joined };
}

/** A call that fails with `error` until the bot has joined */
function callFailingWith(error: string, joined: string[]) {
  let calls = 0;
  const call = () => {
    calls++;
    return Promise.resolve(
      joined.length > 0 ? { ok: true } : { ok: false, error },
    );
  };
  return { call, calls: () => calls };
}

Deno.test("a successful call is passed through without joining", async () => {
  const { client, joined } = fakeClient({ is_channel: true });
  const response = await withChannelAccess(
    client,
    "C1",
    () => Promise.resolve({ ok: true }),
  );
  assertEquals(response.ok, true);
  assertEquals(joined, []);
});

Deno.test("joins a public channel and retries once", async () => {
  const { client, joined } = fakeClient({ is_channel: true });
  const { call, calls } = callFailingWith("not_in_channel", joined);

  const response = await withChannelAccess(client, "C1", call);

  assertEquals(response.ok, true);
  assertEquals(joined, ["C1"]);
  assertEquals(calls(), 2);
});

Deno.test("a private channel the bot cannot see throws NotInChannelError", async () => {
  const { client, joined } = fakeClient(undefined);
  const { call } = callFailingWith("channel_not_found", joined);

  await assertRejects(
    () => withChannelAccess(client, "G1", call),
    NotInChannelError,
  );
  assertEquals(joined, []);
});

Deno.test("a visible private channel is not joined either", async () => {
  const { client, joined } = fakeClient({ is_channel: true, is_private: true });
  const { call } = callFailingWith("not_in_channel", joined);

  await assertRejects(
    () => withChannelAccess(client, "G1", call),
    NotInChannelError,
  );
  assertEquals(joined, []);
});

Deno.test("other errors are returned for the caller to handle", async () => {
  const { client, joined } = fakeClient({ is_channel: true });
  const response = await withChannelAccess(
    client,
    "C1",
    () => Promise.resolve({ ok: false, error: "ratelimited" }),
  );
  assertEquals(response.error, "ratelimited");
  assertEquals(joined, []);
});
