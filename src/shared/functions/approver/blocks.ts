import { formatSlackDate, formatTime, today } from "../../util.ts";

export const ApproverActionIds = {
  approve: "approver_approve",
  reject: "approver_reject",
} as const;

// `text`/`originalText` come from a Schema.slack.types.expanded_rich_text
// input, whose runtime value is a block (or array of blocks) - not a
// string - so it must be spliced into `blocks` directly rather than
// wrapped as `section` mrkdwn text. See toRichTextBlocks for why it can't
// be passed through unchanged.
// deno-lint-ignore no-explicit-any
type RichTextBlock = any;

// mrkdwn user/channel mentions and inline code inside a plain text element
const MRKDWN_TOKEN =
  /<@([UW][A-Z0-9]+)>|<#(C[A-Z0-9]+)(?:\|[^>]*)?>|`([^`]+)`/g;

/**
 * Turns the input value into blocks chat.postMessage accepts:
 * - Workflow Builder delivers blocks of type `expanded_rich_text`, which
 *   the Web API rejects with `invalid_blocks` - only `rich_text` is valid.
 * - Variables inserted into the text (e.g. a notification text built by an
 *   earlier step) arrive as plain text elements, so their mrkdwn would show
 *   up literally. Mentions and inline code are converted to the matching
 *   rich text elements.
 */
export function toRichTextBlocks(text: RichTextBlock): RichTextBlock[] {
  return ([] as RichTextBlock[]).concat(text).map((block) =>
    block?.type === "expanded_rich_text" || block?.type === "rich_text"
      ? {
        ...block,
        type: "rich_text",
        elements: block.elements?.map(convertMrkdwnInContainer),
      }
      : block
  );
}

function convertMrkdwnInContainer(container: RichTextBlock): RichTextBlock {
  if (!Array.isArray(container?.elements)) return container;
  return {
    ...container,
    elements: container.elements.flatMap((element: RichTextBlock) =>
      element?.type === "text"
        ? splitMrkdwnText(element)
        : convertMrkdwnInContainer(element)
    ),
  };
}

function splitMrkdwnText(element: RichTextBlock): RichTextBlock[] {
  const parts: RichTextBlock[] = [];
  let last = 0;

  const pushText = (text: string, style = element.style) => {
    if (text) parts.push({ ...element, text, ...(style ? { style } : {}) });
  };

  for (const match of element.text.matchAll(MRKDWN_TOKEN)) {
    pushText(element.text.slice(last, match.index));
    const [, userId, channelId, code] = match;
    if (userId) parts.push({ type: "user", user_id: userId });
    else if (channelId) parts.push({ type: "channel", channel_id: channelId });
    else pushText(code, { ...element.style, code: true });
    last = match.index! + match[0].length;
  }
  pushText(element.text.slice(last));

  return parts;
}

/**
 * Initial approval request: the text plus Freigeben/Ablehnen buttons.
 */
export function approvalMessageBlocks(
  text: RichTextBlock,
  // deno-lint-ignore no-explicit-any
): any[] {
  // deno-lint-ignore no-explicit-any
  return ([] as any[]).concat(
    toRichTextBlocks(text),
    [
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
    ],
  );
}

/**
 * Rebuilds the approval message without the buttons, appending who decided
 * what and when (plus the reason, for rejections that gave one) as a
 * context block.
 */
export function resolvedMessageBlocks(
  originalText: RichTextBlock,
  { approved, userId, reason }: {
    approved: boolean;
    userId: string;
    reason?: string;
  },
  // deno-lint-ignore no-explicit-any
): any[] {
  const comment = `${
    approved ? ":white_check_mark: `freigegeben`" : ":x: `abgelehnt`"
  } von <@${userId}> um ${formatTime(new Date())} Uhr am ${
    formatSlackDate(today())
  }${!approved && reason ? `\nGrund: ${reason}` : ""}`;

  // deno-lint-ignore no-explicit-any
  return ([] as any[]).concat(
    toRichTextBlocks(originalText),
    [{ type: "context", elements: [{ type: "mrkdwn", text: comment }] }],
  );
}

