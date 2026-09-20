import { formatSlackDate, formatTime, today } from "../../util.ts";

export const ApproverActionIds = {
  approve: "approver_approve",
  reject: "approver_reject",
} as const;

// `text`/`originalText` come from a Schema.slack.types.expanded_rich_text
// input, whose runtime value is a Block Kit `rich_text` block (or array of
// blocks) - not a string - so it must be spliced into `blocks` directly
// rather than wrapped as `section` mrkdwn text.
// deno-lint-ignore no-explicit-any
type RichTextBlock = any;

function attachmentBlocks(
  attachmentPermalink: string | undefined,
  // deno-lint-ignore no-explicit-any
): any[] {
  return attachmentPermalink
    ? [{
      type: "section",
      text: { type: "mrkdwn", text: `📎 <${attachmentPermalink}|Anhang>` },
    }]
    : [];
}

/**
 * Initial approval request: the text plus Freigeben/Ablehnen buttons.
 */
export function approvalMessageBlocks(
  text: RichTextBlock,
  attachmentPermalink?: string,
  // deno-lint-ignore no-explicit-any
): any[] {
  // deno-lint-ignore no-explicit-any
  return ([] as any[]).concat(text, attachmentBlocks(attachmentPermalink), [
    {
      type: "actions",
      elements: [
        {
          type: "button",
          style: "primary",
          text: { type: "plain_text", text: "Freigeben", emoji: true },
          action_id: ApproverActionIds.approve,
        },
        {
          type: "button",
          style: "danger",
          text: { type: "plain_text", text: "Ablehnen", emoji: true },
          action_id: ApproverActionIds.reject,
        },
      ],
    },
  ]);
}

/**
 * Rebuilds the approval message without the buttons, appending who decided
 * what and when (plus the reason, for rejections that gave one).
 */
export function resolvedMessageBlocks(
  originalText: RichTextBlock,
  attachmentPermalink: string | undefined,
  { approved, userId, reason }: {
    approved: boolean;
    userId: string;
    reason?: string;
  },
  // deno-lint-ignore no-explicit-any
): any[] {
  const comment = `\`${
    approved ? "freigegeben" : "abgelehnt"
  }\` von <@${userId}> um ${formatTime(new Date())} Uhr am ${
    formatSlackDate(today())
  }${!approved && reason ? `\nGrund: ${reason}` : ""}`;

  // deno-lint-ignore no-explicit-any
  return ([] as any[]).concat(
    originalText,
    attachmentBlocks(attachmentPermalink),
    [
      { type: "section", text: { type: "mrkdwn", text: comment } },
    ],
  );
}
