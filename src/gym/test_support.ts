import { SlackAPIClient } from "deno-slack-api/types.ts";

export type FakeCall = { name: string; args: unknown };

export type FakeClientOverrides = {
  datastoreGet?: unknown;
  datastoreQueryItems?: unknown[];
  viewsOpen?: unknown;
};

/**
 * Minimal fake of the subset of SlackAPIClient used across the gym
 * functions' tests, recording every call so tests can assert on what was
 * sent without hitting the real Slack API.
 */
export function createFakeClient(overrides: FakeClientOverrides = {}) {
  const calls: FakeCall[] = [];
  const record = (name: string, args: unknown, response: unknown) => {
    calls.push({ name, args });
    return Promise.resolve(response);
  };

  const client = {
    apps: {
      datastore: {
        get: (args: unknown) =>
          record(
            "datastore.get",
            args,
            overrides.datastoreGet ?? {
              ok: true,
              item: {},
            },
          ),
        query: (args: unknown) =>
          record("datastore.query", args, {
            ok: true,
            items: overrides.datastoreQueryItems ?? [],
          }),
        put: (args: unknown) => record("datastore.put", args, { ok: true }),
        update: (args: unknown) =>
          record("datastore.update", args, { ok: true }),
        delete: (args: unknown) =>
          record("datastore.delete", args, { ok: true }),
      },
    },
    chat: {
      delete: (args: unknown) => record("chat.delete", args, { ok: true }),
      postMessage: (args: unknown) =>
        record("chat.postMessage", args, { ok: true, ts: "1234.5678" }),
      postEphemeral: (args: unknown) =>
        record("chat.postEphemeral", args, { ok: true }),
      update: (args: unknown) => record("chat.update", args, { ok: true }),
    },
    views: {
      open: (args: unknown) =>
        record(
          "views.open",
          args,
          overrides.viewsOpen ?? { ok: true, view: { id: "V1" } },
        ),
      update: (args: unknown) => record("views.update", args, { ok: true }),
    },
    functions: {
      completeSuccess: (args: unknown) =>
        record("functions.completeSuccess", args, { ok: true }),
      completeError: (args: unknown) =>
        record("functions.completeError", args, { ok: true }),
    },
  };

  return { client: client as unknown as SlackAPIClient, calls };
}
