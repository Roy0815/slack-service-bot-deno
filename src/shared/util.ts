import { SlackAPIClient } from "deno-slack-api/types.ts";

export function formatSlackDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}

export function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${
    String(now.getDate()).padStart(2, "0")
  }`;
}

/**
 * Checks a Slack API response's `ok` flag and throws (visible to admins via
 * `slack activity --tail`) if the call failed, otherwise returns it
 * unchanged - lets call sites do `assertOk(await client.foo(...), "context")`
 * in one line instead of a repeated `if (!x.ok) throw ...` block.
 */
export function assertOk<T extends { ok: boolean; error?: string }>(
  response: T,
  context: string,
): T {
  if (!response.ok) {
    throw new Error(`${context}: ${response.error}`);
  }
  return response;
}

/**
 * Creates a {@link assertOk}-like checker that never throws - use it after a
 * point of no return (e.g. once a previous message was already deleted),
 * where aborting the function would leave things in a worse state than just
 * continuing. On failure, it logs and posts a warning to `adminChannel`
 * instead. Bind `client`/`adminChannel` once per handler, then call the
 * returned function as `checkOk(await client.foo(...), "context")`.
 */
export function createOkChecker(client: SlackAPIClient, adminChannel: string) {
  return async function checkOk<T extends { ok: boolean; error?: string }>(
    response: T,
    context: string,
  ): Promise<T> {
    if (!response.ok) {
      const message = `${context}: ${response.error}`;
      console.error(message);

      if (adminChannel) {
        await client.chat.postMessage({
          channel: adminChannel,
          text: `:warning: ${message}`,
        });
      }
    }

    return response;
  };
}
