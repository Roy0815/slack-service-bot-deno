import { SlackAPIClient } from "deno-slack-api/types.ts";
import { assertOk } from "./util.ts";

/** The bot cannot access the channel and cannot join it on its own */
export class NotInChannelError extends Error {
  constructor(readonly channel: string) {
    super(`Der Bot ist nicht im Channel <#${channel}>`);
  }
}

/**
 * Errors Slack returns when the bot is not a member: `not_in_channel` for a
 * public channel, `channel_not_found` for a private one - the bot cannot
 * even see a private channel it has not been added to.
 */
const NoAccessErrors = ["not_in_channel", "channel_not_found"];

/**
 * Runs a Slack API call that needs channel membership. If the bot is not
 * in the channel, it joins a public channel and retries once; for a private
 * channel it throws NotInChannelError, so callers can ask the user to add
 * the bot.
 *
 * The response is returned as is (including other errors) - checking it is
 * up to the caller, e.g. via `assertOk`.
 */
export async function withChannelAccess<
  T extends { ok: boolean; error?: string },
>(
  client: SlackAPIClient,
  channel: string,
  call: () => Promise<T>,
): Promise<T> {
  const response = await call();
  if (response.ok || !NoAccessErrors.includes(response.error ?? "")) {
    return response;
  }

  await joinPublicChannel(client, channel);
  return await call();
}

async function joinPublicChannel(
  client: SlackAPIClient,
  channel: string,
): Promise<void> {
  const info = await client.conversations.info({ channel });

  // fails for a private channel the bot is not in, as it cannot see it
  if (!info.ok || info.channel?.is_private || !info.channel?.is_channel) {
    throw new NotInChannelError(channel);
  }

  assertOk(
    await client.conversations.join({ channel }),
    "withChannelAccess - Error joining channel",
  );
}