/**
 * DM to the requester after a rejection: who rejected it, the reason (if
 * given) and the original request text, shown smaller in a context block.
 */
export function rejectionNotificationBlocks(
  originalText: RichTextBlock,
  { userId, reason }: { userId: string; reason?: string },
  // deno-lint-ignore no-explicit-any
): any[] {
  const comment = `Deine Anfrage wurde von <@${userId}> abgelehnt.${
    reason ? `\nGrund: ${reason}` : ""
  }`;

  return [
    { type: "section", text: { type: "mrkdwn", text: comment } },
    {
      type: "context",
      elements: [{
        type: "mrkdwn",
        text: truncate(richTextToMrkdwn(originalText), CONTEXT_TEXT_LIMIT),
      }],
    },
  ];
}

// max length of a text element in a context block
const CONTEXT_TEXT_LIMIT = 3000;

function truncate(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

/**
 * Renders the input value as mrkdwn, for places that don't accept rich
 * text blocks (e.g. context blocks). Covers the elements Workflow Builder's
 * editor produces; unknown elements are dropped.
 */
export function richTextToMrkdwn(text: RichTextBlock): string {
  return toRichTextBlocks(text)
    .map((block) =>
      (block?.elements ?? []).map(containerToMrkdwn).join("\n").trimEnd()
    )
    .filter(Boolean)
    .join("\n");
}

function containerToMrkdwn(container: RichTextBlock): string {
  const inline = (): string =>
    (container.elements ?? []).map(elementToMrkdwn).join("");

  switch (container?.type) {
    case "rich_text_section":
      return inline().replace(/\n$/, "");
    case "rich_text_preformatted":
      return `\`\`\`${inline()}\`\`\``;
    case "rich_text_quote":
      return inline().split("\n").map((line) => `> ${line}`).join("\n");
    case "rich_text_list":
      return (container.elements ?? []).map((item: RichTextBlock, i: number) =>
        `${"    ".repeat(container.indent ?? 0)}${
          container.style === "ordered"
            ? `${(container.offset ?? 0) + i + 1}.`
            : "•"
        } ${containerToMrkdwn(item)}`
      ).join("\n");
    default:
      return "";
  }
}

function elementToMrkdwn(element: RichTextBlock): string {
  switch (element?.type) {
    case "text":
      return styled(escapeMrkdwn(element.text ?? ""), element.style);
    case "link": {
      const label = element.text ? `|${escapeMrkdwn(element.text)}` : "";
      return styled(`<${element.url}${label}>`, element.style);
    }
    case "user":
      return `<@${element.user_id}>`;
    case "channel":
      return `<#${element.channel_id}>`;
    case "usergroup":
      return `<!subteam^${element.usergroup_id}>`;
    case "broadcast":
      return `<!${element.range}>`;
    case "emoji":
      return `:${element.name}:`;
    case "date":
      return escapeMrkdwn(element.fallback ?? "");
    default:
      return "";
  }
}

function escapeMrkdwn(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(
    />/g,
    "&gt;",
  );
}

/**
 * Wraps text in mrkdwn style markers. Leading/trailing whitespace is kept
 * outside, because Slack ignores markers next to whitespace ("*Roy *").
 */
function styled(
  text: string,
  style?: {
    bold?: boolean;
    italic?: boolean;
    strike?: boolean;
    code?: boolean;
  },
): string {
  if (!style) return text;
  const [, lead, core, trail] = text.match(/^(\s*)(.*?)(\s*)$/s)!;
  if (!core) return text;

  let result = core;
  if (style.code) result = `\`${result}\``;
  if (style.strike) result = `~${result}~`;
  if (style.italic) result = `_${result}_`;
  if (style.bold) result = `*${result}*`;
  return `${lead}${result}${trail}`;
}
