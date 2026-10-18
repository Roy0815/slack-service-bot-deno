import { SlackAPIClient } from "deno-slack-api/types.ts";
import { MessageAttachment } from "./attachments.ts";
import { BlockKitObject } from "../../../shared/block_kit.ts";
import { assertOk } from "../../../shared/util.ts";
import { withChannelAccess } from "../../../shared/channel_access.ts";

/**
 * Loads a single message. Public channels the bot is not in are joined on
 * the fly; private ones need the bot to be added by a member.
 */
export async function fetchMessage(
  client: SlackAPIClient,
  channel: string,
  messageTs: string,
): Promise<BlockKitObject> {
  const query = {
    channel,
    latest: messageTs,
    oldest: messageTs,
    inclusive: true,
  };

  const history = assertOk(
    await withChannelAccess(
      client,
      channel,
      () => client.conversations.history({ ...query, limit: 1 }),
    ),
    "SubmitExpenseFromMessageFunction - Error reading channel",
  );

  // deno-lint-ignore no-explicit-any
  const find = (messages: any[] | undefined) =>
    messages?.find((message) => message.ts === messageTs);

  const message = find(history.messages);
  if (message) return message;

  // thread replies are not part of the channel history
  const replies = assertOk(
    await client.conversations.replies({ ...query, ts: messageTs }),
    "SubmitExpenseFromMessageFunction - Error reading thread",
  );
  const reply = find(replies.messages);
  if (!reply) throw new Error("Die Nachricht wurde nicht gefunden");
  return reply;
}

/**
 * Downloads a message's file. Email attachments are Slack files of their
 * own, but in case one cannot be resolved via files.info, the download URL
 * listed in the email is tried instead.
 */
export async function downloadAttachment(
  client: SlackAPIClient,
  /** The function's own token, as passed to its handlers */
  token: string,
  attachment: MessageAttachment,
): Promise<Uint8Array<ArrayBuffer>> {
  const info = await client.files.info({ file: attachment.fileId });
  const url: string | undefined = info.ok
    ? (info.file as BlockKitObject)?.url_private_download
    : attachment.url;

  if (!url) {
    throw new Error(
      `Datei ${attachment.name} nicht gefunden (${info.error ?? "ohne URL"})`,
    );
  }

  // which way the URL was found - tells apart why a download is refused
  const source = info.ok
    ? "files.info"
    : `E-Mail-URL, files.info: ${info.error}`;

  // Slack answers an unauthorized download with a redirect to the
  // workspace's login page instead of a 401 - following it would only fail
  // on the runtime's network allowlist with a misleading message
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: "manual",
  });

  if (response.status >= 300 && response.status < 400) {
    throw new Error(
      `Slack verweigert dem Bot den Download von ${attachment.name} (${source})`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `Datei ${attachment.name} konnte nicht geladen werden (HTTP ${response.status}, ${source})`,
    );
  }

  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Uploads a file as a reply into a thread and returns the new file's ID.
 * The upload is a copy owned by the bot, so later steps can always read it,
 * regardless of who could see the original.
 */
export async function uploadToThread(
  client: SlackAPIClient,
  fileBytes: Uint8Array<ArrayBuffer>,
  fileName: string,
  channel: string,
  threadTs: string,
): Promise<string> {
  const target = assertOk(
    await client.apiCall("files.getUploadURLExternal", {
      filename: fileName,
      length: fileBytes.length,
    }),
    "SubmitExpenseFromMessageFunction - Error requesting upload URL",
  );

  const upload = await fetch(target.upload_url as string, {
    method: "POST",
    body: fileBytes,
  });

  if (!upload.ok) {
    throw new Error("Datei konnte nicht zu Slack hochgeladen werden");
  }

  assertOk(
    await client.apiCall("files.completeUploadExternal", {
      files: [{ id: target.file_id, title: fileName }],
      channel_id: channel,
      thread_ts: threadTs,
    }),
    "SubmitExpenseFromMessageFunction - Error completing upload",
  );

  return target.file_id as string;
}
