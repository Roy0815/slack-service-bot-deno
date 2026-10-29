import { BlockKitObject } from "../../../shared/block_kit.ts";
import { TimeZone } from "./constants.ts";

/** A file of a message that can be submitted as an invoice */
export type MessageAttachment = {
  fileId: string;
  name: string;
  /**
   * Download URL of an email attachment - kept as a fallback in case the
   * attachment's own Slack file cannot be resolved via files.info
   */
  url?: string;
};

/**
 * Lists the submittable files of a message. Emails forwarded by the Slack
 * email integration arrive as one `filetype: "email"` file whose real
 * attachments are nested in `attachments[]` - only those are offered, the
 * email itself is not a valid invoice. Any other file is offered as is.
 */
export function collectAttachments(
  message: BlockKitObject,
): MessageAttachment[] {
  const attachments: MessageAttachment[] = [];

  for (const file of message?.files ?? []) {
    // deleted files or files beyond the workspace's history limit
    if (
      !file?.id || file.mode === "tombstone" || file.mode === "hidden_by_limit"
    ) {
      continue;
    }

    if (file.filetype === "email" || file.mode === "email") {
      for (const attachment of file.attachments ?? []) {
        if (!attachment?.slack_file_id) continue;
        attachments.push({
          fileId: attachment.slack_file_id,
          name: attachment.filename ?? attachment.slack_file_id,
          url: attachment.url,
        });
      }
      continue;
    }

    attachments.push({
      fileId: file.id,
      name: file.name ?? file.title ?? file.id,
    });
  }

  return attachments;
}

/** The calendar day (YYYY-MM-DD) a Slack message timestamp falls on */
export function messageDate(messageTs: string): string {
  const date = new Date(Number(messageTs.split(".")[0]) * 1000);
  // en-CA formats as YYYY-MM-DD, the format of Schema.slack.types.date
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
